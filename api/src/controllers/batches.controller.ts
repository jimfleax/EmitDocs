import { Context } from 'hono';
import { Batch } from '../models/Batch.js';
import { BatchImport } from '../models/BatchImport.js';
import { DraftRow } from '../models/DraftRow.js';
import { Template } from '../models/Template.js';
import { TemplateVersion } from '../models/TemplateVersion.js';
import { getJsonBody } from '../lib/request.js';
import {
  BatchIntake,
  BatchNotFoundError,
  ConcurrencyConflictError,
  ChunkMismatchError,
  BatchIntakeValidationError,
} from '../services/batch-intake.js';

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

    const versionDoc = await TemplateVersion.findById(resolvedVersionId);
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

export const createImport = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const batchId = c.req.param('id');
  try {
    const batch = await Batch.findOne({ _id: batchId, ownerId: user.id });
    if (!batch) return c.json({ error: 'Batch not found' }, 404);

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

    batch.status = 'importing';
    await batch.save();

    return c.json({ batchImport }, 201);
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to initialize import' }, 500);
  }
};

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
      return c.json({ error: err.code }, 409);
    }
    return c.json({ error: err.message || 'Failed to update draft row' }, 500);
  }
};

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
    return c.json({ error: err.message || 'Failed to reconcile import' }, 500);
  }
};

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

export const deleteBatch = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  try {
    const batch = await Batch.findOneAndDelete({ _id: id, ownerId: user.id });
    if (!batch) {
      return c.json({ error: 'Batch not found or access denied' }, 404);
    }

    // Cascade delete associated draft rows and imports
    await Promise.all([
      DraftRow.deleteMany({ batchId: batch._id }),
      BatchImport.deleteMany({ batchId: batch._id }),
    ]);

    return c.json({ success: true, message: 'Batch deleted' });
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to delete batch' }, 500);
  }
};


