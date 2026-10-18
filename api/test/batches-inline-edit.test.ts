/**
 * @file batches-inline-edit.test.ts
 * @description Tests inline editing and cell override functionality for draft rows in a batch, including revalidation against schema rules.
 * @architecture Controller integration test suite verifying patchDraftRow API endpoint, row state transitions, and authorization boundaries.
 * @agent_note Requires MONGODB_URI in environment; runs against emitdocs_test database with multi-tenant mock users.
 */

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

import { Batch } from '../src/models/Batch.js';
import { BatchImport } from '../src/models/BatchImport.js';
import { DraftRow } from '../src/models/DraftRow.js';
import { Template } from '../src/models/Template.js';
import { TemplateVersion } from '../src/models/TemplateVersion.js';
import { patchDraftRow } from '../src/controllers/batches.controller.js';

/**
 * @desc Creates a mock Hono/controller request context for testing draft row PATCH requests.
 * @param options - Context parameters including user, params, query, and request body.
 * @returns Mock context with request body resolver, JSON responder, and response inspector.
 */
function createMockContext({ user, params = {}, query = {}, body }: any) {
  let responseData: any = null;
  let responseStatus = 200;
  return {
    get: (key: string) => (key === 'user' ? user : undefined),
    req: {
      param: (key?: string) => (key ? params[key] : params),
      query: (key?: string) => (key ? query[key] : query),
      json: async () => body,
    },
    env: { incoming: { body } },
    json: (data: any, status = 200) => {
      responseData = data;
      responseStatus = status;
      return { data, status };
    },
    _getResponse: () => ({ data: responseData, status: responseStatus }),
  };
}

/**
 * @desc Main test runner executing inline row override and revalidation test cases.
 * @returns Promise resolving when all inline edit assertions pass.
 */
async function runTests() {
  console.log('🧪 Starting Slice 2: Backend Inline Row Override & Revalidation Test Suite...');

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI missing from environment');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { dbName: 'emitdocs_test' });
  console.log('✓ Connected to MongoDB');

  const userA = { id: `user_a_${Date.now()}` };
  const userB = { id: `user_b_${Date.now()}` };

  // Fixtures
  const template = await Template.create({
    ownerId: userA.id,
    name: 'Inline Edit Test Template',
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
        required: true,
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

  const batch = await Batch.create({
    ownerId: userA.id,
    templateId: template._id,
    templateVersionId: templateVersion._id,
    name: 'Inline Edit Test Batch',
    status: 'review',
    currentImportRevision: 1,
    totalRows: 1,
    validRows: 0,
    invalidRows: 1,
    duplicateRows: 0,
    version: 1,
  });

  const batchImport = await BatchImport.create({
    batchId: batch._id,
    ownerId: userA.id,
    revision: 1,
    sourceFileName: 'students.xlsx',
    sourceFileSize: 1024,
    columnMap: { studentName: 'Full Name' },
    status: 'completed',
    totalExpectedRows: 1,
    rowCount: 1,
    validCount: 0,
    invalidCount: 1,
    duplicateCount: 0,
  });

  const draftRow = await DraftRow.create({
    batchId: batch._id,
    importId: batchImport._id,
    ownerId: userA.id,
    revision: 1,
    rowKey: 'row_1',
    sourceRowNumber: 1,
    importedData: { 'Full Name': '' },
    overrides: {},
    effectiveData: { studentName: '' },
    status: 'invalid',
    errors: [{ field: 'studentName', code: 'REQUIRED_FIELD_MISSING', message: 'Field "Student Name" is required but empty.' }],
    warnings: [],
    isDuplicate: false,
    version: 1,
  });

  console.log('✓ Seeded fixtures');

  // Test 1: test_override_turns_invalid_to_valid
  {
    console.log('Test 1: test_override_turns_invalid_to_valid');
    const c = createMockContext({
      user: userA,
      params: { id: batch._id.toString(), rowId: draftRow._id.toString() },
      body: { expectedRevision: 1, expectedVersion: 1, overrides: { studentName: 'John Doe' } },
    });
    await patchDraftRow(c as any);
    const res = c._getResponse();

    assert.strictEqual(res.status, 200, 'Status should be 200');
    assert.strictEqual(res.data.row.status, 'valid');
    assert.strictEqual(res.data.row.effectiveData.studentName, 'John Doe');
    assert.strictEqual(res.data.row.errors.length, 0);
    assert.strictEqual(res.data.batchSummary.validRows, 1);
    assert.strictEqual(res.data.batchSummary.invalidRows, 0);

    const updated = await DraftRow.findById(draftRow._id);
    assert.strictEqual(updated?.status, 'valid');
    assert.strictEqual(updated?.errors.length, 0);
    assert.strictEqual(updated?.effectiveData.studentName, 'John Doe');
    console.log('  ✓ test_override_turns_invalid_to_valid passed');
  }

  // Test 2: test_imported_data_immutability
  {
    console.log('Test 2: test_imported_data_immutability');
    const updated = await DraftRow.findById(draftRow._id);
    assert.strictEqual(updated?.importedData['Full Name'], '', 'Raw importedData must remain empty string');
    assert.deepStrictEqual(updated?.overrides, { studentName: 'John Doe' });
    assert.strictEqual(updated?.effectiveData.studentName, 'John Doe');
    console.log('  ✓ test_imported_data_immutability passed');
  }

  // Test 3: test_version_increment
  {
    console.log('Test 3: test_version_increment');
    const updated = await DraftRow.findById(draftRow._id);
    assert.strictEqual(updated?.version, 2, 'Row version must increment from 1 to 2');
    console.log('  ✓ test_version_increment passed');
  }

  // Test 4: test_optimistic_locking_stale_batch
  {
    console.log('Test 4: test_optimistic_locking_stale_batch (expectedRevision: 0 when batch is 1)');
    const c = createMockContext({
      user: userA,
      params: { id: batch._id.toString(), rowId: draftRow._id.toString() },
      body: { expectedRevision: 0, expectedVersion: 2, overrides: { studentName: 'Another Name' } },
    });
    await patchDraftRow(c as any);
    const res = c._getResponse();

    assert.strictEqual(res.status, 409, 'Should fail with 409');
    assert.strictEqual(res.data.error, 'STALE_BATCH_REVISION');
    console.log('  ✓ test_optimistic_locking_stale_batch passed');
  }

  // Test 5: test_optimistic_locking_stale_row_version
  {
    console.log('Test 5: test_optimistic_locking_stale_row_version (expectedVersion: 1 when row is 2)');
    const c = createMockContext({
      user: userA,
      params: { id: batch._id.toString(), rowId: draftRow._id.toString() },
      body: { expectedRevision: 1, expectedVersion: 1, overrides: { studentName: 'Another Name' } },
    });
    await patchDraftRow(c as any);
    const res = c._getResponse();

    assert.strictEqual(res.status, 409, 'Should fail with 409');
    assert.strictEqual(res.data.error, 'CONCURRENT_MODIFICATION');
    console.log('  ✓ test_optimistic_locking_stale_row_version passed');
  }

  // Test 6: test_approval_invalidation
  {
    console.log('Test 6: test_approval_invalidation');
    const snapshotId = new mongoose.Types.ObjectId();
    await Batch.findByIdAndUpdate(batch._id, {
      status: 'awaiting_approval',
      approvedSnapshotId: snapshotId,
    });

    const c = createMockContext({
      user: userA,
      params: { id: batch._id.toString(), rowId: draftRow._id.toString() },
      body: { expectedRevision: 1, expectedVersion: 2, overrides: { studentName: 'Jane Doe' } },
    });
    await patchDraftRow(c as any);
    const res = c._getResponse();

    assert.strictEqual(res.status, 200);
    const updatedBatch = await Batch.findById(batch._id);
    assert.strictEqual(updatedBatch?.status, 'review', 'Batch status must reset to review');
    assert.strictEqual(updatedBatch?.approvedSnapshotId, null, 'approvedSnapshotId must be null');
    console.log('  ✓ test_approval_invalidation passed');
  }

  // Test 7: test_revert_override
  {
    console.log('Test 7: test_revert_override (override value null restores importedData)');
    await DraftRow.findByIdAndUpdate(draftRow._id, {
      importedData: { 'Full Name': 'Original Imported Name' },
    });

    const c = createMockContext({
      user: userA,
      params: { id: batch._id.toString(), rowId: draftRow._id.toString() },
      body: { expectedRevision: 1, expectedVersion: 3, overrides: { studentName: null } },
    });
    await patchDraftRow(c as any);
    const res = c._getResponse();

    assert.strictEqual(res.status, 200);
    const updated = await DraftRow.findById(draftRow._id);
    assert.strictEqual(updated?.overrides.studentName, undefined, 'studentName should be removed from overrides');
    assert.strictEqual(updated?.effectiveData.studentName, 'Original Imported Name', 'studentName restored from importedData');
    assert.strictEqual(updated?.status, 'valid');
    assert.strictEqual(updated?.version, 4);
    console.log('  ✓ test_revert_override passed');
  }

  // Test 8: test_cross_user_isolation
  {
    console.log('Test 8: test_cross_user_isolation (User B patching User A row)');
    const c = createMockContext({
      user: userB,
      params: { id: batch._id.toString(), rowId: draftRow._id.toString() },
      body: { expectedRevision: 1, expectedVersion: 4, overrides: { studentName: 'Hacker' } },
    });
    await patchDraftRow(c as any);
    const res = c._getResponse();

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.data.error, 'Batch not found or access denied');
    console.log('  ✓ test_cross_user_isolation passed');
  }

  // Cleanup
  console.log('Cleaning up fixtures...');
  await DraftRow.deleteMany({ batchId: batch._id });
  await BatchImport.deleteMany({ batchId: batch._id });
  await Batch.deleteMany({ _id: batch._id });
  await TemplateVersion.deleteMany({ _id: templateVersion._id });
  await Template.deleteMany({ _id: template._id });
  await mongoose.disconnect();

  console.log('\n🎉 ALL 8 SLICE 2 TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
