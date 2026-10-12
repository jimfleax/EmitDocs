import { Context } from 'hono';
import { Batch } from '../models/Batch.js';
import { BatchImport } from '../models/BatchImport.js';
import { DraftRow } from '../models/DraftRow.js';
import { Template } from '../models/Template.js';
import { TemplateVersion } from '../models/TemplateVersion.js';
import { getJsonBody } from '../lib/request.js';
import { validateDraftRow } from '../services/spreadsheet/row-validator.js';
import { detectDuplicatesAcrossRows } from '../services/spreadsheet/duplicate-detector.js';
import { calculateReimportDiff } from '../services/spreadsheet/diff-calculator.js';

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
    const batches = await Batch.find({ ownerId: user.id }).sort({ createdAt: -1 });
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
    } = body || {};

    if (!sourceFileName || sourceFileSize === undefined) {
      return c.json({ error: 'sourceFileName and sourceFileSize are required' }, 400);
    }

    // Increment revision strictly (AC8)
    const nextRevision = (batch.currentImportRevision || 0) + 1;

    const batchImport = await BatchImport.create({
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
      status: 'uploading',
      totalExpectedRows: 0,
      totalExpectedChunks: 0,
      receivedChunkIds: [],
      rowCount: 0,
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
    });

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
    const { columnMap } = body || {};
    if (!columnMap || typeof columnMap !== 'object') {
      return c.json({ error: 'Valid columnMap object is required' }, 400);
    }

    batchImport.columnMap = columnMap;
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
    const [batchImport, batch] = await Promise.all([
      BatchImport.findOne({
        _id: importId,
        batchId,
        ownerId: user.id,
      }),
      Batch.findById(batchId),
    ]);
    if (!batchImport) return c.json({ error: 'Import not found' }, 404);
    if (!batch) return c.json({ error: 'Batch not found' }, 404);

    const templateVersion = (await TemplateVersion.findById(batch.templateVersionId).lean()) as any;
    const fieldMappings = templateVersion?.fieldMappings || [];

    const body = await getJsonBody(c);
    const { chunkId, totalChunks, rows } = body || {};

    if (!chunkId || !Array.isArray(rows)) {
      return c.json({ error: 'chunkId and rows array are required' }, 400);
    }

    // Idempotency check: If chunkId already received, return success immediately (AC6)
    if (batchImport.receivedChunkIds.includes(chunkId)) {
      return c.json({
        chunkId,
        processed: rows.length,
        idempotent: true,
        message: 'Chunk already processed',
      });
    }

    const bulkOps = [];
    for (const row of rows) {
      const sourceRowNumber = row.sourceRowNumber;
      const rowKey = row.rowKey || `row_${sourceRowNumber}`;
      const importedData = row.importedData || {};

      // Authoritative server-side validation
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
              ownerId: user.id,
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

    // Append chunkId atomically
    await BatchImport.updateOne(
      { _id: batchImport._id },
      {
        $push: { receivedChunkIds: chunkId },
        ...(totalChunks ? { totalExpectedChunks: totalChunks } : {}),
      }
    );

    return c.json({
      chunkId,
      processed: rows.length,
      idempotent: false,
    });
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to submit chunk' }, 500);
  }
};

export const finalizeImport = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { id: batchId, importId } = c.req.param();
  try {
    const [batchImport, batch] = await Promise.all([
      BatchImport.findOne({
        _id: importId,
        batchId,
        ownerId: user.id,
      }),
      Batch.findById(batchId),
    ]);
    if (!batchImport) return c.json({ error: 'Import not found' }, 404);
    if (!batch) return c.json({ error: 'Batch not found' }, 404);

    const body = await getJsonBody(c);
    const { totalExpectedRows, totalExpectedChunks, columnMap } = body || {};

    if (columnMap) {
      batchImport.columnMap = columnMap;
    }

    // Finalization count validation (AC7)
    if (totalExpectedChunks !== undefined) {
      if (batchImport.receivedChunkIds.length !== totalExpectedChunks) {
        return c.json(
          {
            error: {
              code: 'IMPORT_CHUNK_MISMATCH',
              message: `Chunk mismatch: expected ${totalExpectedChunks} chunks, received ${batchImport.receivedChunkIds.length}`,
            },
          },
          400
        );
      }
    }

    const actualRowCount = await DraftRow.countDocuments({ importId: batchImport._id });
    if (totalExpectedRows !== undefined) {
      if (actualRowCount !== totalExpectedRows) {
        return c.json(
          {
            error: {
              code: 'IMPORT_CHUNK_MISMATCH',
              message: `Row count mismatch: expected ${totalExpectedRows} rows, persisted ${actualRowCount}`,
            },
          },
          400
        );
      }
    }

    // Run batch-wide duplicate detection and warning preservation (AC4)
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

    // Calculate final counts authoritatively in memory
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

    return c.json({
      batch,
      batchImport,
      summary: {
        totalRows: actualRowCount,
        validRows: validCount,
        invalidRows: invalidCount,
        duplicateRows: duplicateCount,
      },
    });
  } catch (err: any) {
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

  const batchId = c.req.param('id');
  const rowId = c.req.param('rowId');

  try {
    const batch = await Batch.findOne({ _id: batchId, ownerId: user.id });
    if (!batch) {
      return c.json({ error: 'Batch not found or access denied' }, 404);
    }

    const body = await getJsonBody(c);
    const { expectedRevision, expectedVersion, overrides } = body || {};

    if (expectedRevision !== undefined && batch.currentImportRevision !== expectedRevision) {
      return c.json({ error: 'STALE_BATCH_REVISION' }, 409);
    }

    const row = await DraftRow.findOne({ _id: rowId, batchId: batch._id });
    if (!row) {
      return c.json({ error: 'Row not found or access denied' }, 404);
    }

    if (expectedVersion !== undefined && row.version !== expectedVersion) {
      return c.json({ error: 'CONCURRENT_MODIFICATION' }, 409);
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

    // Fetch templateVersion and batchImport
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

    // Approval invalidation
    if (batch.approvedSnapshotId || batch.status === 'awaiting_approval' || batch.status === 'approved') {
      batch.approvedSnapshotId = null as any;
      batch.status = 'review';
    }

    // Recompute batch counts
    const [validCount, invalidCount, duplicateCount, totalCount] = await Promise.all([
      DraftRow.countDocuments({ batchId: batch._id, revision: batch.currentImportRevision, status: 'valid' }),
      DraftRow.countDocuments({ batchId: batch._id, revision: batch.currentImportRevision, status: 'invalid' }),
      DraftRow.countDocuments({ batchId: batch._id, revision: batch.currentImportRevision, isDuplicate: true }),
      DraftRow.countDocuments({ batchId: batch._id, revision: batch.currentImportRevision }),
    ]);

    batch.validRows = validCount;
    batch.invalidRows = invalidCount;
    batch.duplicateRows = duplicateCount;
    batch.totalRows = totalCount;
    await batch.save();

    return c.json({
      row,
      batchSummary: {
        totalRows: batch.totalRows,
        validRows: batch.validRows,
        invalidRows: batch.invalidRows,
        duplicateRows: batch.duplicateRows,
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to update draft row' }, 500);
  }
};

export const getReimportDiff = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const batchId = c.req.param('id');
  const importId = c.req.param('importId');

  try {
    const batch = await Batch.findOne({ _id: batchId, ownerId: user.id });
    if (!batch) return c.json({ error: 'Batch not found or access denied' }, 404);

    const newImport = await BatchImport.findOne({ _id: importId, batchId: batch._id });
    if (!newImport) return c.json({ error: 'Import not found' }, 404);

    const templateVersion = await TemplateVersion.findById(batch.templateVersionId).lean();
    const fieldMappings = (templateVersion as any)?.fieldMappings || [];

    const reconciliationKey: string =
      c.req.query('reconciliationKey') || fieldMappings[0]?.key || 'studentId';

    const [oldRows, newRows, oldImport] = await Promise.all([
      DraftRow.find({ batchId: batch._id, revision: batch.currentImportRevision }).lean(),
      DraftRow.find({ batchId: batch._id, revision: newImport.revision }).lean(),
      BatchImport.findOne({ batchId: batch._id, revision: batch.currentImportRevision }).lean(),
    ]);

    const diffResult = calculateReimportDiff(
      oldRows as any[],
      newRows as any[],
      reconciliationKey,
      fieldMappings,
      {
        oldColumnMap: (oldImport as any)?.columnMap || {},
        newColumnMap: newImport.columnMap || {},
      }
    );

    return c.json(diffResult);
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to calculate re-import diff' }, 500);
  }
};

export const reconcileReimport = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const batchId = c.req.param('id');
  const importId = c.req.param('importId');

  try {
    const batch = await Batch.findOne({ _id: batchId, ownerId: user.id });
    if (!batch) return c.json({ error: 'Batch not found or access denied' }, 404);

    const newImport = await BatchImport.findOne({ _id: importId, batchId: batch._id });
    if (!newImport) return c.json({ error: 'Import not found' }, 404);

    const body = await getJsonBody(c);
    const { reconciliationKey: reqKey, resolutions } = body || {};

    const templateVersion = await TemplateVersion.findById(batch.templateVersionId).lean();
    const fieldMappings = (templateVersion as any)?.fieldMappings || [];
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

    batch.currentImportRevision = newImport.revision;
    batch.approvedSnapshotId = null as any;
    batch.status = 'review';

    const [validCount, invalidCount, duplicateCount, totalCount] = await Promise.all([
      DraftRow.countDocuments({ batchId: batch._id, revision: newImport.revision, status: 'valid' }),
      DraftRow.countDocuments({ batchId: batch._id, revision: newImport.revision, status: 'invalid' }),
      DraftRow.countDocuments({ batchId: batch._id, revision: newImport.revision, isDuplicate: true }),
      DraftRow.countDocuments({ batchId: batch._id, revision: newImport.revision }),
    ]);

    batch.validRows = validCount;
    batch.invalidRows = invalidCount;
    batch.duplicateRows = duplicateCount;
    batch.totalRows = totalCount;
    batch.version = (batch.version || 1) + 1;
    await batch.save();

    newImport.status = 'completed';
    newImport.rowCount = totalCount;
    newImport.validCount = validCount;
    newImport.invalidCount = invalidCount;
    newImport.duplicateCount = duplicateCount;
    await newImport.save();

    return c.json({
      success: true,
      batch,
      summary: {
        totalRows: totalCount,
        validRows: validCount,
        invalidRows: invalidCount,
        duplicateRows: duplicateCount,
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to reconcile import' }, 500);
  }
};
