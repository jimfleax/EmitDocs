import mongoose from 'mongoose';
import { Batch, IBatch } from '../models/Batch.js';
import { BatchImport, IBatchImport } from '../models/BatchImport.js';
import { DraftRow } from '../models/DraftRow.js';
import { TemplateVersion } from '../models/TemplateVersion.js';
import { validateDraftRow, FieldMappingItem } from './spreadsheet/row-validator.js';
import { detectDuplicatesAcrossRows } from './spreadsheet/duplicate-detector.js';
import { calculateReimportDiff } from './spreadsheet/diff-calculator.js';

/* -------------------------------------------------------------------------- */
/*                               Typed Domain Errors                          */
/* -------------------------------------------------------------------------- */

/**
 * Thrown when a Batch or BatchImport entity cannot be found or does not belong to the user.
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
 */
export async function ingestChunk(input: IngestChunkInput): Promise<IngestChunkResult> {
  const { batchId, importId, ownerId, chunkId, totalChunks, rows } = input;

  if (!chunkId || typeof chunkId !== 'string' || chunkId.trim() === '') {
    throw new BatchIntakeValidationError('chunkId is required', 'INVALID_CHUNK_ID');
  }
  if (!Array.isArray(rows)) {
    throw new BatchIntakeValidationError('rows array is required', 'INVALID_ROWS');
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
    const rowKey = row.rowKey || `row_${sourceRowNumber}`;
    const importedData = row.importedData || {};

    // Authoritative server-side validation against template fieldMappings
    const validation = validateDraftRow({
      rowData: importedData,
      sourceRowNumber,
      fieldMappings,
      columnMap: batchImport.columnMap || {},
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

  // Atomically append chunkId
  await BatchImport.updateOne(
    { _id: batchImport._id },
    {
      $push: { receivedChunkIds: chunkId },
      ...(totalChunks !== undefined ? { totalExpectedChunks: totalChunks } : {}),
    }
  );

  return {
    chunkId,
    processed: rows.length,
    idempotent: false,
  };
}

/**
 * Finalizes chunked import: validates expected totals, runs batch-wide duplicate detection,
 * recalculates authoritative counters, and transitions batch to 'review' status.
 */
export async function finalizeImport(input: FinalizeImportInput): Promise<FinalizeImportResult> {
  const { batchId, importId, ownerId, totalExpectedRows, totalExpectedChunks, columnMap } = input;

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

  // Run batch-wide duplicate detection
  const allRows = await DraftRow.find({ importId: batchImport._id })
    .sort({ sourceRowNumber: 1 })
    .lean();

  const duplicateChecked = detectDuplicatesAcrossRows(allRows as any[]);

  const duplicateBulkOps = [];
  for (const r of duplicateChecked) {
    if (r.isDuplicate) {
      duplicateBulkOps.push({
        updateOne: {
          filter: { _id: r._id },
          update: {
            $set: {
              isDuplicate: true,
              duplicateReferences: r.duplicateReferences,
              warnings: r.warnings,
            },
          },
        },
      });
    }
  }

  if (duplicateBulkOps.length > 0) {
    await DraftRow.bulkWrite(duplicateBulkOps, { ordered: false });
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

  batch.currentImportRevision = batchImport.revision;
  batch.status = 'review';
  batch.totalRows = actualRowCount;
  batch.validRows = validCount;
  batch.invalidRows = invalidCount;
  batch.duplicateRows = duplicateCount;
  await batch.save();

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
 */
export async function patchRowOverride(input: PatchRowOverrideInput): Promise<PatchRowOverrideResult> {
  const { batchId, rowId, ownerId, overrides, expectedRevision, expectedVersion } = input;

  const batch = await Batch.findOne({ _id: batchId, ownerId });
  if (!batch) {
    throw new BatchNotFoundError('Batch not found or access denied');
  }

  if (expectedRevision !== undefined && batch.currentImportRevision !== expectedRevision) {
    throw new ConcurrencyConflictError('Stale batch revision', 'STALE_BATCH_REVISION');
  }

  const row = await DraftRow.findOne({ _id: rowId, batchId: batch._id });
  if (!row) {
    throw new BatchNotFoundError('Row not found or access denied');
  }

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
  row.overrides = currentOverrides;
  row.markModified('overrides');

  // Fetch TemplateVersion and BatchImport to recompute effective data
  const [templateVersion, batchImport] = await Promise.all([
    TemplateVersion.findById(batch.templateVersionId).lean(),
    BatchImport.findOne({ batchId: batch._id, revision: batch.currentImportRevision }).lean(),
  ]);

  const fieldMappings = (templateVersion as any)?.fieldMappings || [];
  const columnMap = (batchImport as any)?.columnMap || {};

  const combinedData: Record<string, any> = {};
  const effectiveColumnMap: Record<string, string> = {};

  for (const f of fieldMappings) {
    if (row.overrides && row.overrides[f.key] !== undefined) {
      combinedData[f.key] = row.overrides[f.key];
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
  });

  row.effectiveData = validation.effectiveData;
  row.markModified('effectiveData');
  row.errors = validation.errors as any;
  row.markModified('errors');
  row.status = validation.status;
  row.version = (row.version || 1) + 1;
  await row.save();

  // Invalidate approval state
  if (batch.approvedSnapshotId || batch.status === 'awaiting_approval' || batch.status === 'approved') {
    batch.approvedSnapshotId = null as any;
    batch.status = 'review';
  }

  // Recompute batch counts authoritatively
  const counters = await recalculateBatchCounters(batch._id, batch.currentImportRevision);
  batch.validRows = counters.validRows;
  batch.invalidRows = counters.invalidRows;
  batch.duplicateRows = counters.duplicateRows;
  batch.totalRows = counters.totalRows;
  await batch.save();

  return {
    row,
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
    oldRows.map((r) => r.toObject()),
    newRows.map((r) => r.toObject()),
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
    if (action === 'discard') {
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
    await DraftRow.deleteMany({ _id: { $in: Array.from(rowsToDelete) } });
  }

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
    });

    newRow.effectiveData = validation.effectiveData;
    newRow.markModified('effectiveData');
    newRow.errors = validation.errors as any;
    newRow.markModified('errors');
    newRow.status = validation.status;
    newRow.version = (newRow.version || 1) + 1;
    await newRow.save();
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

export const BatchIntake = {
  ingestChunk,
  finalizeImport,
  patchRowOverride,
  reconcileImportRevision,
  getReimportDiff,
};
