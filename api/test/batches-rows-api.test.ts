import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(__dirname, '../../api/.env') });
}

import { Batch } from '../api/models/Batch.js';
import { DraftRow } from '../api/models/DraftRow.js';
import { Template } from '../api/models/Template.js';
import { TemplateVersion } from '../api/models/TemplateVersion.js';
import { getDraftRows } from '../api/controllers/batches.controller.js';

function createMockContext({ user, params = {}, query = {} }: any) {
  let responseData: any = null;
  let responseStatus = 200;
  return {
    get: (key: string) => (key === 'user' ? user : undefined),
    req: {
      param: (key?: string) => (key ? params[key] : params),
      query: (key?: string) => (key ? query[key] : query),
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
  console.log('🧪 Starting Slice 1: Backend Row API Enhancements Test Suite...');

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI missing from environment');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { dbName: 'emitdocs_test' });
  console.log('✓ Connected to MongoDB');

  const userA = { id: `user_a_${Date.now()}` };
  const userB = { id: `user_b_${Date.now()}` };

  // Fixture: Template & Version
  const template = await Template.create({
    ownerId: userA.id,
    name: 'Row API Test Template',
  });

  const templateVersion = await TemplateVersion.create({
    templateId: template._id,
    ownerId: userA.id,
    version: 1,
    sourceObjectKey: 'cert.pdf',
    bytes: 1024,
    pageCount: 1,
    fieldMappings: [
      {
        id: 'f1',
        key: 'studentName',
        label: 'Student Name',
        type: 'text',
        pageIndex: 0,
        rect: { x: 0, y: 0, width: 100, height: 20 },
        alignment: 'left',
        fontFamily: 'Helvetica',
        fontSize: 12,
        minFontSize: 8,
        maxFontSize: 24,
        color: '#000000',
        fitMode: 'shrink-to-fit',
        maskMode: 'none',
      },
    ],
  });

  template.currentVersionId = templateVersion._id;
  await template.save();

  // Fixture: Batch
  const batch = await Batch.create({
    ownerId: userA.id,
    templateId: template._id,
    templateVersionId: templateVersion._id,
    name: 'Row API Test Batch',
    status: 'review',
    currentImportRevision: 1,
  });

  const importId = new mongoose.Types.ObjectId();

  // Seed 120 Draft Rows
  console.log('Seeding 120 draft rows...');
  const bulkRows = [];
  for (let i = 1; i <= 120; i++) {
    let status = 'valid';
    let errors: any[] = [];
    let warnings: any[] = [];
    let isDuplicate = false;
    let overrides: any = {};
    let rowKey = `rk_${i}`;
    let studentName = `Student ${i}`;

    if (i === 1) {
      studentName = 'Alice Anderson';
    } else if (i === 2) {
      status = 'invalid';
      errors = [{ field: 'studentName', code: 'REQUIRED_FIELD_MISSING', message: 'Required' }];
      studentName = '';
    } else if (i === 3) {
      isDuplicate = true;
      warnings = [{ field: 'studentName', code: 'DUPLICATE_ROW', message: 'Duplicate record' }];
      studentName = 'Charlie Clark';
    } else if (i === 4) {
      warnings = [{ field: 'studentName', code: 'OVERFLOW', message: 'Text overflow' }];
      studentName = 'David Davis';
    } else if (i === 5) {
      overrides = { studentName: 'Eva Evans Edited' };
      studentName = 'Eva Evans Edited';
    } else if (i === 42) {
      rowKey = 'rk_custom_12';
      studentName = 'Row FortyTwo';
    }

    bulkRows.push({
      batchId: batch._id,
      importId,
      ownerId: userA.id,
      revision: 1,
      rowKey,
      sourceRowNumber: i,
      importedData: { 'Full Name': studentName },
      effectiveData: { studentName },
      overrides,
      status,
      errors,
      warnings,
      isDuplicate,
      version: 1,
    });
  }

  await DraftRow.insertMany(bulkRows);
  console.log('✓ Seeded 120 rows');

  // Test 1: Pagination
  {
    console.log('Test 1: test_pagination (page=2, limit=50)');
    const c = createMockContext({
      user: userA,
      params: { id: batch._id.toString() },
      query: { page: '2', limit: '50' },
    });
    await getDraftRows(c as any);
    const res = c._getResponse().data;

    assert.strictEqual(res.page, 2, 'Page should be 2');
    assert.strictEqual(res.limit, 50, 'Limit should be 50');
    assert.strictEqual(res.total, 120, 'Total should be 120');
    assert.strictEqual(res.totalPages, 3, 'TotalPages should be 3');
    assert.strictEqual(res.rows.length, 50, 'Should return 50 rows');
    assert.strictEqual(res.rows[0].sourceRowNumber, 51, 'First row on page 2 should be row 51');
    assert.strictEqual(res.rows[49].sourceRowNumber, 100, 'Last row on page 2 should be row 100');
    console.log('  ✓ Pagination passed');
  }

  // Test 2: Search by numeric row number
  {
    console.log('Test 2: test_search_by_numeric_row_number (query=42)');
    const c = createMockContext({
      user: userA,
      params: { id: batch._id.toString() },
      query: { query: '42' },
    });
    await getDraftRows(c as any);
    const res = c._getResponse().data;

    assert.ok(res.rows.length >= 1, 'Should find row matching 42');
    assert.ok(res.rows.some((r: any) => r.sourceRowNumber === 42), 'Row 42 must be in results');
    console.log('  ✓ Search by numeric row number passed');
  }

  // Test 3: Search by effectiveData
  {
    console.log('Test 3: test_search_by_effective_data (query="Alice")');
    const c = createMockContext({
      user: userA,
      params: { id: batch._id.toString() },
      query: { query: 'Alice' },
    });
    await getDraftRows(c as any);
    const res = c._getResponse().data;

    assert.strictEqual(res.rows.length, 1);
    assert.strictEqual(res.rows[0].sourceRowNumber, 1);
    assert.strictEqual(res.rows[0].effectiveData.studentName, 'Alice Anderson');
    console.log('  ✓ Search by effectiveData passed');
  }

  // Test 4: Search by rowKey
  {
    console.log('Test 4: test_search_by_row_key (query="rk_custom_12")');
    const c = createMockContext({
      user: userA,
      params: { id: batch._id.toString() },
      query: { query: 'rk_custom_12' },
    });
    await getDraftRows(c as any);
    const res = c._getResponse().data;

    assert.strictEqual(res.rows.length, 1);
    assert.strictEqual(res.rows[0].rowKey, 'rk_custom_12');
    assert.strictEqual(res.rows[0].sourceRowNumber, 42);
    console.log('  ✓ Search by rowKey passed');
  }

  // Test 5: Filter facets
  {
    console.log('Test 5: test_filter_facets (all, valid, invalid, duplicate, warning, overridden)');
    // all
    const cAll = createMockContext({
      user: userA,
      params: { id: batch._id.toString() },
      query: { filter: 'all' },
    });
    await getDraftRows(cAll as any);
    assert.strictEqual(cAll._getResponse().data.total, 120);

    // valid
    const cValid = createMockContext({
      user: userA,
      params: { id: batch._id.toString() },
      query: { filter: 'valid' },
    });
    await getDraftRows(cValid as any);
    assert.strictEqual(cValid._getResponse().data.total, 119);

    // invalid
    const cInvalid = createMockContext({
      user: userA,
      params: { id: batch._id.toString() },
      query: { filter: 'invalid' },
    });
    await getDraftRows(cInvalid as any);
    assert.strictEqual(cInvalid._getResponse().data.total, 1);
    assert.strictEqual(cInvalid._getResponse().data.rows[0].sourceRowNumber, 2);

    // duplicate
    const cDup = createMockContext({
      user: userA,
      params: { id: batch._id.toString() },
      query: { filter: 'duplicate' },
    });
    await getDraftRows(cDup as any);
    assert.strictEqual(cDup._getResponse().data.total, 1);
    assert.strictEqual(cDup._getResponse().data.rows[0].sourceRowNumber, 3);

    // warning
    const cWarn = createMockContext({
      user: userA,
      params: { id: batch._id.toString() },
      query: { filter: 'warning' },
    });
    await getDraftRows(cWarn as any);
    assert.strictEqual(cWarn._getResponse().data.total, 2); // row 3 and row 4

    // overridden
    const cOver = createMockContext({
      user: userA,
      params: { id: batch._id.toString() },
      query: { filter: 'overridden' },
    });
    await getDraftRows(cOver as any);
    assert.strictEqual(cOver._getResponse().data.total, 1);
    assert.strictEqual(cOver._getResponse().data.rows[0].sourceRowNumber, 5);
    console.log('  ✓ Filter facets passed');
  }

  // Test 6: Summary facets
  {
    console.log('Test 6: test_summary_facets');
    const c = createMockContext({
      user: userA,
      params: { id: batch._id.toString() },
      query: { page: '1', limit: '10' },
    });
    await getDraftRows(c as any);
    const summary = c._getResponse().data.summary;

    assert.deepStrictEqual(summary, {
      totalRows: 120,
      validRows: 119,
      invalidRows: 1,
      duplicateRows: 1,
      warningRows: 2,
      overriddenRows: 1,
    });
    console.log('  ✓ Summary facets passed');
  }

  // Test 7: Cross user isolation
  {
    console.log('Test 7: test_cross_user_isolation (User B querying User A batch)');
    const c = createMockContext({
      user: userB,
      params: { id: batch._id.toString() },
    });
    await getDraftRows(c as any);
    const res = c._getResponse();

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.data.error, 'Batch not found');
    console.log('  ✓ Cross-user isolation passed');
  }

  // Cleanup
  console.log('Cleaning up fixtures...');
  await DraftRow.deleteMany({ batchId: batch._id });
  await Batch.deleteMany({ _id: batch._id });
  await TemplateVersion.deleteMany({ _id: templateVersion._id });
  await Template.deleteMany({ _id: template._id });
  await mongoose.disconnect();

  console.log('\n🎉 ALL 7 SLICE 1 TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
