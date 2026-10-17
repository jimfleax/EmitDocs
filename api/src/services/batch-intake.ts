/**
 * @file batch-intake.ts
 * @description Core domain service managing spreadsheet chunk ingestion, import finalization, row overrides, and revision reconciliation.
 * @architecture Implements the transactional backend for bulk document issuance:
 *               1. Streaming idempotent chunk ingestion (`ingestChunk`) with DraftRow upserts.
 *               2. Revision finalization (`finalizeImport`) verifying chunk/row counts and running batch-wide duplicate detection.
 *               3. Concurrency-safe CAS row overrides (`patchRowOverride`) updating effective values and recomputing batch metrics.
 *               4. 4-way re-import reconciliation (`reconcileImportRevision`) transferring overrides across uploaded revisions.
 * @agent_note Optimistic concurrency is strictly enforced: `patchRowOverride` requires matching row `version`
 *             and batch `currentImportRevision`. Batch metrics must always be updated via `recalculateBatchCounters`.
 */

import mongoose from 'mongoose';
import { Batch, IBatch } from '../models/Batch.js';
import { BatchImport, IBatchImport } from '../models/BatchImport.js';
import { DraftRow } from '../models/DraftRow.js';
import { TemplateVersion } from '../models/TemplateVersion.js';
import { ApprovedSnapshot } from '../models/ApprovedSnapshot.js';
import { validateDraftRow, FieldMappingItem } from './spreadsheet/row-validator.js';
import { detectDuplicatesAcrossRows } from './spreadsheet/duplicate-detector.js';
import { calculateReimportDiff } from './spreadsheet/diff-calculator.js';
import { RESOURCE_LIMITS } from '../constants/limits.js';

/* -------------------------------------------------------------------------- */
/*                               Typed Domain Errors                          */
/* -------------------------------------------------------------------------- */

/**
 * Thrown when a Batch or BatchImport entity cannot be found or does not belong to the user.
 * @class BatchNotFoundError
 * @extends {Error}
 */
export class BatchNotFoundError extends Error {
  code: string;
  constructor(message = 'Batch or import not found') {
    super(message);
    this.name = 'BatchNotFoundError';
    this.code = 'BATCH_NOT_FOUND';
    Object.setPrototypeOf(this, BatchNotFoundError.prototype);
  }
}

/**
 * Thrown when optimistic concurrency control fails (version or revision mismatch).
 * @class ConcurrencyConflictError
 * @extends {Error}
 */
export class ConcurrencyConflictError extends Error {
  code: string;
  constructor(message: string, code = 'CONCURRENCY_CONFLICT') {
    super(message);
    this.name = 'ConcurrencyConflictError';
    this.code = code;
    Object.setPrototypeOf(this, ConcurrencyConflictError.prototype);
  }
}

/**
 * Thrown when chunk counts or row counts do not match expected totals on finalization.
 * @class ChunkMismatchError
 * @extends {Error}
 */
export class ChunkMismatchError extends Error {
  code: string;
  constructor(message: string, code = 'IMPORT_CHUNK_MISMATCH') {
    super(message);
    this.name = 'ChunkMismatchError';
    this.code = code;
    Object.setPrototypeOf(this, ChunkMismatchError.prototype);
  }
}

/**
 * Thrown when intake payload parameters fail validation.
 * @class BatchIntakeValidationError
 * @extends {Error}
 */
export class BatchIntakeValidationError extends Error {
  code: string;
  constructor(message: string, code = 'BATCH_INTAKE_VALIDATION_ERROR') {
    super(message);
    this.name = 'BatchIntakeValidationError';
    this.code = code;
    Object.setPrototypeOf(this, BatchIntakeValidationError.prototype);
  }
}

/* -------------------------------------------------------------------------- */
/*                            Interfaces & Payloads                           */
/* -------------------------------------------------------------------------- */

export interface IngestChunkRowInput {
  sourceRowNumber: number;
  rowKey?: string;
  importedData: Record<string, any>;
}

export interface IngestChunkInput {
  batchId: string | mongoose.Types.ObjectId;
  importId: string | mongoose.Types.ObjectId;
  ownerId: string;
  chunkId: string;
  totalChunks?: number;
  rows: IngestChunkRowInput[];
}

export interface IngestChunkResult {
  chunkId: string;
  processed: number;
  idempotent: boolean;
  message?: string;
}

export interface FinalizeImportInput {
  batchId: string | mongoose.Types.ObjectId;
  importId: string | mongoose.Types.ObjectId;
  ownerId: string;
  totalExpectedRows?: number;
  totalExpectedChunks?: number;
  columnMap?: Record<string, string>;
  dateFormatHints?: Record<string, string>;
  promote?: boolean;
}

export interface FinalizeImportSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
}

export interface FinalizeImportResult {
  batch: IBatch;
  batchImport: IBatchImport;
  summary: FinalizeImportSummary;
}

/* -------------------------------------------------------------------------- */
/*                           BatchIntake Implementation                       */
/* -------------------------------------------------------------------------- */

/**
 * Ingests a single chunk of spreadsheet rows with authoritative validation and DraftRow upsert.
 * Performs idempotent deduplication if chunkId was already recorded.
 * 
 * @desc Ingests a chunk of raw rows, validates each against template rules, and upserts DraftRow documents.
 * @param {IngestChunkInput} input - Parameters containing batchId, importId, chunkId, and row data items.
 * @returns {Promise<IngestChunkResult>} Ingestion result with processed count and idempotency flag.
 * @throws {BatchIntakeValidationError} If chunkId or rows payload are missing or malformed.
 * @throws {BatchNotFoundError} If the batch or import revision does not exist or access is unauthorized.
 */
export async function ingestChunk(input: IngestChunkInput): Promise<IngestChunkResult> {
  const { batchId, importId, ownerId, chunkId, totalChunks, rows } = input;

  if (!chunkId || typeof chunkId !== 'string' || chunkId.trim() === '') {
    throw new BatchIntakeValidationError('chunkId is required', 'INVALID_CHUNK_ID');
  }
  if (!Array.isArray(rows)) {
    throw new BatchIntakeValidationError('rows array is required', 'INVALID_ROWS');
  }
  if (rows.length > RESOURCE_LIMITS.MAX_BATCH_ROWS) {
    throw new BatchIntakeValidationError(
      `Row limit exceeded. Maximum supported rows per batch is ${RESOURCE_LIMITS.MAX_BATCH_ROWS}.`,
      'ROW_LIMIT_EXCEEDED'
    );
  }

  const [batchImport, batch] = await Promise.all([
    BatchImport.findOne({
      _id: importId,
      batchId,
      ownerId,
    }),
    Batch.findOne({
      _id: batchId,
      ownerId,
    }),
  ]);

  if (!batchImport) {
    throw new BatchNotFoundError('Import not found or access denied');
  }
  if (!batch) {
    throw new BatchNotFoundError('Batch not found or access denied');
  }

  // Idempotency check: If chunkId already received, return success immediately
  if (batchImport.receivedChunkIds.includes(chunkId)) {
    return {
      chunkId,
      processed: rows.length,
      idempotent: true,
      message: 'Chunk already processed',
    };
  }

  const templateVersion = (await TemplateVersion.findById(batch.templateVersionId).lean()) as any;
  const fieldMappings: FieldMappingItem[] = templateVersion?.fieldMappings || [];

  const bulkOps = [];
  for (const row of rows) {
    const sourceRowNumber = row.sourceRowNumber;
    if (sourceRowNumber > RESOURCE_LIMITS.MAX_BATCH_ROWS) {
      throw new BatchIntakeValidationError(
        `Row limit exceeded. Maximum supported rows per batch is ${RESOURCE_LIMITS.MAX_BATCH_ROWS}.`,
        'ROW_LIMIT_EXCEEDED'
      );
    }
    const rowKey = row.rowKey || `row_${sourceRowNumber}`;
    const importedData = row.importedData || {};

    // Authoritative server-side validation against template fieldMappings and dateFormatHints
    const validation = validateDraftRow({
      rowData: importedData,
      sourceRowNumber,
      fieldMappings,
      columnMap: batchImport.columnMap || {},
      dateFormatHints: (batchImport as any).dateFormatHints || {},
    });

    bulkOps.push({
      updateOne: {
        filter: { importId: batchImport._id, rowKey },
        update: {
          $set: {
            batchId: batch._id,
            importId: batchImport._id,
            ownerId,
            revision: batchImport.revision,
            rowKey,
            sourceRowNumber,
            importedData,
            effectiveData: validation.effectiveData,
            status: validation.status,
            errors: validation.errors,
            warnings: [],
            isDuplicate: false,
            duplicateReferences: [],
            version: 1,
          },
        },
        upsert: true,
      },
    });
  }

  if (bulkOps.length > 0) {
    await DraftRow.bulkWrite(bulkOps, { ordered: false });
  }

  // Atomically record chunkId via $addToSet and update totalExpectedChunks under $set if provided
  const updateDoc: any = {
    $addToSet: { receivedChunkIds: chunkId },
  };
  if (totalChunks !== undefined) {
    updateDoc.$set = { totalExpectedChunks: totalChunks };
  }
  await BatchImport.updateOne({ _id: batchImport._id }, updateDoc);

  return {
    chunkId,
    processed: rows.length,
    idempotent: false,
  };
}

/**
 * Finalizes chunked import: validates expected totals, runs batch-wide duplicate detection,
 * recalculates authoritative counters, and transitions batch to 'review' status.
 * 
 * @desc Finalizes spreadsheet intake session, verifies row/chunk integrity, runs duplicate checks, and rolls up metrics.
 * @param {FinalizeImportInput} input - Parameters containing batchId, importId, expected counts, and column map.
 * @returns {Promise<FinalizeImportResult>} Updated batch, finalized batchImport, and calculated counters summary.
 * @throws {BatchNotFoundError} If batch or import does not exist or access is unauthorized.
 * @throws {ChunkMismatchError} If actual received chunks or persisted rows do not match declared totals.
 */
export async function finalizeImport(input: FinalizeImportInput): Promise<FinalizeImportResult> {
  const { batchId, importId, ownerId, totalExpectedRows, totalExpectedChunks, columnMap, dateFormatHints, promote } = input;

  const [batchImport, batch] = await Promise.all([
    BatchImport.findOne({
      _id: importId,
      batchId,
      ownerId,
    }),
    Batch.findOne({
      _id: batchId,
      ownerId,
    }),
  ]);

  if (!batchImport) {
    throw new BatchNotFoundError('Import not found or access denied');
  }
  if (!batch) {
    throw new BatchNotFoundError('Batch not found or access denied');
  }

  if (columnMap) {
    batchImport.columnMap = columnMap;
  }
  if (dateFormatHints) {
    batchImport.dateFormatHints = dateFormatHints;
  }

  // Finalization chunk count validation
  if (totalExpectedChunks !== undefined) {
    if (batchImport.receivedChunkIds.length !== totalExpectedChunks) {
      throw new ChunkMismatchError(
        `Chunk mismatch: expected ${totalExpectedChunks} chunks, received ${batchImport.receivedChunkIds.length}`,
        'IMPORT_CHUNK_MISMATCH'
      );
    }
  }

  // Finalization row count validation
  const actualRowCount = await DraftRow.countDocuments({ importId: batchImport._id });
  if (totalExpectedRows !== undefined) {
    if (actualRowCount !== totalExpectedRows) {
      throw new ChunkMismatchError(
        `Row count mismatch: expected ${totalExpectedRows} rows, persisted ${actualRowCount}`,
        'IMPORT_CHUNK_MISMATCH'
      );
    }
  }

  // Enforce MAX_BATCH_ROWS ceiling on total validated rows
  if (actualRowCount > RESOURCE_LIMITS.MAX_BATCH_ROWS) {
    throw new BatchIntakeValidationError(
      `Row limit exceeded. Maximum supported rows per batch is ${RESOURCE_LIMITS.MAX_BATCH_ROWS}.`,
      'ROW_LIMIT_EXCEEDED'
    );
  }

  // Fetch template and revalidate all rows against current columnMap & dateFormatHints
  const templateVersion = (await TemplateVersion.findById(batch.templateVersionId).lean()) as any;
  const fieldMappings: FieldMappingItem[] = templateVersion?.fieldMappings || [];
  const effectiveColumnMap = batchImport.columnMap || {};
  const effectiveDateHints = (batchImport as any).dateFormatHints || {};

  const allRows = await DraftRow.find({ importId: batchImport._id })
    .sort({ sourceRowNumber: 1 });

  // 1. Run authoritative validation in memory
  const validatedRowsInMemory = allRows.map((row) => {
    const validation = validateDraftRow({
      rowData: row.importedData || {},
      sourceRowNumber: row.sourceRowNumber,
      fieldMappings,
      columnMap: effectiveColumnMap,
      dateFormatHints: effectiveDateHints,
    });
    row.effectiveData = validation.effectiveData;
    row.status = validation.status;
    row.errors = validation.errors as any;
    return {
      _id: row._id,
      sourceRowNumber: row.sourceRowNumber,
      importedData: row.importedData,
      effectiveData: validation.effectiveData,
      status: validation.status,
      errors: validation.errors,
    };
  });

  // 2. Run batch-wide duplicate detection in memory
  const duplicateChecked = detectDuplicatesAcrossRows(validatedRowsInMemory as any[]);

  // 3. Single consolidated DraftRow.bulkWrite
  const consolidatedBulkOps = [];
  for (const r of duplicateChecked) {
    consolidatedBulkOps.push({
      updateOne: {
        filter: { _id: r._id },
        update: {
          $set: {
            effectiveData: r.effectiveData,
            status: r.status,
            errors: r.errors,
            isDuplicate: r.isDuplicate,
            duplicateReferences: r.duplicateReferences || [],
            warnings: r.warnings || [],
          },
        },
      },
    });
  }

  if (consolidatedBulkOps.length > 0) {
    await DraftRow.bulkWrite(consolidatedBulkOps, { ordered: false });
  }

  // Authoritative counters calculation
  const validCount = duplicateChecked.filter((r) => r.status === 'valid').length;
  const invalidCount = duplicateChecked.filter((r) => r.status === 'invalid').length;
  const duplicateCount = duplicateChecked.filter((r) => r.isDuplicate).length;

  batchImport.status = 'completed';
  batchImport.rowCount = actualRowCount;
  batchImport.validCount = validCount;
  batchImport.invalidCount = invalidCount;
  batchImport.duplicateCount = duplicateCount;
  await batchImport.save();

  // Promote batch fields only on first import or explicit promote request
  const isFirstImport = !batch.currentImportRevision || batch.currentImportRevision === 0 || batchImport.revision === 1;
  const shouldPromoteBatch = isFirstImport || promote === true;

  if (shouldPromoteBatch) {
    batch.currentImportRevision = batchImport.revision;
    batch.status = 'review';
    batch.totalRows = actualRowCount;
    batch.validRows = validCount;
    batch.invalidRows = invalidCount;
    batch.duplicateRows = duplicateCount;
    await batch.save();
  }

  return {
    batch,
    batchImport,
    summary: {
      totalRows: actualRowCount,
      validRows: validCount,
      invalidRows: invalidCount,
      duplicateRows: duplicateCount,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                           Row Override Implementation                      */
/* -------------------------------------------------------------------------- */

export interface PatchRowOverrideInput {
  batchId: string | mongoose.Types.ObjectId;
  rowId: string | mongoose.Types.ObjectId;
  ownerId: string;
  overrides: Record<string, any>;
  expectedRevision?: number;
  expectedVersion?: number;
}

export interface PatchRowOverrideResult {
  row: any;
  batch: IBatch;
  batchSummary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
  };
}

/**
 * Authoritatively recomputes all four batch summary counters directly from DraftRow collection.
 * 
 * @desc Counts valid, invalid, duplicate, and total draft rows for a batch revision.
 * @param {mongoose.Types.ObjectId | string} batchId - Batch document ID.
 * @param {number} revision - Import revision number to query.
 * @returns {Promise<{ validRows: number; invalidRows: number; duplicateRows: number; totalRows: number }>} Aggregated counts.
 */
async function recalculateBatchCounters(
  batchId: mongoose.Types.ObjectId | string,
  revision: number
): Promise<{
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  totalRows: number;
}> {
  const [validRows, invalidRows, duplicateRows, totalRows] = await Promise.all([
    DraftRow.countDocuments({ batchId, revision, status: 'valid' }),
    DraftRow.countDocuments({ batchId, revision, status: 'invalid' }),
    DraftRow.countDocuments({ batchId, revision, isDuplicate: true }),
    DraftRow.countDocuments({ batchId, revision }),
  ]);
  return { validRows, invalidRows, duplicateRows, totalRows };
}

/**
 * Applies manual overrides to a draft row with CAS revision and version protection,
 * re-validates effective data, invalidates stale approvals, and recomputes batch counters.
 * 
 * @desc Updates a draft row with human cell overrides under optimistic concurrency locks.
 * @param {PatchRowOverrideInput} input - Parameters containing rowId, overrides dictionary, expectedRevision, and expectedVersion.
 * @returns {Promise<PatchRowOverrideResult>} Updated DraftRow, parent Batch, and fresh metric summary.
 * @throws {BatchNotFoundError} If the batch or draft row is not found.
 * @throws {ConcurrencyConflictError} If revision or row version CAS check fails (409 conflict).
 */
export async function patchRowOverride(input: PatchRowOverrideInput): Promise<PatchRowOverrideResult> {
  const { batchId, rowId, ownerId, overrides, expectedRevision, expectedVersion } = input;

  const batch = await Batch.findOne({ _id: batchId, ownerId });
  if (!batch) {
    throw new BatchNotFoundError('Batch not found or access denied');
  }

  if (batch.status === 'generating' || batch.status === 'ready_for_download') {
    throw new ConcurrencyConflictError(
      'Cannot edit row while batch generation is in progress',
      'BATCH_GENERATION_IN_PROGRESS'
    );
  }

  if (expectedRevision !== undefined && batch.currentImportRevision !== expectedRevision) {
    throw new ConcurrencyConflictError('Stale batch revision', 'STALE_BATCH_REVISION');
  }

  const row = await DraftRow.findOne({ _id: rowId, batchId: batch._id });
  if (!row) {
    throw new BatchNotFoundError('Row not found or access denied');
  }

  const targetVersion = expectedVersion !== undefined ? expectedVersion : row.version;
  if (expectedVersion !== undefined && row.version !== expectedVersion) {
    throw new ConcurrencyConflictError('Concurrent row modification', 'CONCURRENT_MODIFICATION');
  }

  // Merge overrides
  const currentOverrides = (row.overrides as Record<string, any>) || {};
  if (overrides && typeof overrides === 'object') {
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null || v === undefined) {
        delete currentOverrides[k];
      } else {
        currentOverrides[k] = v;
      }
    }
  }

  // Fetch TemplateVersion and BatchImport to recompute effective data
  const [templateVersion, batchImport] = await Promise.all([
    TemplateVersion.findById(batch.templateVersionId).lean(),
    BatchImport.findOne({ batchId: batch._id, revision: batch.currentImportRevision }).lean(),
  ]);

  const fieldMappings = (templateVersion as any)?.fieldMappings || [];
  const columnMap = (batchImport as any)?.columnMap || {};
  const dateFormatHints = (batchImport as any)?.dateFormatHints || {};

  const combinedData: Record<string, any> = {};
  const effectiveColumnMap: Record<string, string> = {};

  for (const f of fieldMappings) {
    if (currentOverrides && currentOverrides[f.key] !== undefined) {
      combinedData[f.key] = currentOverrides[f.key];
      effectiveColumnMap[f.key] = f.key;
    } else if (columnMap[f.key]) {
      const sheetCol = columnMap[f.key];
      combinedData[f.key] = row.importedData?.[sheetCol];
      effectiveColumnMap[f.key] = f.key;
    } else if (row.importedData && row.importedData[f.key] !== undefined) {
      combinedData[f.key] = row.importedData[f.key];
      effectiveColumnMap[f.key] = f.key;
    }
  }

  const validation = validateDraftRow({
    rowData: combinedData,
    sourceRowNumber: row.sourceRowNumber,
    fieldMappings,
    columnMap: effectiveColumnMap,
    dateFormatHints,
  });

  // Atomic write conditioned on targetVersion (optimistic lock without check-then-save race)
  const updatedRow = await DraftRow.findOneAndUpdate(
    {
      _id: rowId,
      batchId: batch._id,
      version: targetVersion,
    },
    {
      $set: {
        overrides: currentOverrides,
        effectiveData: validation.effectiveData,
        errors: validation.errors,
        status: validation.status,
      },
      $inc: { version: 1 },
    },
    { new: true }
  );

  if (!updatedRow) {
    throw new ConcurrencyConflictError('Concurrent row modification', 'CONCURRENT_MODIFICATION');
  }

  // Invalidate approval state
  if (batch.approvedSnapshotId || batch.status === 'awaiting_approval' || batch.status === 'approved') {
    if (batch.approvedSnapshotId) {
      await ApprovedSnapshot.findByIdAndUpdate(batch.approvedSnapshotId, { status: 'superseded' });
    }
    batch.approvedSnapshotId = null as any;
    batch.status = 'review';
  }

  // Run duplicate detection on current revision's rows after override
  const currentRevisionRows = await DraftRow.find({
    batchId: batch._id,
    revision: batch.currentImportRevision,
  })
    .sort({ sourceRowNumber: 1 })
    .lean();

  // Snapshot relevant persisted duplicate/warning fields before duplicate detection
  const oldRowMap = new Map<string, { isDuplicate: boolean; duplicateReferences: number[]; warnings: any[] }>();
  for (const row of currentRevisionRows) {
    oldRowMap.set(String(row._id), {
      isDuplicate: Boolean(row.isDuplicate),
      duplicateReferences: Array.isArray(row.duplicateReferences) ? [...row.duplicateReferences] : [],
      warnings: Array.isArray(row.warnings) ? JSON.parse(JSON.stringify(row.warnings)) : [],
    });
  }

  const duplicateChecked = detectDuplicatesAcrossRows(currentRevisionRows as any[]);

  const selectiveBulkOps = [];
  for (const r of duplicateChecked) {
    const oldR = oldRowMap.get(String(r._id));
    const isDuplicateChanged = !oldR || oldR.isDuplicate !== Boolean(r.isDuplicate);
    const duplicateRefsChanged =
      !oldR || JSON.stringify(oldR.duplicateReferences) !== JSON.stringify(r.duplicateReferences || []);
    const warningsChanged =
      !oldR || JSON.stringify(oldR.warnings) !== JSON.stringify(r.warnings || []);

    if (isDuplicateChanged || duplicateRefsChanged || warningsChanged) {
      selectiveBulkOps.push({
        updateOne: {
          filter: { _id: r._id },
          update: {
            $set: {
              isDuplicate: r.isDuplicate,
              duplicateReferences: r.duplicateReferences || [],
              warnings: r.warnings || [],
            },
          },
        },
      });
    }
  }

  if (selectiveBulkOps.length > 0) {
    await DraftRow.bulkWrite(selectiveBulkOps, { ordered: false });
  }

  const thisRowChecked = duplicateChecked.find((r) => r._id.toString() === rowId.toString());
  if (thisRowChecked) {
    updatedRow.isDuplicate = thisRowChecked.isDuplicate;
    updatedRow.duplicateReferences = thisRowChecked.duplicateReferences || [];
    updatedRow.warnings = thisRowChecked.warnings || [];
  }

  // Recompute batch counts authoritatively
  const counters = await recalculateBatchCounters(batch._id, batch.currentImportRevision);
  batch.validRows = counters.validRows;
  batch.invalidRows = counters.invalidRows;
  batch.duplicateRows = counters.duplicateRows;
  batch.totalRows = counters.totalRows;
  await batch.save();

  return {
    row: updatedRow,
    batch,
    batchSummary: counters,
  };
}

/* -------------------------------------------------------------------------- */
/*                     Re-import Reconciliation Implementation                */
/* -------------------------------------------------------------------------- */

export interface ReconcileResolutions {
  conflicts?: Array<{
    newRowId: string;
    field: string;
    resolution: 'keep_override' | 'use_new_imported';
  }>;
  ambiguous?: Array<{
    newRowId: string;
    action: 'discard' | 'match_old';
    matchedOldRowId?: string;
  }>;
  carryForwardOverrides?: boolean;
}

export interface ReconcileImportRevisionInput {
  batchId: string | mongoose.Types.ObjectId;
  importId: string | mongoose.Types.ObjectId;
  ownerId: string;
  reconciliationKey?: string;
  resolutions?: ReconcileResolutions;
}

export interface ReconcileImportRevisionResult {
  batch: IBatch;
  newImport: IBatchImport;
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
  };
}

/**
 * Reconciles a newly uploaded import revision against the current batch revision,
 * transferring overrides, resolving conflicts/ambiguities, running duplicate checks,
 * and authoritatively updating batch and import counters.
 * 
 * @desc Executes multi-revision reconciliation: applies conflict decisions, transfers prior overrides,
 *       revalidates rows, checks duplicates, and atomically switches the batch's active revision.
 * @param {ReconcileImportRevisionInput} input - Parameters containing batchId, importId, reconciliationKey, and resolutions.
 * @returns {Promise<ReconcileImportRevisionResult>} Updated Batch, new BatchImport, and rolled-up metric summary.
 * @throws {BatchNotFoundError} If batch or import does not exist.
 * @throws {ChunkMismatchError} If new import is incomplete.
 * @throws {ConcurrencyConflictError} If new import revision is not strictly greater than current batch revision.
 */
export async function reconcileImportRevision(
  input: ReconcileImportRevisionInput
): Promise<ReconcileImportRevisionResult> {
  const { batchId, importId, ownerId, reconciliationKey: reqKey, resolutions } = input;

  const batch = await Batch.findOne({ _id: batchId, ownerId });
  if (!batch) {
    throw new BatchNotFoundError('Batch not found or access denied');
  }

  const newImport = await BatchImport.findOne({ _id: importId, batchId: batch._id });
  if (!newImport) {
    throw new BatchNotFoundError('Import not found or access denied');
  }

  // Reject imports that are not completed and whose receivedChunkIds count does not match totalExpectedChunks when chunks are expected
  if (
    newImport.status !== 'completed' &&
    newImport.totalExpectedChunks > 0 &&
    newImport.receivedChunkIds.length !== newImport.totalExpectedChunks
  ) {
    throw new ChunkMismatchError(
      `Cannot reconcile incomplete import: expected ${newImport.totalExpectedChunks} chunks, received ${newImport.receivedChunkIds.length}`,
      'IMPORT_CHUNK_MISMATCH'
    );
  }

  // Reject any import whose revision is not newer than batch.currentImportRevision
  if (newImport.revision <= (batch.currentImportRevision || 0)) {
    throw new ConcurrencyConflictError(
      `Import revision (${newImport.revision}) must be newer than current batch revision (${batch.currentImportRevision || 0})`,
      'STALE_IMPORT_REVISION'
    );
  }

  const templateVersion = await TemplateVersion.findById(batch.templateVersionId).lean();
  const fieldMappings: FieldMappingItem[] = (templateVersion as any)?.fieldMappings || [];
  const reconciliationKey = reqKey || fieldMappings[0]?.key || 'studentId';

  const [oldRows, newRows, oldImport] = await Promise.all([
    DraftRow.find({ batchId: batch._id, revision: batch.currentImportRevision }),
    DraftRow.find({ batchId: batch._id, revision: newImport.revision }),
    BatchImport.findOne({ batchId: batch._id, revision: batch.currentImportRevision }).lean(),
  ]);

  const oldColumnMap = (oldImport as any)?.columnMap || {};
  const newColumnMap = newImport.columnMap || {};

  const diffResult = calculateReimportDiff(
    oldRows.map((r: any) => r.toObject()),
    newRows.map((r: any) => r.toObject()),
    reconciliationKey,
    fieldMappings,
    { oldColumnMap, newColumnMap }
  );

  const oldRowMap = new Map<string, any>();
  for (const r of oldRows) {
    oldRowMap.set(r._id.toString(), r);
  }
  const newRowMap = new Map<string, any>();
  for (const r of newRows) {
    newRowMap.set(r._id.toString(), r);
  }

  const conflictResolutions = resolutions?.conflicts || [];
  const ambiguousResolutions = resolutions?.ambiguous || [];
  const carryForwardOverrides = resolutions?.carryForwardOverrides !== false;

  const matchedNewToOld = new Map<string, string>();
  for (const u of diffResult.unchanged) matchedNewToOld.set(u.newRowId, u.oldRowId);
  for (const ch of diffResult.changed) matchedNewToOld.set(ch.newRowId, ch.oldRowId);
  for (const co of diffResult.conflicted) matchedNewToOld.set(co.newRowId, co.oldRowId);

  const rowsToDelete = new Set<string>();
  for (const amb of ambiguousResolutions) {
    const { newRowId, action, matchedOldRowId } = amb;
    if (action === 'discard' && newRowMap.has(newRowId)) {
      rowsToDelete.add(newRowId);
    } else if (action === 'match_old' && matchedOldRowId) {
      matchedNewToOld.set(newRowId, matchedOldRowId);
    }
  }

  const resolvedConflictMap = new Map<string, 'keep_override' | 'use_new_imported'>();
  for (const cr of conflictResolutions) {
    resolvedConflictMap.set(`${cr.newRowId}:${cr.field}`, cr.resolution);
  }

  const affectedNewRows = new Set<string>();

  for (const [newRowId, oldRowId] of matchedNewToOld.entries()) {
    if (rowsToDelete.has(newRowId)) continue;
    const newRow = newRowMap.get(newRowId);
    const oldRow = oldRowMap.get(oldRowId);
    if (!newRow || !oldRow) continue;

    const currentOverrides: Record<string, any> = { ...newRow.overrides };
    let changedOverrides = false;

    if (carryForwardOverrides && oldRow.overrides) {
      for (const [field, val] of Object.entries(oldRow.overrides)) {
        const conflictKey = `${newRowId}:${field}`;
        if (resolvedConflictMap.has(conflictKey)) continue;
        currentOverrides[field] = val;
        changedOverrides = true;
      }
    }

    for (const cr of conflictResolutions) {
      if (cr.newRowId === newRowId) {
        if (cr.resolution === 'keep_override') {
          const overrideVal = oldRow.overrides?.[cr.field];
          if (overrideVal !== undefined) {
            currentOverrides[cr.field] = overrideVal;
            changedOverrides = true;
          }
        } else if (cr.resolution === 'use_new_imported') {
          delete currentOverrides[cr.field];
          changedOverrides = true;
        }
      }
    }

    if (changedOverrides || Object.keys(currentOverrides).length > 0) {
      newRow.overrides = currentOverrides;
      newRow.markModified('overrides');
      affectedNewRows.add(newRowId);
    }
  }

  if (rowsToDelete.size > 0) {
    await DraftRow.deleteMany({
      _id: { $in: Array.from(rowsToDelete) },
      batchId: batch._id,
      revision: newImport.revision,
    });
  }

  const reconcileBulkOps = [];
  for (const newRowId of affectedNewRows) {
    const newRow = newRowMap.get(newRowId);
    if (!newRow || rowsToDelete.has(newRowId)) continue;

    const combinedData: Record<string, any> = {};
    const effectiveColumnMap: Record<string, string> = {};

    for (const f of fieldMappings) {
      if (newRow.overrides && newRow.overrides[f.key] !== undefined) {
        combinedData[f.key] = newRow.overrides[f.key];
        effectiveColumnMap[f.key] = f.key;
      } else if (newColumnMap[f.key] && newRow.importedData?.[newColumnMap[f.key]] !== undefined) {
        combinedData[f.key] = newRow.importedData[newColumnMap[f.key]];
        effectiveColumnMap[f.key] = f.key;
      } else if (newRow.importedData && newRow.importedData[f.key] !== undefined) {
        combinedData[f.key] = newRow.importedData[f.key];
        effectiveColumnMap[f.key] = f.key;
      }
    }

    const validation = validateDraftRow({
      rowData: combinedData,
      sourceRowNumber: newRow.sourceRowNumber,
      fieldMappings,
      columnMap: effectiveColumnMap,
      dateFormatHints: (newImport as any).dateFormatHints || {},
    });

    const updatedVersion = (newRow.version || 1) + 1;
    newRow.effectiveData = validation.effectiveData;
    newRow.errors = validation.errors as any;
    newRow.status = validation.status;
    newRow.version = updatedVersion;

    reconcileBulkOps.push({
      updateOne: {
        filter: { _id: newRow._id },
        update: {
          $set: {
            overrides: newRow.overrides,
            effectiveData: validation.effectiveData,
            errors: validation.errors,
            status: validation.status,
            version: updatedVersion,
          },
        },
      },
    });
  }

  if (reconcileBulkOps.length > 0) {
    await DraftRow.bulkWrite(reconcileBulkOps, { ordered: false });
  }

  // Duplicate detection on surviving rows for new revision
  const survivingRows = await DraftRow.find({
    batchId: batch._id,
    revision: newImport.revision,
  })
    .sort({ sourceRowNumber: 1 })
    .lean();
  const duplicateChecked = detectDuplicatesAcrossRows(survivingRows as any[]);

  const duplicateBulkOps = [];
  for (const r of duplicateChecked) {
    duplicateBulkOps.push({
      updateOne: {
        filter: { _id: r._id },
        update: {
          $set: {
            isDuplicate: r.isDuplicate,
            duplicateReferences: r.duplicateReferences || [],
            warnings: r.warnings || [],
          },
        },
      },
    });
  }
  if (duplicateBulkOps.length > 0) {
    await DraftRow.bulkWrite(duplicateBulkOps, { ordered: false });
  }

  // Commit batch state
  batch.currentImportRevision = newImport.revision;
  batch.approvedSnapshotId = null as any;
  batch.status = 'review';

  // Authoritative counter rollup
  const counters = await recalculateBatchCounters(batch._id, newImport.revision);
  batch.validRows = counters.validRows;
  batch.invalidRows = counters.invalidRows;
  batch.duplicateRows = counters.duplicateRows;
  batch.totalRows = counters.totalRows;
  batch.version = (batch.version || 1) + 1;
  await batch.save();

  newImport.status = 'completed';
  newImport.rowCount = counters.totalRows;
  newImport.validCount = counters.validRows;
  newImport.invalidCount = counters.invalidRows;
  newImport.duplicateCount = counters.duplicateRows;
  await newImport.save();

  return {
    batch,
    newImport,
    summary: counters,
  };
}

export interface GetReimportDiffInput {
  batchId: string | mongoose.Types.ObjectId;
  importId: string | mongoose.Types.ObjectId;
  ownerId: string;
  reconciliationKey?: string;
}

/**
 * Calculates a 4-way diff classification (unchanged, changed, conflicted, added, removed, ambiguous)
 * between the current revision and a prospective new import revision without persisting changes.
 * 
 * @desc Previews structural and content differences between active and prospective import revisions.
 * @param {GetReimportDiffInput} input - Parameters containing batchId, importId, ownerId, and reconciliationKey.
 * @returns {Promise<import('./spreadsheet/diff-calculator.js').ReimportDiffResult>} Categorized reconciliation diff sets.
 * @throws {BatchNotFoundError} If batch or import revision is not found.
 */
export async function getReimportDiff(input: GetReimportDiffInput) {
  const { batchId, importId, ownerId, reconciliationKey: reqKey } = input;

  const batch = await Batch.findOne({ _id: batchId, ownerId });
  if (!batch) throw new BatchNotFoundError('Batch not found or access denied');

  const newImport = await BatchImport.findOne({ _id: importId, batchId: batch._id });
  if (!newImport) throw new BatchNotFoundError('Import not found or access denied');

  const templateVersion = await TemplateVersion.findById(batch.templateVersionId).lean();
  const fieldMappings: FieldMappingItem[] = (templateVersion as any)?.fieldMappings || [];
  const reconciliationKey = reqKey || fieldMappings[0]?.key || 'studentId';

  const [oldRows, newRows, oldImport] = await Promise.all([
    DraftRow.find({ batchId: batch._id, revision: batch.currentImportRevision }).lean(),
    DraftRow.find({ batchId: batch._id, revision: newImport.revision }).lean(),
    BatchImport.findOne({ batchId: batch._id, revision: batch.currentImportRevision }).lean(),
  ]);

  return calculateReimportDiff(
    oldRows as any[],
    newRows as any[],
    reconciliationKey,
    fieldMappings,
    {
      oldColumnMap: (oldImport as any)?.columnMap || {},
      newColumnMap: newImport.columnMap || {},
    }
  );
}

/**
 * @module BatchIntake
 * @description Domain service namespace packaging bulk spreadsheet intake and reconciliation operations.
 */
export const BatchIntake = {
  ingestChunk,
  finalizeImport,
  patchRowOverride,
  reconcileImportRevision,
  getReimportDiff,
};

