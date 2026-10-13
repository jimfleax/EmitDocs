import 'dotenv/config';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { Batch } from '../api/models/Batch.js';
import { BatchImport } from '../api/models/BatchImport.js';
import { DraftRow } from '../api/models/DraftRow.js';
import { Template } from '../api/models/Template.js';
import { TemplateVersion } from '../api/models/TemplateVersion.js';
import {
  createBatch,
  createImport,
  updateImportMapping,
  submitRowsChunk,
  finalizeImport,
  getBatchActivity,
  deleteBatch,
  getBatches,
} from '../api/controllers/batches.controller.js';

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

async function runTests() {
  console.log('🧪 Starting batches-api controller and pipeline test suite...');

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { dbName: 'emitdocs_test' });
  console.log('  ✓ Connected to test database');

  const testUserId = `test_user_${Date.now()}`;
  const mockUser = { id: testUserId, email: 'test@example.com' };

  // Setup Template & TemplateVersion fixture
  const template = await Template.create({
    ownerId: testUserId,
    name: 'Diploma Template',
    cloudinaryPublicId: 'sample_cert',
    sourceUrl: 'https://example.com/cert.pdf',
    status: 'active',
  });

  const templateVersion = await TemplateVersion.create({
    templateId: template._id,
    ownerId: testUserId,
    version: 1,
    sourceObjectKey: 'cert.pdf',
    bytes: 1024,
    pageCount: 1,
    status: 'active',
    fieldMappings: [
      {
        id: 'f1',
        key: 'studentName',
        label: 'Student Name',
        type: 'text',
        required: true,
        pageIndex: 0,
        rect: { x: 50, y: 100, width: 200, height: 30 },
      },
      {
        id: 'f2',
        key: 'gradDate',
        label: 'Graduation Date',
        type: 'date',
        required: true,
        pageIndex: 0,
        rect: { x: 50, y: 150, width: 200, height: 30 },
      },
      {
        id: 'f3',
        key: 'gpa',
        label: 'GPA',
        type: 'number',
        required: false,
        pageIndex: 0,
        rect: { x: 50, y: 200, width: 100, height: 30 },
      },
    ],
    mappingHash: 'a'.repeat(64),
  });

  template.currentVersionId = templateVersion._id;
  await template.save();

  let testBatchId: string = '';
  let testImportId: string = '';

  // 1. Create Batch
  {
    console.log('Test 1: Create Batch');
    const c = createMockContext({
      user: mockUser,
      body: {
        name: 'Spring 2026 Batch',
        templateId: template._id.toString(),
      },
    });

    await createBatch(c as any);
    const { data, status } = c._getResponse();
    assert.strictEqual(status, 201, 'Should return 201');
    assert.strictEqual(data.batch.name, 'Spring 2026 Batch');
    assert.strictEqual(data.batch.status, 'draft');
    assert.strictEqual(data.batch.currentImportRevision, 0);
    testBatchId = data.batch._id.toString();
    console.log('  ✓ Batch created successfully');
  }

  // 2. Create Import (Revision 1) (AC8)
  {
    console.log('Test 2: Create Import (Revision 1)');
    const c = createMockContext({
      user: mockUser,
      params: { id: testBatchId },
      body: {
        sourceFileName: 'students.xlsx',
        sourceFileSize: 10240,
        worksheetName: 'Honors',
        availableWorksheets: ['Honors', 'General'],
        rawHeaders: ['Full Name', 'Date of Grad', 'GPA Score'],
        disambiguatedHeaders: ['Full Name', 'Date of Grad', 'GPA Score'],
        columnMap: {
          studentName: 'Full Name',
          gradDate: 'Date of Grad',
          gpa: 'GPA Score',
        },
      },
    });

    await createImport(c as any);
    const { data, status } = c._getResponse();
    assert.strictEqual(status, 201);
    assert.strictEqual(data.batchImport.revision, 1);
    assert.strictEqual(data.batchImport.sourceFileName, 'students.xlsx');
    testImportId = data.batchImport._id.toString();
    console.log('  ✓ Import revision 1 created');
  }

  // 3. Update Mapping Persistence (AC2)
  {
    console.log('Test 3: Update column mapping (AC2)');
    const updatedMap = {
      studentName: 'Full Name',
      gradDate: 'Date of Grad',
    };
    const c = createMockContext({
      user: mockUser,
      params: { id: testBatchId, importId: testImportId },
      body: { columnMap: updatedMap },
    });

    await updateImportMapping(c as any);
    const { data, status } = c._getResponse();
    assert.strictEqual(status, 200);
    assert.deepStrictEqual(data.batchImport.columnMap, updatedMap);

    const persisted = await BatchImport.findById(testImportId);
    assert.deepStrictEqual(persisted?.columnMap, updatedMap);
    console.log('  ✓ Column mapping persisted successfully (AC2)');
  }

  // 4. Submit Row Chunk & Idempotency Check (AC6, AC3)
  {
    console.log('Test 4: Chunk submission and idempotency retry (AC6, AC3)');
    const rowsChunk = [
      {
        sourceRowNumber: 2,
        rowKey: 'row_2',
        importedData: { 'Full Name': 'Alice Walker', 'Date of Grad': '2026-06-15', 'GPA Score': '3.9' },
      },
      {
        sourceRowNumber: 3,
        rowKey: 'row_3',
        importedData: { 'Full Name': '', 'Date of Grad': '2026-06-15' }, // Missing required studentName (AC3)
      },
      {
        sourceRowNumber: 4,
        rowKey: 'row_4',
        importedData: { 'Full Name': 'Alice Walker', 'Date of Grad': '2026-06-15' }, // Duplicate of row 2 (AC4)
      },
    ];

    const c1 = createMockContext({
      user: mockUser,
      params: { id: testBatchId, importId: testImportId },
      body: {
        chunkId: 'chunk_test_001',
        chunkIndex: 0,
        totalChunks: 1,
        rows: rowsChunk,
      },
    });

    await submitRowsChunk(c1 as any);
    const res1 = c1._getResponse();
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.data.idempotent, false);
    assert.strictEqual(res1.data.processed, 3);

    // Verify draft rows in DB
    const countAfterFirst = await DraftRow.countDocuments({ importId: testImportId });
    assert.strictEqual(countAfterFirst, 3, 'Should have persisted 3 draft rows');

    // Verify row 3 has REQUIRED_FIELD_MISSING error
    const row3 = await DraftRow.findOne({ importId: testImportId, rowKey: 'row_3' });
    assert.strictEqual(row3?.status, 'invalid');
    assert.ok(row3?.errors.some((e) => e.code === 'REQUIRED_FIELD_MISSING'), 'Row 3 must flag REQUIRED_FIELD_MISSING');

    // Now dispatch exact same chunk again (Idempotency retry AC6)
    const c2 = createMockContext({
      user: mockUser,
      params: { id: testBatchId, importId: testImportId },
      body: {
        chunkId: 'chunk_test_001',
        chunkIndex: 0,
        totalChunks: 1,
        rows: rowsChunk,
      },
    });

    await submitRowsChunk(c2 as any);
    const res2 = c2._getResponse();
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.data.idempotent, true, 'Submitting duplicate chunkId must be flagged idempotent');

    const countAfterRetry = await DraftRow.countDocuments({ importId: testImportId });
    assert.strictEqual(countAfterRetry, 3, 'Retry must NOT duplicate rows in database (AC6)');
    console.log('  ✓ Chunk submission and idempotent retry verified (AC6, AC3)');
  }

  // 5. Finalization with Mismatch & Success (AC7, AC4)
  {
    console.log('Test 5: Finalization validation and duplicate preservation (AC7, AC4)');

    // 5a. Mismatched chunk count fails (AC7)
    const cMismatch = createMockContext({
      user: mockUser,
      params: { id: testBatchId, importId: testImportId },
      body: {
        totalExpectedChunks: 2, // but only 1 received
        totalExpectedRows: 3,
      },
    });
    await finalizeImport(cMismatch as any);
    assert.strictEqual(cMismatch._getResponse().status, 400);
    assert.strictEqual(cMismatch._getResponse().data.error?.code, 'IMPORT_CHUNK_MISMATCH');

    // 5b. Correct finalization succeeds
    const cFinal = createMockContext({
      user: mockUser,
      params: { id: testBatchId, importId: testImportId },
      body: {
        totalExpectedChunks: 1,
        totalExpectedRows: 3,
      },
    });
    await finalizeImport(cFinal as any);
    const { data, status } = cFinal._getResponse();
    assert.strictEqual(status, 200);
    assert.strictEqual(data.summary.totalRows, 3);
    assert.strictEqual(data.summary.validRows, 2); // row 2 and row 4
    assert.strictEqual(data.summary.invalidRows, 1); // row 3
    assert.strictEqual(data.summary.duplicateRows, 1); // row 4 is duplicate of row 2

    // Check duplicate row 4 was preserved (AC4)
    const row4 = await DraftRow.findOne({ importId: testImportId, rowKey: 'row_4' });
    assert.strictEqual(row4?.isDuplicate, true);
    assert.deepStrictEqual(row4?.duplicateReferences, [2]);
    assert.ok(row4?.warnings.some((w) => w.code === 'DUPLICATE_ROW'));

    // Check batch status transitioned to review
    const updatedBatch = await Batch.findById(testBatchId);
    assert.strictEqual(updatedBatch?.status, 'review');
    assert.strictEqual(updatedBatch?.currentImportRevision, 1);
    console.log('  ✓ Finalization integrity and duplicate preservation verified (AC7, AC4)');
  }

  // 6. Re-import Segregation (AC8)
  {
    console.log('Test 6: Re-import creates revision 2 and preserves revision 1 (AC8)');
    const cReimport = createMockContext({
      user: mockUser,
      params: { id: testBatchId },
      body: {
        sourceFileName: 'students_v2.xlsx',
        sourceFileSize: 20480,
      },
    });

    await createImport(cReimport as any);
    const { data } = cReimport._getResponse();
    assert.strictEqual(data.batchImport.revision, 2, 'Re-import must increment revision to 2');

    // Assert revision 1 rows are completely untouched
    const rev1Count = await DraftRow.countDocuments({ batchId: testBatchId, revision: 1 });
    assert.strictEqual(rev1Count, 3, 'Revision 1 draft rows must remain intact');
    console.log('  ✓ Re-import revision segregation verified (AC8)');
  }

  // ----------------------------------------------------
  // Test 7: 30-Day Real Activity Endpoint
  // ----------------------------------------------------
  console.log('Test 7: 30-Day Real Activity Endpoint');
  {
    const cActivity = createMockContext({
      user: mockUser,
      query: { days: '30' },
    });
    await getBatchActivity(cActivity as any);
    const { data, status } = cActivity._getResponse();
    assert.strictEqual(status, 200, 'getBatchActivity must return 200');
    assert.strictEqual(data.timeframe, '30d', 'timeframe must be 30d');
    assert.strictEqual(data.activity.length, 30, 'activity must contain 30 daily buckets');
    assert.ok(data.totalBatches >= 1, 'totalBatches must count created batches in window');
    console.log('  ✓ 30-day activity endpoint verified');
  }

  // ----------------------------------------------------
  // Test 8: Batch Deletion and Cascade Cleanup
  // ----------------------------------------------------
  console.log('Test 8: Batch Deletion and Cascade Cleanup');
  {
    const rowCountBefore = await DraftRow.countDocuments({ batchId: testBatchId });
    assert.ok(rowCountBefore > 0, 'Rows should exist before deletion');

    const cDelete = createMockContext({
      user: mockUser,
      params: { id: testBatchId },
    });
    await deleteBatch(cDelete as any);
    const { data, status } = cDelete._getResponse();
    assert.strictEqual(status, 200, 'deleteBatch must return 200');
    assert.strictEqual(data.success, true, 'deleteBatch must succeed');

    const deletedBatch = await Batch.findById(testBatchId);
    assert.strictEqual(deletedBatch, null, 'Batch should be deleted from DB');

    const remainingRows = await DraftRow.countDocuments({ batchId: testBatchId });
    assert.strictEqual(remainingRows, 0, 'Associated draft rows should be cascade deleted');

    const remainingImports = await BatchImport.countDocuments({ batchId: testBatchId });
    assert.strictEqual(remainingImports, 0, 'Associated imports should be cascade deleted');

    console.log('  ✓ Batch and associated records deleted cleanly');
  }

  // ----------------------------------------------------
  console.log('Test 9: Listing Batches with Template Population & Scoping');
  {
    const otherUserId = `other_user_${Date.now()}`;
    const b1 = await Batch.create({
      ownerId: testUserId,
      templateId: template._id,
      templateVersionId: templateVersion._id,
      name: 'Alpha Batch Run',
      status: 'ready_for_download',
      totalRows: 10,
      validRows: 10,
    });
    const b2 = await Batch.create({
      ownerId: testUserId,
      templateId: template._id,
      templateVersionId: templateVersion._id,
      name: 'Beta Batch Run',
      status: 'draft',
      totalRows: 5,
      validRows: 0,
    });
    const bOther = await Batch.create({
      ownerId: otherUserId,
      templateId: template._id,
      templateVersionId: templateVersion._id,
      name: 'Foreign Batch Run',
      status: 'ready_for_download',
    });

    const cGet = createMockContext({ user: mockUser });
    await getBatches(cGet as any);
    const { data, status } = cGet._getResponse();

    assert.strictEqual(status, 200, 'getBatches must return 200');
    assert.ok(Array.isArray(data.batches), 'Must return batches array');
    assert.strictEqual(data.batches.length, 2, 'Should only return user batches (2)');
    assert.strictEqual(data.batches[0].name, 'Beta Batch Run', 'Newest batch should be first');
    assert.ok(data.batches[0].templateId, 'templateId should be present');
    assert.strictEqual(data.batches[0].templateId.name, 'Diploma Template', 'templateId should be populated with template name');

    // Clean up created test batches
    await Batch.deleteMany({ _id: { $in: [b1._id, b2._id, bOther._id] } });
    console.log('  ✓ Batches listed correctly with populated templateId');
  }

  // Clean up test documents
  await DraftRow.deleteMany({ batchId: testBatchId });
  await BatchImport.deleteMany({ batchId: testBatchId });
  await Batch.deleteMany({ ownerId: testUserId });
  await TemplateVersion.deleteMany({ templateId: template._id });
  await Template.deleteMany({ _id: template._id });
  await mongoose.disconnect();

  console.log('\n🎉 ALL batches-api TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('❌ Batches API test failed:', err);
  process.exit(1);
});
