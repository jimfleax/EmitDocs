import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import mongoose from 'mongoose';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../api/.env') });

import { parseXlsxBuffer } from '../web/src/lib/spreadsheet/spreadsheet-parser.js';
import { normalizeDateValue, normalizeNumberValue, normalizeTextValue } from '../web/src/lib/spreadsheet/data-normalizer.js';

import { Batch } from '../api/api/models/Batch.js';
import { BatchImport } from '../api/api/models/BatchImport.js';
import { DraftRow } from '../api/api/models/DraftRow.js';
import { Template } from '../api/api/models/Template.js';
import { TemplateVersion } from '../api/api/models/TemplateVersion.js';
import {
  createBatch,
  createImport,
  updateImportMapping,
  submitRowsChunk,
  finalizeImport,
} from '../api/api/controllers/batches.controller.js';

function createMockContext({ user, params = {}, query = {}, body = null }: any) {
  let responseData: any = null;
  let responseStatus = 200;
  return {
    get: (key: string) => (key === 'user' ? user : undefined),
    req: {
      param: (key?: string) => (key ? params[key] : params),
      query: (key?: string) => (key ? query[key] : query),
      json: async () => body,
    },
    json: (data: any, status = 200) => {
      responseData = data;
      responseStatus = status;
      return { data, status };
    },
    _getResponse: () => ({ data: responseData, status: responseStatus }),
  };
}

async function runAcceptanceCriteriaMatrix() {
  console.log('===========================================================');
  console.log('  PRD-CORE-04 ACCEPTANCE CRITERIA MATRIX & BENCHMARK');
  console.log('===========================================================\n');

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { dbName: 'emitdocs_ac_test' });
  console.log('✓ Connected to MongoDB test database\n');

  const testUserId = `ac_user_${Date.now()}`;
  const mockUser = { id: testUserId, email: 'ac@example.com' };

  // Setup Template & TemplateVersion fixture
  const template = await Template.create({
    ownerId: testUserId,
    name: 'Executive Certificate Template',
    cloudinaryPublicId: 'ac_cert_fixture',
    sourceUrl: 'https://example.com/ac_cert.pdf',
    status: 'active',
  });

  const templateVersion = await TemplateVersion.create({
    templateId: template._id,
    ownerId: testUserId,
    version: 1,
    sourceObjectKey: 'ac_cert.pdf',
    bytes: 2048,
    pageCount: 1,
    status: 'active',
    fieldMappings: [
      {
        id: 'f_name',
        key: 'recipientName',
        label: 'Recipient Name',
        type: 'text',
        required: true,
        pageIndex: 0,
        rect: { x: 50, y: 100, width: 200, height: 30 },
      },
      {
        id: 'f_date',
        key: 'awardDate',
        label: 'Award Date',
        type: 'date',
        required: true,
        pageIndex: 0,
        rect: { x: 50, y: 150, width: 150, height: 30 },
      },
      {
        id: 'f_score',
        key: 'finalScore',
        label: 'Final Score',
        type: 'number',
        required: false,
        pageIndex: 0,
        rect: { x: 50, y: 200, width: 100, height: 30 },
      },
    ],
    mappingHash: 'b'.repeat(64),
  });

  template.currentVersionId = templateVersion._id;
  await template.save();

  // Create Batch
  const cBatch = createMockContext({
    user: mockUser,
    body: {
      name: 'Q4 Global Certifications',
      templateId: template._id.toString(),
    },
  });
  await createBatch(cBatch as any);
  const testBatch = cBatch._getResponse().data.batch;
  const testBatchId = testBatch._id.toString();
  console.log(`✓ Initialized test batch: ${testBatch.name} (${testBatchId})\n`);

  // -------------------------------------------------------------------------
  // AC1: CSV/XLSX follow header/worksheet rules
  // -------------------------------------------------------------------------
  console.log('--- AC1: CSV/XLSX Header & Worksheet Rules ---');
  {
    // Multi-sheet XLSX with empty leading rows, blank header, and duplicate header
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet([
      ['Unrelated Tab'],
      ['123'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws1, 'Notes');

    const ws2 = XLSX.utils.aoa_to_sheet([
      [], // blank leading row 1
      ['', null, '   '], // blank leading row 2
      ['Full Name', '', 'Full Name', 'Issue Date'], // header row with duplicate & blank
      ['John Doe', 'Tech Lead', 'John Doe', '2026-05-18'],
      ['Jane Roe', 'PM', 'Jane Roe', '2026-05-19'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws2, 'Recipients');

    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const parsed = parseXlsxBuffer(buffer, { worksheetName: 'Recipients' });

    assert.strictEqual(parsed.selectedWorksheet, 'Recipients');
    assert.deepStrictEqual(parsed.availableWorksheets, ['Notes', 'Recipients']);
    assert.strictEqual(parsed.dataStartRowIndex, 2, 'First non-empty row correctly identified as header');
    assert.deepStrictEqual(
      parsed.disambiguatedHeaders,
      ['Full Name', 'Column_B', 'Full Name_2', 'Issue Date'],
      'Blank and duplicate headers disambiguated without merging'
    );
    assert.strictEqual(parsed.rows.length, 2);
    console.log('   ✓ AC1 PASSED: Multi-sheet selection, leading empty row skipping, and disambiguation verified.\n');
  }

  // -------------------------------------------------------------------------
  // AC2: Mappings persist after refresh
  // -------------------------------------------------------------------------
  console.log('--- AC2: Column Mapping Persistence ---');
  let activeImportId: string = '';
  {
    const cImport = createMockContext({
      user: mockUser,
      params: { id: testBatchId },
      body: {
        sourceFileName: 'q4_candidates.xlsx',
        sourceFileSize: 8192,
        worksheetName: 'Recipients',
        availableWorksheets: ['Recipients'],
        rawHeaders: ['Full Name', 'Issue Date', 'Score'],
        disambiguatedHeaders: ['Full Name', 'Issue Date', 'Score'],
      },
    });
    await createImport(cImport as any);
    activeImportId = cImport._getResponse().data.batchImport._id.toString();

    const columnMap = {
      recipientName: 'Full Name',
      awardDate: 'Issue Date',
      finalScore: 'Score',
    };

    const cMap = createMockContext({
      user: mockUser,
      params: { id: testBatchId, importId: activeImportId },
      body: { columnMap },
    });
    await updateImportMapping(cMap as any);

    // Assert re-fetching from database returns persisted mapping
    const persisted = await BatchImport.findById(activeImportId);
    assert.deepStrictEqual(persisted?.columnMap, columnMap);
    console.log('   ✓ AC2 PASSED: Mapping stored and persisted across reloads.\n');
  }

  // -------------------------------------------------------------------------
  // AC3: Invalid rows have actionable field-level codes
  // -------------------------------------------------------------------------
  console.log('--- AC3: Actionable Field-Level Error Codes ---');
  {
    const invalidRow = {
      sourceRowNumber: 2,
      rowKey: 'row_2',
      importedData: {
        'Full Name': '', // missing required
        'Issue Date': 'not-a-valid-date', // invalid date
        Score: 'invalid-num', // invalid number
      },
    };

    const cChunk = createMockContext({
      user: mockUser,
      params: { id: testBatchId, importId: activeImportId },
      body: {
        chunkId: 'chunk_ac3',
        chunkIndex: 0,
        totalChunks: 1,
        rows: [invalidRow],
      },
    });
    await submitRowsChunk(cChunk as any);

    const persistedRow = await DraftRow.findOne({ importId: activeImportId, rowKey: 'row_2' });
    assert.strictEqual(persistedRow?.status, 'invalid');
    assert.strictEqual(persistedRow?.errors.length, 3);
    assert.ok(persistedRow?.errors.some((e) => e.field === 'recipientName' && e.code === 'REQUIRED_FIELD_MISSING'));
    assert.ok(persistedRow?.errors.some((e) => e.field === 'awardDate' && e.code === 'INVALID_DATE'));
    assert.ok(persistedRow?.errors.some((e) => e.field === 'finalScore' && e.code === 'INVALID_NUMBER'));
    console.log('   ✓ AC3 PASSED: Field errors emitted with exact codes and field names.\n');
  }

  // -------------------------------------------------------------------------
  // AC4: Duplicates are warned and preserved
  // -------------------------------------------------------------------------
  console.log('--- AC4: Duplicate Preservation & Warning ---');
  {
    const rows = [
      {
        sourceRowNumber: 10,
        rowKey: 'row_10',
        importedData: { 'Full Name': 'Alice Cooper', 'Issue Date': '2026-06-01', Score: '95' },
      },
      {
        sourceRowNumber: 11,
        rowKey: 'row_11',
        importedData: { 'Full Name': 'Alice Cooper', 'Issue Date': '2026-06-01', Score: '95' }, // identical
      },
    ];

    const cChunk = createMockContext({
      user: mockUser,
      params: { id: testBatchId, importId: activeImportId },
      body: {
        chunkId: 'chunk_ac4',
        chunkIndex: 0,
        totalChunks: 1,
        rows,
      },
    });
    await submitRowsChunk(cChunk as any);

    const cFinal = createMockContext({
      user: mockUser,
      params: { id: testBatchId, importId: activeImportId },
      body: { totalExpectedRows: 3 }, // row 2 + row 10 + row 11
    });
    await finalizeImport(cFinal as any);

    const row11 = await DraftRow.findOne({ importId: activeImportId, rowKey: 'row_11' });
    assert.strictEqual(row11?.isDuplicate, true, 'Row 11 must be flagged as duplicate');
    assert.deepStrictEqual(row11?.duplicateReferences, [10], 'Must reference row 10');
    assert.ok(row11?.warnings.some((w) => w.code === 'DUPLICATE_ROW'));
    assert.notStrictEqual(row11, null, 'Duplicate row MUST be preserved in database, never deleted');
    console.log('   ✓ AC4 PASSED: Duplicate rows preserved and tagged with DUPLICATE_ROW.\n');
  }

  // -------------------------------------------------------------------------
  // AC5: Ambiguous dates/numbers/formulas never silently guessed
  // -------------------------------------------------------------------------
  console.log('--- AC5: Ambiguity Detection & Formula Cache Safety ---');
  {
    // Ambiguous date (04/05/2026)
    const dateRes = normalizeDateValue('04/05/2026');
    assert.strictEqual(dateRes.error?.code, 'AMBIGUOUS_DATE');

    // Ambiguous number
    const numRes = normalizeNumberValue('1.250.50');
    assert.strictEqual(numRes.error?.code, 'AMBIGUOUS_NUMBER');

    // Formula missing cache
    const formRes = normalizeTextValue('__FORMULA_CACHE_MISSING__');
    assert.strictEqual(formRes.error?.code, 'FORMULA_CACHE_MISSING');

    console.log('   ✓ AC5 PASSED: AMBIGUOUS_DATE, AMBIGUOUS_NUMBER, FORMULA_CACHE_MISSING flagged without guessing.\n');
  }

  // -------------------------------------------------------------------------
  // AC6: Retried row chunks do not create duplicate records
  // -------------------------------------------------------------------------
  console.log('--- AC6: Idempotent Chunk Submissions ---');
  {
    const chunkId = 'idempotent_test_chunk_77';
    const rows = [
      {
        sourceRowNumber: 20,
        rowKey: 'row_20',
        importedData: { 'Full Name': 'Bruce Wayne', 'Issue Date': '2026-06-01' },
      },
    ];

    const c1 = createMockContext({
      user: mockUser,
      params: { id: testBatchId, importId: activeImportId },
      body: { chunkId, rows },
    });
    await submitRowsChunk(c1 as any);
    assert.strictEqual(c1._getResponse().data.idempotent, false);

    const countBefore = await DraftRow.countDocuments({ importId: activeImportId, rowKey: 'row_20' });
    assert.strictEqual(countBefore, 1);

    // Resubmit identical chunk
    const c2 = createMockContext({
      user: mockUser,
      params: { id: testBatchId, importId: activeImportId },
      body: { chunkId, rows },
    });
    await submitRowsChunk(c2 as any);
    assert.strictEqual(c2._getResponse().data.idempotent, true);

    const countAfter = await DraftRow.countDocuments({ importId: activeImportId, rowKey: 'row_20' });
    assert.strictEqual(countAfter, 1, 'Retry must not insert duplicate row');
    console.log('   ✓ AC6 PASSED: Retried chunk recognized as idempotent without row duplication.\n');
  }

  // -------------------------------------------------------------------------
  // AC7: Finalization requires consistent chunk/row counts
  // -------------------------------------------------------------------------
  console.log('--- AC7: Finalization Consistency Gate ---');
  {
    const cFail = createMockContext({
      user: mockUser,
      params: { id: testBatchId, importId: activeImportId },
      body: { totalExpectedRows: 999999 }, // Mismatched row count
    });
    await finalizeImport(cFail as any);
    assert.strictEqual(cFail._getResponse().status, 400);
    assert.strictEqual(cFail._getResponse().data.error?.code, 'IMPORT_CHUNK_MISMATCH');
    console.log('   ✓ AC7 PASSED: Finalization strictly rejects on row count mismatch.\n');
  }

  // -------------------------------------------------------------------------
  // AC8: Re-import creates new revision; prior revision preserved
  // -------------------------------------------------------------------------
  console.log('--- AC8: Re-import Revision Segregation ---');
  {
    const cReimport = createMockContext({
      user: mockUser,
      params: { id: testBatchId },
      body: {
        sourceFileName: 'q4_candidates_v2.xlsx',
        sourceFileSize: 9000,
      },
    });
    await createImport(cReimport as any);
    const newImport = cReimport._getResponse().data.batchImport;
    assert.strictEqual(newImport.revision, 2, 'Re-import must increment revision to 2');

    // Prior revision 1 records remain accessible and distinct
    const rev1Records = await DraftRow.find({ batchId: testBatchId, revision: 1 });
    assert.ok(rev1Records.length > 0, 'Revision 1 records preserved in database');
    console.log('   ✓ AC8 PASSED: Re-import created revision 2; revision 1 untouched.\n');
  }

  // -------------------------------------------------------------------------
  // PERFORMANCE BENCHMARK: 5,000 SYNTHETIC ROWS INGESTION & VALIDATION
  // -------------------------------------------------------------------------
  console.log('--- PERFORMANCE BENCHMARK: 5,000 Rows Bounded Ingestion ---');
  {
    const startTime = Date.now();
    const benchmarkBatch = await Batch.create({
      ownerId: testUserId,
      templateId: template._id,
      templateVersionId: templateVersion._id,
      name: '5,000 Rows Benchmark Batch',
      status: 'importing',
      currentImportRevision: 1,
    });

    const benchmarkImport = await BatchImport.create({
      batchId: benchmarkBatch._id,
      ownerId: testUserId,
      revision: 1,
      sourceFileName: 'synthetic_5000.csv',
      sourceFileSize: 250000,
      columnMap: {
        recipientName: 'Full Name',
        awardDate: 'Award Date',
        finalScore: 'Score',
      },
      status: 'uploading',
      receivedChunkIds: [],
    });

    const TOTAL_ROWS = 5000;
    const CHUNK_SIZE = 500;
    const TOTAL_CHUNKS = TOTAL_ROWS / CHUNK_SIZE;

    console.log(`   Ingesting ${TOTAL_ROWS} rows in ${TOTAL_CHUNKS} bounded chunks (${CHUNK_SIZE} rows/chunk)...`);

    for (let c = 0; c < TOTAL_CHUNKS; c++) {
      const chunkRows = [];
      for (let r = 0; r < CHUNK_SIZE; r++) {
        const rowNum = c * CHUNK_SIZE + r + 1;
        chunkRows.push({
          sourceRowNumber: rowNum,
          rowKey: `bench_${rowNum}`,
          importedData: {
            'Full Name': `Candidate ${rowNum}`,
            'Award Date': '2026-06-15',
            Score: String(80 + (rowNum % 20)),
          },
        });
      }

      const cCtx = createMockContext({
        user: mockUser,
        params: { id: benchmarkBatch._id.toString(), importId: benchmarkImport._id.toString() },
        body: {
          chunkId: `bench_chunk_${c}`,
          chunkIndex: c,
          totalChunks: TOTAL_CHUNKS,
          rows: chunkRows,
        },
      });
      await submitRowsChunk(cCtx as any);
    }

    // Finalize benchmark batch
    const cFinal = createMockContext({
      user: mockUser,
      params: { id: benchmarkBatch._id.toString(), importId: benchmarkImport._id.toString() },
      body: {
        totalExpectedRows: TOTAL_ROWS,
        totalExpectedChunks: TOTAL_CHUNKS,
      },
    });
    await finalizeImport(cFinal as any);

    const elapsedMs = Date.now() - startTime;
    const count = await DraftRow.countDocuments({ importId: benchmarkImport._id });
    assert.strictEqual(count, TOTAL_ROWS, 'All 5,000 rows must be persisted');

    console.log(`   ✓ Benchmark Complete: ${TOTAL_ROWS} rows ingested & validated in ${elapsedMs}ms (${(elapsedMs / 1000).toFixed(2)}s).`);
    assert.ok(elapsedMs < 60000, `Throughput must complete within 60 seconds over WAN cloud database (actual: ${elapsedMs}ms)`);

    // Clean up benchmark batch
    await DraftRow.deleteMany({ importId: benchmarkImport._id });
    await BatchImport.deleteMany({ _id: benchmarkImport._id });
    await Batch.deleteMany({ _id: benchmarkBatch._id });
  }

  // Cleanup test database
  await DraftRow.deleteMany({ batchId: testBatchId });
  await BatchImport.deleteMany({ batchId: testBatchId });
  await Batch.deleteMany({ _id: testBatchId });
  await TemplateVersion.deleteMany({ templateId: template._id });
  await Template.deleteMany({ _id: template._id });
  await mongoose.disconnect();

  console.log('\n===========================================================');
  console.log('🎉 ALL PRD-CORE-04 ACCEPTANCE CRITERIA (AC1-AC8) PASSED!');
  console.log('===========================================================');
}

runAcceptanceCriteriaMatrix().catch((err) => {
  console.error('❌ Acceptance criteria matrix failed:', err);
  process.exit(1);
});
