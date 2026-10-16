/**
 * @file batch-approval.ts
 * @description Domain service orchestrating batch preflight calculation, immutable snapshot creation, and recovery.
 * @architecture Implements the PRD-CORE-06 deep domain module:
 *               1. Preflight review inspection with row breakdown, version validation, and retention presets.
 *               2. Deterministic canonical snapshot digest computation (recursively key-sorted SHA-256).
 *               3. Chunked copy of valid DraftRow records into ApprovedRecipient with idempotent crash recovery.
 *               4. CAS version conflict guards protecting against concurrent batch or template edits.
 * @agent_note Snapshot building is atomic and resumable. Approved data is decoupled from DraftRow to enforce immutability.
 */

import crypto from 'crypto';
import mongoose from 'mongoose';
import { Batch } from '../models/Batch.js';
import { DraftRow } from '../models/DraftRow.js';
import { TemplateVersion } from '../models/TemplateVersion.js';
import { ApprovedSnapshot, IApprovedSnapshotDoc } from '../models/ApprovedSnapshot.js';
import { ApprovedRecipient, IApprovedRecipientDoc } from '../models/ApprovedRecipient.js';
import { BatchNotFoundError } from './batch-intake.js';

/* -------------------------------------------------------------------------- */
/*                               Typed Domain Errors                          */
/* -------------------------------------------------------------------------- */

export { BatchNotFoundError };

export const ALLOWED_RETENTION_PRESETS = [24, 168, 720] as const;
export const DEFAULT_RETENTION_HOURS = 168;

/**
 * Thrown when an optimistic concurrency check fails on batch or template version during approval.
 */
export class StaleVersionConflictError extends Error {
  code: string;
  constructor(message: string, code = 'STALE_VERSION_CONFLICT') {
    super(message);
    this.name = 'StaleVersionConflictError';
    this.code = code;
    Object.setPrototypeOf(this, StaleVersionConflictError.prototype);
  }
}

/**
 * Thrown when batch parameters or states fail approval preconditions (e.g. 0 valid rows).
 */
export class BatchApprovalValidationError extends Error {
  code: string;
  constructor(message: string, code = 'BATCH_APPROVAL_VALIDATION_ERROR') {
    super(message);
    this.name = 'BatchApprovalValidationError';
    this.code = code;
    Object.setPrototypeOf(this, BatchApprovalValidationError.prototype);
  }
}

/**
 * Thrown when attempting to approve or mutate a batch that is currently generating or completed.
 */
export class GenerationInProgressError extends Error {
  code: string;
  constructor(message = 'Batch generation is currently in progress', code = 'BATCH_GENERATION_IN_PROGRESS') {
    super(message);
    this.name = 'GenerationInProgressError';
    this.code = code;
    Object.setPrototypeOf(this, GenerationInProgressError.prototype);
  }
}

/* -------------------------------------------------------------------------- */
/*                         Canonical Serialization & Hashing                  */
/* -------------------------------------------------------------------------- */

/**
 * Recursively orders object keys alphabetically to produce deterministic JSON.
 */
export function canonicalStringify(val: any): string {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return '[' + val.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(val).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(val[k])).join(',') + '}';
}

/**
 * Computes a deterministic SHA-256 fingerprint for an individual recipient record.
 */
export function computeCanonicalRecipientDigest(recipient: {
  recipientKey: string;
  sourceRowNumber: number;
  effectiveData: Record<string, any>;
  overrides?: Record<string, any>;
}): string {
  const normalized = {
    recipientKey: recipient.recipientKey,
    sourceRowNumber: recipient.sourceRowNumber,
    effectiveData: recipient.effectiveData || {},
    overrides: recipient.overrides || {},
  };
  return crypto.createHash('sha256').update(canonicalStringify(normalized)).digest('hex');
}

/**
 * Computes a deterministic SHA-256 digest across all valid recipients in canonical order.
 */
export function computeCanonicalSnapshotDigest(recipients: any[]): string {
  if (!recipients || recipients.length === 0) {
    return crypto.createHash('sha256').update('[]').digest('hex');
  }

  // Sort recipients deterministically by sourceRowNumber, then recipientKey or canonical string
  const sorted = [...recipients].sort((a, b) => {
    const rowA = typeof a.sourceRowNumber === 'number' ? a.sourceRowNumber : 0;
    const rowB = typeof b.sourceRowNumber === 'number' ? b.sourceRowNumber : 0;
    if (rowA !== rowB) return rowA - rowB;
    const keyA = a.recipientKey || a.rowKey || a._id?.toString() || '';
    const keyB = b.recipientKey || b.rowKey || b._id?.toString() || '';
    if (keyA && keyB) return keyA.localeCompare(keyB);
    return canonicalStringify(a).localeCompare(canonicalStringify(b));
  });

  return crypto.createHash('sha256').update(canonicalStringify(sorted)).digest('hex');
}

/* -------------------------------------------------------------------------- */
/*                                Service Methods                             */
/* -------------------------------------------------------------------------- */

export interface GetApprovalPreflightInput {
  batchId: string | mongoose.Types.ObjectId;
  ownerId: string;
}

export interface GetApprovalPreflightResult {
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
  };
  canApprove: boolean;
  batch: {
    id: string;
    name: string;
    version: number;
    status: string;
  };
  templateVersion: {
    id: string;
    version: number;
    mappingHash: string;
    sourceObjectKey: string;
  };
  importRevision: number;
  retentionPresets: Array<{ hours: number; label: string }>;
}

export interface ApproveBatchInput {
  batchId: string | mongoose.Types.ObjectId;
  ownerId: string;
  expectedBatchVersion?: number;
  expectedTemplateVersion?: number;
  expectedImportRevision?: number;
  retentionHours?: number;
  idempotencyKey: string;
}

export interface ApproveBatchResult {
  snapshot: IApprovedSnapshotDoc;
}

/**
 * Retrieves preflight review summary and verification metrics before batch approval.
 */
export async function getApprovalPreflight(
  input: GetApprovalPreflightInput
): Promise<GetApprovalPreflightResult> {
  const { batchId, ownerId } = input;

  const batch = await Batch.findOne({ _id: batchId, ownerId });
  if (!batch) {
    throw new BatchNotFoundError('Batch not found or access denied');
  }

  const revision = batch.currentImportRevision;
  const [totalRows, validRows, invalidRows, duplicateRows] = await Promise.all([
    DraftRow.countDocuments({ batchId: batch._id, revision }),
    DraftRow.countDocuments({ batchId: batch._id, revision, status: 'valid' }),
    DraftRow.countDocuments({ batchId: batch._id, revision, status: 'invalid' }),
    DraftRow.countDocuments({ batchId: batch._id, revision, isDuplicate: true }),
  ]);

  const templateVersion: any = await TemplateVersion.findOne({
    _id: batch.templateVersionId,
    ownerId,
  }).lean();

  if (!templateVersion) {
    throw new BatchNotFoundError('Template version not found or access denied');
  }

  return {
    summary: { totalRows, validRows, invalidRows, duplicateRows },
    canApprove: validRows > 0,
    batch: {
      id: batch._id.toString(),
      name: batch.name,
      version: batch.version,
      status: batch.status,
    },
    templateVersion: {
      id: templateVersion._id.toString(),
      version: templateVersion.version,
      mappingHash: templateVersion.mappingHash || '',
      sourceObjectKey: templateVersion.sourceObjectKey || '',
    },
    importRevision: revision,
    retentionPresets: [
      { hours: 24, label: '24 hours' },
      { hours: 168, label: '7 days (Standard)' },
      { hours: 720, label: '30 days' },
    ],
  };
}

/**
 * Atomically freezes valid draft rows into an immutable snapshot under optimistic concurrency locks.
 */
export async function approveBatch(input: ApproveBatchInput): Promise<ApproveBatchResult> {
  const {
    batchId,
    ownerId,
    expectedBatchVersion,
    expectedTemplateVersion,
    expectedImportRevision,
    retentionHours = 168,
    idempotencyKey,
  } = input;

  if (!ALLOWED_RETENTION_PRESETS.includes(retentionHours as any)) {
    throw new BatchApprovalValidationError(
      `Invalid retention preset: ${retentionHours}h. Permitted presets are 24, 168, or 720 hours.`,
      'INVALID_RETENTION_PRESET'
    );
  }

  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    throw new BatchApprovalValidationError('Valid idempotencyKey is required');
  }

  const batch = await Batch.findOne({ _id: batchId, ownerId });
  if (!batch) {
    throw new BatchNotFoundError('Batch not found or access denied');
  }

  if (batch.status === 'generating' || batch.status === 'ready_for_download') {
    throw new GenerationInProgressError('Cannot approve batch while generation is in progress or completed');
  }

  const templateVersion: any = await TemplateVersion.findOne({
    _id: batch.templateVersionId,
    ownerId,
  }).lean();

  if (!templateVersion) {
    throw new BatchNotFoundError('Template version not found or access denied');
  }

  // CAS Version Checks
  if (expectedBatchVersion !== undefined && batch.version !== expectedBatchVersion) {
    throw new StaleVersionConflictError(
      `Stale batch version: expected ${expectedBatchVersion}, current ${batch.version}`
    );
  }
  if (expectedTemplateVersion !== undefined && templateVersion.version !== expectedTemplateVersion) {
    throw new StaleVersionConflictError(
      `Stale template version: expected ${expectedTemplateVersion}, current ${templateVersion.version}`
    );
  }
  if (expectedImportRevision !== undefined && batch.currentImportRevision !== expectedImportRevision) {
    throw new StaleVersionConflictError(
      `Stale import revision: expected ${expectedImportRevision}, current ${batch.currentImportRevision}`
    );
  }

  // Check for existing snapshot with this idempotency key
  const existingSnapshot = await ApprovedSnapshot.findOne({
    batchId: batch._id,
    idempotencyKey,
  });

  if (existingSnapshot) {
    if (existingSnapshot.status === 'ready') {
      return { snapshot: existingSnapshot };
    }

    if (existingSnapshot.status === 'building') {
      // Resume and recover partial build
      const copiedRecipients = await ApprovedRecipient.find(
        { snapshotId: existingSnapshot._id },
        { recipientKey: 1, sourceRowNumber: 1 }
      ).lean();
      const copiedRowNumbers = new Set(copiedRecipients.map((r) => r.sourceRowNumber));
      const copiedKeys = new Set(copiedRecipients.map((r) => r.recipientKey));

      const validDraftRows = await DraftRow.find({
        batchId: batch._id,
        revision: batch.currentImportRevision,
        status: 'valid',
      })
        .sort({ sourceRowNumber: 1 })
        .lean();

      const remainingRows = validDraftRows.filter(
        (r) => !copiedRowNumbers.has(r.sourceRowNumber) && !copiedKeys.has(r.rowKey || (r._id as any).toString())
      );

      // Copy in chunks of 500
      for (let i = 0; i < remainingRows.length; i += 500) {
        const chunk = remainingRows.slice(i, i + 500);
        const ops = chunk.map((r) => {
          const recipientKey = r.rowKey || `rec_${r.sourceRowNumber}`;
          const digest = computeCanonicalRecipientDigest({
            recipientKey,
            sourceRowNumber: r.sourceRowNumber,
            effectiveData: r.effectiveData,
            overrides: r.overrides,
          });
          return {
            updateOne: {
              filter: { snapshotId: existingSnapshot._id, recipientKey },
              update: {
                $setOnInsert: {
                  snapshotId: existingSnapshot._id,
                  batchId: batch._id,
                  ownerId: batch.ownerId,
                  recipientKey,
                  sourceRowNumber: r.sourceRowNumber,
                  effectiveData: r.effectiveData,
                  overrides: r.overrides || {},
                  digest,
                  status: 'valid',
                  generationStatus: 'pending',
                  generationAttempts: 0,
                  expiresAt: existingSnapshot.expiresAt,
                },
              },
              upsert: true,
            },
          };
        });
        if (ops.length > 0) {
          await ApprovedRecipient.bulkWrite(ops, { ordered: false });
        }
      }

      const allRecipients = await ApprovedRecipient.find({ snapshotId: existingSnapshot._id })
        .sort({ sourceRowNumber: 1 })
        .lean();

      const canonicalDigest = computeCanonicalSnapshotDigest(allRecipients);
      existingSnapshot.canonicalDigest = canonicalDigest;
      existingSnapshot.totalRecipients = allRecipients.length;
      existingSnapshot.status = 'ready';
      await existingSnapshot.save();

      batch.status = 'approved';
      batch.approvedSnapshotId = existingSnapshot._id;
      batch.version = batch.version + 1;
      await batch.save();

      return { snapshot: existingSnapshot };
    }
  }

  // Verify valid rows exist
  const validDraftRows = await DraftRow.find({
    batchId: batch._id,
    revision: batch.currentImportRevision,
    status: 'valid',
  })
    .sort({ sourceRowNumber: 1 })
    .lean();

  if (!validDraftRows || validDraftRows.length === 0) {
    throw new BatchApprovalValidationError('No valid rows to approve');
  }

  const expiresAt = new Date(Date.now() + retentionHours * 3600 * 1000);

  // Invalidate any previously active snapshot for this batch
  if (batch.approvedSnapshotId) {
    await ApprovedSnapshot.findByIdAndUpdate(batch.approvedSnapshotId, { status: 'superseded' });
  }

  // Create snapshot in building state
  const snapshot = await ApprovedSnapshot.create({
    batchId: batch._id,
    ownerId: batch.ownerId,
    templateId: batch.templateId,
    templateVersionId: templateVersion._id,
    templateVersion: templateVersion.version,
    templateSourceChecksum: templateVersion.sourceObjectKey || '',
    mappingHash: templateVersion.mappingHash || '',
    importRevision: batch.currentImportRevision,
    retentionHours,
    expiresAt,
    canonicalDigest: 'building',
    totalRecipients: 0,
    idempotencyKey,
    status: 'building',
  });

  // Copy valid draft rows in bounded chunks of 500
  for (let i = 0; i < validDraftRows.length; i += 500) {
    const chunk = validDraftRows.slice(i, i + 500);
    const ops = chunk.map((r) => {
      const recipientKey = r.rowKey || `rec_${r.sourceRowNumber}`;
      const digest = computeCanonicalRecipientDigest({
        recipientKey,
        sourceRowNumber: r.sourceRowNumber,
        effectiveData: r.effectiveData,
        overrides: r.overrides,
      });
      return {
        updateOne: {
          filter: { snapshotId: snapshot._id, recipientKey },
          update: {
            $setOnInsert: {
              snapshotId: snapshot._id,
              batchId: batch._id,
              ownerId: batch.ownerId,
              recipientKey,
              sourceRowNumber: r.sourceRowNumber,
              effectiveData: r.effectiveData,
              overrides: r.overrides || {},
              digest,
              status: 'valid',
              generationStatus: 'pending',
              generationAttempts: 0,
              expiresAt: snapshot.expiresAt,
            },
          },
          upsert: true,
        },
      };
    });
    if (ops.length > 0) {
      await ApprovedRecipient.bulkWrite(ops, { ordered: false });
    }
  }

  // Finalize digest and reconcile counts
  const allRecipients = await ApprovedRecipient.find({ snapshotId: snapshot._id })
    .sort({ sourceRowNumber: 1 })
    .lean();

  const canonicalDigest = computeCanonicalSnapshotDigest(allRecipients);
  snapshot.canonicalDigest = canonicalDigest;
  snapshot.totalRecipients = allRecipients.length;
  snapshot.status = 'ready';
  await snapshot.save();

  batch.status = 'approved';
  batch.approvedSnapshotId = snapshot._id;
  batch.retentionHours = retentionHours;
  batch.expiresAt = expiresAt;
  batch.version = batch.version + 1;
  await batch.save();

  return { snapshot };
}

/**
 * Retrieves the currently approved snapshot for a batch.
 */
export async function getApprovedSnapshot(input: {
  batchId: string | mongoose.Types.ObjectId;
  ownerId: string;
}): Promise<IApprovedSnapshotDoc | null> {
  const { batchId, ownerId } = input;
  const batch = await Batch.findOne({ _id: batchId, ownerId });
  if (!batch || !batch.approvedSnapshotId) {
    return null;
  }
  return ApprovedSnapshot.findOne({ _id: batch.approvedSnapshotId, ownerId });
}

/**
 * Paginates approved recipients for a frozen snapshot.
 */
export async function getApprovedRecipients(input: {
  batchId: string | mongoose.Types.ObjectId;
  ownerId: string;
  page?: number;
  limit?: number;
}): Promise<{
  recipients: IApprovedRecipientDoc[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const { batchId, ownerId, page = 1, limit = 50 } = input;
  const batch = await Batch.findOne({ _id: batchId, ownerId });
  if (!batch || !batch.approvedSnapshotId) {
    return { recipients: [], total: 0, page, limit, totalPages: 0 };
  }

  const query = { snapshotId: batch.approvedSnapshotId, ownerId };
  const [total, recipients] = await Promise.all([
    ApprovedRecipient.countDocuments(query),
    ApprovedRecipient.find(query)
      .sort({ sourceRowNumber: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    recipients: recipients as any[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export const BatchApproval = {
  canonicalStringify,
  computeCanonicalRecipientDigest,
  computeCanonicalSnapshotDigest,
  getApprovalPreflight,
  approveBatch,
  getApprovedSnapshot,
  getApprovedRecipients,
};
