/**
 * @file batches.controller.ts
 * @description HTTP controller endpoints managing bulk document issuance batches, intake, and draft rows.
 * @architecture Thin HTTP layer routing requests to MongoDB models and `BatchIntake` service routines.
 *               Manages batch lifecycle transitions, chunked spreadsheet uploads, draft row pagination and search,
 *               inline cell editing under optimistic locking, and 4-way re-import reconciliation.
 * @agent_note Protected by `requireAuth` middleware. Access is strictly scoped to `ownerId === user.id`.
 */

import { Context } from 'hono';
import mongoose from 'mongoose';
import { Batch } from '../models/Batch.js';
import { BatchImport } from '../models/BatchImport.js';
import { DraftRow } from '../models/DraftRow.js';
import { Template } from '../models/Template.js';
import { TemplateVersion } from '../models/TemplateVersion.js';
import { getJsonBody } from '../lib/request.js';
import { isTransactionUnsupportedError } from '../lib/transactions.js';
export { isTransactionUnsupportedError };
import {
  BatchIntake,
  BatchNotFoundError,
  ConcurrencyConflictError,
  ChunkMismatchError,
  BatchIntakeValidationError,
} from '../services/batch-intake.js';
import {
  BatchApproval,
  StaleVersionConflictError,
  BatchApprovalValidationError,
  GenerationInProgressError,
} from '../services/batch-approval.js';
import { expireBatchIfDue } from '../services/retention-pruner.js';

/**
 * @desc Creates a new bulk issuance batch attached to a template and verified mapped version.
 * @route POST /api/batches
 * @access Private
 * @body {Object} body
 * @body {string} body.name - Name of the issuance batch.
 * @body {string} body.templateId - Target Template ObjectId.
 * @body {string} [body.templateVersionId] - Optional specific version ID (defaults to active version).
 * @returns {Promise<Response>} 201 Created JSON with `{ batch: IBatch }`, or 400/404 error.
 */
export const createBatch = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const body = await getJsonBody(c);
    const { name, templateId, templateVersionId } = body || {};

    if (!name || !templateId) {
      return c.json({ error: 'Missing required fields (name and templateId)' }, 400);
    }

    const template = await Template.findOne({ _id: templateId, ownerId: user.id });
    if (!template) {
      return c.json({ error: 'Template not found or not owned by user' }, 404);
    }

    let resolvedVersionId = templateVersionId;
    if (!resolvedVersionId) {
      if (template.currentVersionId) {
        resolvedVersionId = template.currentVersionId;
      } else {
        const latestVersion = await TemplateVersion.findOne({ templateId: template._id }).sort({ version: -1 });
        if (!latestVersion) {
          return c.json({ error: 'Template has no active versions' }, 400);
        }
        resolvedVersionId = latestVersion._id;
      }
    }

    const versionDoc = await TemplateVersion.findOne({
      _id: resolvedVersionId,
      templateId: template._id,
      ownerId: user.id,
    });
    if (!versionDoc) {
      return c.json({ error: 'Template version not found' }, 404);
    }
    if (!Array.isArray(versionDoc.fieldMappings) || versionDoc.fieldMappings.length === 0) {
      return c.json({ error: 'Cannot create batch for an unmapped template. Please configure field mappings first.' }, 400);
    }

    const batch = await Batch.create({
      ownerId: user.id,
      templateId: template._id,
      templateVersionId: resolvedVersionId,
      name: name.trim(),
      status: 'draft',
      currentImportRevision: 0,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
      version: 1,
    });

    return c.json({ batch }, 201);
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to create batch' }, 500);
  }
};

/**
 * @desc Retrieves all batches belonging to the authenticated user, populated with template metadata.
 * @route GET /api/batches
 * @access Private
 * @returns {Promise<Response>} 200 JSON with `{ batches: IBatch[] }`.
 */
export const getBatches = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const batches = await Batch.find({ ownerId: user.id })
      .populate('templateId', 'name thumbnailUrl')
      .sort({ createdAt: -1 });
    return c.json({ batches });
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to list batches' }, 500);
  }
};

/**
 * @desc Retrieves an individual batch by ID with populated template, version, and active import revision.
 * @route GET /api/batches/:id
 * @access Private
 * @returns {Promise<Response>} 200 JSON with `{ batch, currentImport, template, templateVersion }`, or 404 if not found.
 */
export const getBatchById = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  try {
    const batch = await Batch.findOne({ _id: id, ownerId: user.id });
    if (!batch) return c.json({ error: 'Batch not found' }, 404);

    let currentImport = null;
    if (batch.currentImportRevision > 0) {
      currentImport = await BatchImport.findOne({
        batchId: batch._id,
        revision: batch.currentImportRevision,
      });
    }

    const template = await Template.findById(batch.templateId);
    const templateVersion = await TemplateVersion.findById(batch.templateVersionId);

    return c.json({
      batch,
      currentImport,
      template,
      templateVersion,
    });
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to get batch' }, 500);
  }
};


/**
 * @desc Initializes a new spreadsheet import session for a batch and reserves the next revision number.
 * @route POST /api/batches/:id/imports
 * @access Private
 * @body {Object} body
 * @body {string} body.sourceFileName - Name of the uploaded file.
 * @body {number} body.sourceFileSize - File size in bytes.
 * @body {string} [body.sourceChecksum] - Optional checksum.
 * @body {string} [body.worksheetName] - Selected sheet.
 * @body {string[]} [body.availableWorksheets] - Discovered sheet names.
 * @body {string[]} [body.rawHeaders] - Unprocessed column names.
 * @body {string[]} [body.disambiguatedHeaders] - Sanitized column names.
 * @body {Record<string, string>} [body.columnMap] - Mapping to template field keys.
 * @body {Record<string, string>} [body.dateFormatHints] - Per-column date formatting hints.
 * @returns {Promise<Response>} 201 Created JSON with `{ batchImport: IBatchImport }`, or 400/404 error.
 */
export const createImport = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const batchId = c.req.param('id');
  try {
    const batch = await Batch.findOne({ _id: batchId, ownerId: user.id });
    if (!batch) return c.json({ error: 'Batch not found' }, 404);

    if (batch.status === 'generating') {
      return c.json({ error: 'Cannot import while batch is generating' }, 400);
    }

    const body = await getJsonBody(c);
    const {
      sourceFileName,
      sourceFileSize,
      sourceChecksum,
      worksheetName,
      availableWorksheets,
      rawHeaders,
      disambiguatedHeaders,
      columnMap,
      dateFormatHints,
    } = body || {};

    if (!sourceFileName || sourceFileSize === undefined) {
      return c.json({ error: 'sourceFileName and sourceFileSize are required' }, 400);
    }

    // Allocate next revision derived from highest existing revision and currentImportRevision,
    // handling concurrent creation collisions atomically via retry loop
    let batchImport: any = null;
    let attempts = 0;
    while (!batchImport && attempts < 3) {
      attempts++;
      const latestImport = await BatchImport.findOne({ batchId: batch._id })
        .sort({ revision: -1 })
        .select('revision');
      const highestRevision = Math.max(batch.currentImportRevision || 0, latestImport?.revision || 0);
      const nextRevision = highestRevision + 1;

      try {
        batchImport = await BatchImport.create({
          batchId: batch._id,
          ownerId: user.id,
          revision: nextRevision,
          sourceFileName,
          sourceFileSize,
          sourceChecksum,
          worksheetName,
          availableWorksheets: availableWorksheets || [],
          rawHeaders: rawHeaders || [],
          disambiguatedHeaders: disambiguatedHeaders || [],
          columnMap: columnMap || {},
          dateFormatHints: dateFormatHints || {},
          status: 'uploading',
          totalExpectedRows: 0,
          totalExpectedChunks: 0,
          receivedChunkIds: [],
          rowCount: 0,
          validCount: 0,
          invalidCount: 0,
          duplicateCount: 0,
        });
      } catch (insertErr: any) {
        if (insertErr.code === 11000 && attempts < 3) {
          continue;
        }
        throw insertErr;
      }
    }

    if ((batch.currentImportRevision || 0) === 0) {
      batch.status = 'importing';
      await batch.save();
    }

    return c.json({ batchImport }, 201);
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to initialize import' }, 500);
  }
};

/**
 * @desc Updates column key mappings and date format hints for an import revision.
 * @route PUT /api/batches/:id/imports/:importId/mapping
 * @access Private
 * @body {Object} body
 * @body {Record<string, string>} body.columnMap - Mapping from template field keys to spreadsheet headers.
 * @body {Record<string, string>} [body.dateFormatHints] - Per-column date format hints.
 * @returns {Promise<Response>} 200 JSON with `{ batchImport: IBatchImport }`, or 400/404 error.
 */
export const updateImportMapping = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { id: batchId, importId } = c.req.param();
  try {
    const batchImport = await BatchImport.findOne({
      _id: importId,
      batchId,
      ownerId: user.id,
    });
    if (!batchImport) return c.json({ error: 'Import not found' }, 404);

    const body = await getJsonBody(c);
    const { columnMap, dateFormatHints } = body || {};
    if (!columnMap || typeof columnMap !== 'object') {
      return c.json({ error: 'Valid columnMap object is required' }, 400);
    }

    batchImport.columnMap = columnMap;
    if (dateFormatHints && typeof dateFormatHints === 'object') {
      batchImport.dateFormatHints = dateFormatHints;
    }
    await batchImport.save();

    return c.json({ batchImport });
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to update mapping' }, 500);
  }
};

/**
 * @desc Streams a chunk of parsed spreadsheet rows to be validated and saved as draft rows.
 * @route POST /api/batches/:id/imports/:importId/rows
 * @access Private
 * @body {Object} body
 * @body {string} body.chunkId - Unique chunk identifier for idempotency tracking.
 * @body {number} [body.totalChunks] - Total chunks count.
 * @body {IngestChunkRowInput[]} body.rows - Array of raw row items.
 * @returns {Promise<Response>} 200 JSON with `{ chunkId, processed, idempotent }`, or 400/404 error.
 */
export const submitRowsChunk = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { id: batchId, importId } = c.req.param();
  try {
    const body = await getJsonBody(c);
    const { chunkId, totalChunks, rows } = body || {};

    const result = await BatchIntake.ingestChunk({
      batchId,
      importId,
      ownerId: user.id,
      chunkId,
      totalChunks,
      rows,
    });

    return c.json(result);
  } catch (err: any) {
    if (err instanceof BatchNotFoundError) {
      return c.json({ error: err.message }, 404);
    }
    if (err instanceof BatchIntakeValidationError) {
      return c.json({ error: err.message }, 400);
    }
    return c.json({ error: err.message || 'Failed to submit chunk' }, 500);
  }
};

/**
 * @desc Finalizes a spreadsheet import: validates row/chunk counts, runs duplicate checks, and recalculates batch counters.
 * @route POST /api/batches/:id/imports/:importId/finalize
 * @access Private
 * @body {Object} [body]
 * @body {number} [body.totalExpectedRows] - Declared total rows.
 * @body {number} [body.totalExpectedChunks] - Declared total chunks.
 * @body {Record<string, string>} [body.columnMap] - Final column mappings.
 * @body {Record<string, string>} [body.dateFormatHints] - Final date hints.
 * @body {boolean} [body.promote] - Explicit flag to promote batch to review status.
 * @returns {Promise<Response>} 200 JSON with `{ batch, batchImport, summary }`, 400 mismatch error, or 404 error.
 */
export const finalizeImport = async (c: Context) => {

  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { id: batchId, importId } = c.req.param();
  try {
    const body = await getJsonBody(c);
    const { totalExpectedRows, totalExpectedChunks, columnMap, dateFormatHints, promote } = body || {};

    const result = await BatchIntake.finalizeImport({
      batchId,
      importId,
      ownerId: user.id,
      totalExpectedRows,
      totalExpectedChunks,
      columnMap,
      dateFormatHints,
      promote,
    });

    return c.json(result);
  } catch (err: any) {
    if (err instanceof BatchNotFoundError) {
      return c.json({ error: err.message }, 404);
    }
    if (err instanceof ChunkMismatchError) {
      return c.json(
        {
          error: {
            code: err.code,
            message: err.message,
          },
        },
        400
      );
    }
    return c.json({ error: err.message || 'Failed to finalize import' }, 500);
  }
};

/**
 * @desc Retrieves paginated, filtered, and searched draft rows with faceted summary counts.
 * @route GET /api/batches/:id/rows
 * @access Private
 * @param {string} [c.req.query('filter')] - Filter facet ('all', 'valid', 'invalid', 'duplicate', 'warning', 'overridden').
 * @param {string} [c.req.query('page')] - 1-based page number (defaults to 1).
 * @param {string} [c.req.query('limit')] - Number of rows per page (defaults to 50, max 200).
 * @param {string} [c.req.query('query')] - Search text across rowKey, row numbers, and mapped fields.
 * @returns {Promise<Response>} 200 JSON with `{ rows, total, page, limit, totalPages, nextCursor, summary }`, or 404/500 error.
 */
export const getDraftRows = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const batchId = c.req.param('id');
  try {
    const batch = await Batch.findOne({ _id: batchId, ownerId: user.id });
    if (!batch) return c.json({ error: 'Batch not found' }, 404);

    const filterParam = c.req.query('filter') || c.req.query('status') || 'all';
    const rawLimit = parseInt(c.req.query('limit') || '50', 10);
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 50 : rawLimit), 200);
    const rawPage = parseInt(c.req.query('page') || '1', 10);
    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
    const cursor = c.req.query('cursor');
    const query = c.req.query('query');

    const conditions: any[] = [
      {
        batchId: batch._id,
        revision: batch.currentImportRevision,
      },
    ];

    // Filter facet logic
    if (filterParam === 'valid') {
      conditions.push({ status: 'valid' });
    } else if (filterParam === 'invalid') {
      conditions.push({ status: 'invalid' });
    } else if (filterParam === 'duplicate') {
      conditions.push({ isDuplicate: true });
    } else if (filterParam === 'warning') {
      conditions.push({
        $or: [{ isDuplicate: true }, { 'warnings.0': { $exists: true } }],
      });
    } else if (filterParam === 'overridden') {
      conditions.push({
        $expr: {
          $gt: [{ $size: { $objectToArray: { $ifNull: ['$overrides', {}] } } }, 0],
        },
      });
    }

    // Cursor for backwards compatibility
    if (cursor) {
      conditions.push({ sourceRowNumber: { $gt: parseInt(cursor, 10) } });
    }

    // Text search query across rowKey, sourceRowNumber, effectiveData
    if (query && query.trim().length > 0) {
      const q = query.trim();
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const orClauses: any[] = [{ rowKey: { $regex: escaped, $options: 'i' } }];

      if (!isNaN(Number(q))) {
        orClauses.push({ sourceRowNumber: Number(q) });
      }

      let fieldKeys: string[] = [];
      if (batch.templateVersionId) {
        const tv = await TemplateVersion.findById(batch.templateVersionId).lean();
        if (tv && Array.isArray((tv as any).fieldMappings)) {
          fieldKeys = (tv as any).fieldMappings.map((f: any) => f.key);
        }
      }

      for (const k of fieldKeys) {
        orClauses.push({ [`effectiveData.${k}`]: { $regex: escaped, $options: 'i' } });
      }

      const fallbackKeys = ['studentName', 'name', 'recipientName', 'email'];
      for (const fb of fallbackKeys) {
        if (!fieldKeys.includes(fb)) {
          orClauses.push({ [`effectiveData.${fb}`]: { $regex: escaped, $options: 'i' } });
        }
      }

      conditions.push({ $or: orClauses });
    }

    const matchFilter = conditions.length === 1 ? conditions[0] : { $and: conditions };

    // Pagination calculations
    const skip = (page - 1) * limit;

    const [filteredTotal, rows, summaryAgg] = await Promise.all([
      DraftRow.countDocuments(matchFilter),
      DraftRow.find(matchFilter)
        .sort({ sourceRowNumber: 1 })
        .skip(cursor ? 0 : skip)
        .limit(limit)
        .lean(),
      DraftRow.aggregate([
        { $match: { batchId: batch._id, revision: batch.currentImportRevision } },
        {
          $facet: {
            total: [{ $count: 'count' }],
            valid: [{ $match: { status: 'valid' } }, { $count: 'count' }],
            invalid: [{ $match: { status: 'invalid' } }, { $count: 'count' }],
            duplicate: [{ $match: { isDuplicate: true } }, { $count: 'count' }],
            warning: [
              {
                $match: {
                  $or: [{ isDuplicate: true }, { 'warnings.0': { $exists: true } }],
                },
              },
              { $count: 'count' },
            ],
            overridden: [
              {
                $match: {
                  $expr: {
                    $gt: [{ $size: { $objectToArray: { $ifNull: ['$overrides', {}] } } }, 0],
                  },
                },
              },
              { $count: 'count' },
            ],
          },
        },
      ]),
    ]);

    const totalPages = Math.ceil(filteredTotal / limit);
    const nextCursor = rows.length === limit ? (rows[rows.length - 1] as any).sourceRowNumber : null;

    const facet = summaryAgg?.[0] || {};
    const summary = {
      totalRows: facet.total?.[0]?.count ?? 0,
      validRows: facet.valid?.[0]?.count ?? 0,
      invalidRows: facet.invalid?.[0]?.count ?? 0,
      duplicateRows: facet.duplicate?.[0]?.count ?? 0,
      warningRows: facet.warning?.[0]?.count ?? 0,
      overriddenRows: facet.overridden?.[0]?.count ?? 0,
    };

    return c.json({
      rows,
      total: filteredTotal,
      page,
      limit,
      totalPages,
      nextCursor,
      summary,
    });
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to fetch draft rows' }, 500);
  }
};

/**
 * @desc Applies human inline cell overrides to an individual draft row with optimistic locking.
 * @route PATCH /api/batches/:id/rows/:rowId
 * @access Private
 * @body {Object} body
 * @body {number} [body.expectedRevision] - Expected batch revision number.
 * @body {number} [body.expectedVersion] - Expected row version counter for CAS concurrency protection.
 * @body {Record<string, any>} body.overrides - Dictionary of field overrides.
 * @returns {Promise<Response>} 200 JSON with `{ row: IDraftRow, batchSummary }`, 404 if not found, or 409 on version conflict.
 */
export const patchDraftRow = async (c: Context) => {

  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { id: batchId, rowId } = c.req.param();

  try {
    const body = await getJsonBody(c);
    const { expectedRevision, expectedVersion, overrides } = body || {};

    const result = await BatchIntake.patchRowOverride({
      batchId,
      rowId,
      ownerId: user.id,
      overrides,
      expectedRevision,
      expectedVersion,
    });

    return c.json({
      row: result.row,
      batchSummary: result.batchSummary,
    });
  } catch (err: any) {
    if (err instanceof BatchNotFoundError) {
      return c.json({ error: err.message }, 404);
    }
    if (err instanceof ConcurrencyConflictError) {
      return c.json({ error: err.code, code: err.code, message: err.message }, 409);
    }
    return c.json({ error: err.message || 'Failed to update draft row' }, 500);
  }
};

/**
 * Computes a diff preview comparing a re-imported staging dataset against existing draft rows.
 *
 * @desc Inspects matched, changed, added, and removed rows using the specified reconciliation key.
 * @route GET /api/batches/:id/reimports/:importId/diff
 * @access Private (authenticated owner)
 * @param {Context} c - Hono context containing route parameters (`id`, `importId`) and query `reconciliationKey`.
 * @returns {Promise<Response>} 200 with diff summary, rows categorization, and field statistics; 401 if unauthenticated; 404 if batch/import missing; 500 on failure.
 */
export const getReimportDiff = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { id: batchId, importId } = c.req.param();

  try {
    const reconciliationKey = c.req.query('reconciliationKey');

    const diffResult = await BatchIntake.getReimportDiff({
      batchId,
      importId,
      ownerId: user.id,
      reconciliationKey,
    });

    return c.json(diffResult);
  } catch (err: any) {
    if (err instanceof BatchNotFoundError) {
      return c.json({ error: err.message }, 404);
    }
    return c.json({ error: err.message || 'Failed to calculate re-import diff' }, 500);
  }
};

/**
 * Reconciles and commits a re-imported spreadsheet dataset into the active batch draft rows.
 *
 * @desc Merges staged rows according to specified resolution decisions per row (e.g., overwrite vs keep existing).
 * @route POST /api/batches/:id/reimports/:importId/reconcile
 * @access Private (authenticated owner)
 * @param {Context} c - Hono context containing route parameters and JSON body with `{ reconciliationKey, resolutions }`.
 * @returns {Promise<Response>} 200 with updated batch and reconciliation summary; 400 on chunk mismatch; 401 if unauthenticated; 404 if missing; 409 on version conflict; 500 on failure.
 */
export const reconcileReimport = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { id: batchId, importId } = c.req.param();

  try {
    const body = await getJsonBody(c);
    const { reconciliationKey, resolutions } = body || {};

    const result = await BatchIntake.reconcileImportRevision({
      batchId,
      importId,
      ownerId: user.id,
      reconciliationKey,
      resolutions,
    });

    return c.json({
      success: true,
      batch: result.batch,
      summary: result.summary,
    });
  } catch (err: any) {
    if (err instanceof BatchNotFoundError) {
      return c.json({ error: 'Batch not found or access denied' }, 404);
    }
    if (err instanceof ConcurrencyConflictError) {
      return c.json({ error: err.message, code: err.code }, 409);
    }
    if (err instanceof ChunkMismatchError) {
      return c.json({ error: err.message, code: err.code }, 400);
    }
    return c.json({ error: err.message || 'Failed to reconcile import' }, 500);
  }
};

/**
 * Aggregates batch creation and document throughput activity over a rolling timeframe for analytics charts.
 *
 * @desc Groups batch and document counts into daily buckets over a requested window (default 30 days, up to 90 days), calculating relative heights for UI rendering.
 * @route GET /api/batches/activity
 * @access Private (authenticated owner)
 * @param {Context} c - Hono context containing query parameter `days` (optional numeric string).
 * @returns {Promise<Response>} 200 with activity timeframes, totals, and daily buckets; 401 if unauthenticated; 500 on failure.
 */
export const getBatchActivity = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const daysParam = parseInt(c.req.query('days') || '30', 10);
  const numDays = Number.isInteger(daysParam) && daysParam > 0 && daysParam <= 90 ? daysParam : 30;

  try {
    const now = new Date();
    // Calculate start date (numDays - 1) days ago at start of day
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (numDays - 1), 0, 0, 0, 0);

    const batches = await Batch.find({
      ownerId: user.id,
      createdAt: { $gte: startDate },
    }).select('createdAt validRows totalRows status name');

    // Aggregate by YYYY-MM-DD
    const dateMap = new Map<string, { docs: number; batches: number }>();
    for (const batch of batches) {
      if (!batch.createdAt) continue;
      const d = new Date(batch.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const entry = dateMap.get(key) || { docs: 0, batches: 0 };
      const docsCount = batch.validRows || batch.totalRows || 0;
      entry.docs += docsCount;
      entry.batches += 1;
      dateMap.set(key, entry);
    }

    let maxDocs = 0;
    let peakKey = '';
    for (let i = 0; i < numDays; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const entry = dateMap.get(key) || { docs: 0, batches: 0 };
      if (entry.docs > maxDocs) {
        maxDocs = entry.docs;
        peakKey = key;
      }
    }

    let totalDocs = 0;
    let totalBatches = 0;
    const dayBuckets = [];

    for (let i = 0; i < numDays; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const entry = dateMap.get(key) || { docs: 0, batches: 0 };
      totalDocs += entry.docs;
      totalBatches += entry.batches;

      const dayLabel = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      const fullDate = d.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      let height = 0;
      if (maxDocs > 0 && entry.docs > 0) {
        height = Math.max(12, Math.round((entry.docs / maxDocs) * 100));
      } else if (entry.batches > 0) {
        height = 8;
      }

      dayBuckets.push({
        date: key,
        label: dayLabel,
        fullDate,
        docs: entry.docs,
        batches: entry.batches,
        height,
        isHighlight: maxDocs > 0 ? key === peakKey : (i === numDays - 1),
      });
    }

    return c.json({
      timeframe: `${numDays}d`,
      totalDocs,
      totalBatches,
      maxDocs,
      activity: dayBuckets,
    });
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to retrieve batch activity' }, 500);
  }
};

/**
 * Deletes a batch and cascades deletion to all associated draft rows and batch import records.
 *
 * @desc Atomically claims the batch for deletion before cleanup, then permanently removes the batch
 *       document and executes cleanup queries across `DraftRow` and `BatchImport` collections within
 *       a transaction (with graceful fallback for standalone MongoDB deployments where transactions are unsupported).
 * @route DELETE /api/batches/:id
 * @access Private (authenticated owner)
 * @param {Context} c - Hono context containing the batch ID route parameter.
 * @returns {Promise<Response>} 200 with deletion confirmation message; 400 if generating; 401 if unauthenticated; 404 if not found; 500 on failure.
 */
export const deleteBatch = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  let previousStatus: string | null = null;
  try {
    // Atomically claim the batch for deletion before cleanup, coordinating with generation state transitions
    const batch = await Batch.findOneAndUpdate(
      { _id: id, ownerId: user.id, status: { $ne: 'generating' } },
      { $set: { status: 'deleting' } },
      { new: false }
    );
    if (!batch) {
      const existing = await Batch.findOne({ _id: id, ownerId: user.id });
      if (!existing) {
        return c.json({ error: 'Batch not found or access denied' }, 404);
      }
      if (existing.status === 'generating') {
        return c.json({ error: 'Cannot delete batch while generating (generation in progress)' }, 400);
      }
      return c.json({ error: 'Cannot delete batch' }, 400);
    }
    previousStatus = batch.status;

    // Wrap permanent cascade delete in a Mongoose session transaction where supported, fallback gracefully
    let session: mongoose.ClientSession | null = null;
    let transactionCommitted = false;
    let transactionError: any = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      await DraftRow.deleteMany({ batchId: batch._id }, { session });
      await BatchImport.deleteMany({ batchId: batch._id }, { session });
      await Batch.deleteOne({ _id: batch._id }, { session });
      await session.commitTransaction();
      transactionCommitted = true;
    } catch (err: any) {
      transactionError = err;
      if (session && session.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch {
          // Transaction abort failed or unsupported
        }
      }
    } finally {
      if (session) {
        try {
          await session.endSession();
        } catch {
          // Session cleanup
        }
      }
    }

    if (!transactionCommitted) {
      // Restrict non-transactional fallback strictly to errors indicating unsupported transactions
      if (transactionError && !isTransactionUnsupportedError(transactionError)) {
        throw transactionError;
      }

      // Graceful fallback without transaction (e.g. standalone Mongo where transactions are unsupported).
      // Delete child records first; only remove batch document if both child cleanups succeed to preserve recovery path.
      await Promise.all([
        DraftRow.deleteMany({ batchId: batch._id }),
        BatchImport.deleteMany({ batchId: batch._id }),
      ]);
      await Batch.deleteOne({ _id: batch._id });
    }

    return c.json({ success: true, message: 'Batch deleted' });
  } catch (err: any) {
    if (previousStatus && previousStatus !== 'deleting') {
      try {
        await Batch.updateOne(
          { _id: id, ownerId: user.id, status: 'deleting' },
          { $set: { status: previousStatus } }
        );
      } catch {
        // Status restoration failed or unsupported
      }
    }
    return c.json({ error: err.message || 'Failed to delete batch' }, 500);
  }
};

/**
 * @desc Retrieves preflight review summary and verification metrics before batch approval.
 * @route GET /api/batches/:id/approval-preflight
 * @access Private
 */
export const getApprovalPreflight = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const batchId = c.req.param('id');
  if (!batchId) return c.json({ error: 'Batch ID is required' }, 400);

  try {
    const result = await BatchApproval.getApprovalPreflight({ batchId, ownerId: user.id });
    return c.json(result);
  } catch (err: any) {
    if (err instanceof BatchNotFoundError) {
      return c.json({ error: err.message }, 404);
    }
    return c.json({ error: err.message || 'Failed to fetch approval preflight' }, 500);
  }
};

/**
 * @desc Freezes valid batch rows into an immutable snapshot under optimistic concurrency checks.
 * @route POST /api/batches/:id/approve
 * @access Private
 */
export const approveBatch = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const batchId = c.req.param('id');
  if (!batchId) return c.json({ error: 'Batch ID is required' }, 400);

  try {
    const body = await getJsonBody(c);
    const {
      expectedBatchVersion,
      expectedTemplateVersion,
      expectedImportRevision,
      retentionHours,
      idempotencyKey,
    } = body || {};

    if (!idempotencyKey) {
      return c.json({ error: 'Missing required field idempotencyKey', code: 'MISSING_IDEMPOTENCY_KEY' }, 400);
    }

    const result = await BatchApproval.approveBatch({
      batchId,
      ownerId: user.id,
      expectedBatchVersion,
      expectedTemplateVersion,
      expectedImportRevision,
      retentionHours,
      idempotencyKey,
    });

    return c.json({ snapshot: result.snapshot }, 200);
  } catch (err: any) {
    if (err instanceof BatchNotFoundError) {
      return c.json({ error: err.message }, 404);
    }
    if (err instanceof StaleVersionConflictError) {
      return c.json({ error: err.message, code: err.code }, 409);
    }
    if (err instanceof GenerationInProgressError) {
      return c.json({ error: err.message, code: err.code }, 409);
    }
    if (err instanceof BatchApprovalValidationError) {
      return c.json({ error: err.message, code: err.code }, 400);
    }
    return c.json({ error: err.message || 'Failed to approve batch' }, 500);
  }
};

/**
 * @desc Retrieves the currently active approved snapshot for a batch.
 * @route GET /api/batches/:id/snapshot
 * @access Private
 */
export const getApprovedSnapshot = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const batchId = c.req.param('id');
  if (!batchId) return c.json({ error: 'Batch ID is required' }, 400);

  try {
    const snapshot = await BatchApproval.getApprovedSnapshot({ batchId, ownerId: user.id });
    if (!snapshot) {
      return c.json({ error: 'No approved snapshot found for this batch' }, 404);
    }
    return c.json({ snapshot });
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to fetch approved snapshot' }, 500);
  }
};

/**
 * @desc Retrieves paginated approved recipient records for a frozen snapshot.
 * @route GET /api/batches/:id/snapshot/recipients
 * @access Private
 */
export const getApprovedRecipients = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const batchId = c.req.param('id');
  if (!batchId) return c.json({ error: 'Batch ID is required' }, 400);

  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '50', 10);

  try {
    const batch = await Batch.findOne({ _id: batchId, ownerId: user.id });
    if (!batch) return c.json({ error: 'Batch not found' }, 404);

    // Check expiration
    if (batch.status === 'expired' || (batch.expiresAt && new Date() >= new Date(batch.expiresAt))) {
      if (batch.status !== 'expired') {
        await expireBatchIfDue(batch._id, user.id);
      }
      return c.json(
        {
          error: 'Batch has expired and recipient PII has been pruned',
          code: 'BATCH_EXPIRED',
          expiresAt: batch.expiresAt,
        },
        410
      );
    }

    const result = await BatchApproval.getApprovedRecipients({
      batchId,
      ownerId: user.id,
      page,
      limit,
    });
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to fetch approved recipients' }, 500);
  }
};



