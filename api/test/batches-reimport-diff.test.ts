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
import { BatchImport } from '../api/models/BatchImport.js';
import { DraftRow } from '../api/models/DraftRow.js';
import { Template } from '../api/models/Template.js';
import { TemplateVersion } from '../api/models/TemplateVersion.js';
import { getReimportDiff, reconcileReimport } from '../api/controllers/batches.controller.js';

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

async function runTests() {
  console.log('🧪 Starting Slice 3: Backend Re-import Diff Engine & Reconciliation Test Suite...');

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI missing from environment');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { dbName: 'emitdocs_test' });
  console.log('✓ Connected to MongoDB');

  const userA = { id: `user_a_${Date.now()}` };
  const userB = { id: `user_b_${Date.now()}` };

  const template = await Template.create({
    ownerId: userA.id,
    name: 'Reimport Diff Test Template',
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
        key: 'studentId',
        label: 'Student ID',
        type: 'text',
        required: true,
        pageIndex: 0,
        rect: { x: 0, y: 0, width: 100, height: 20 },
      },
      {
        id: 'f2',
        key: 'studentName',
        label: 'Student Name',
        type: 'text',
        required: true,
        pageIndex: 0,
        rect: { x: 0, y: 30, width: 100, height: 20 },
      },
      {
        id: 'f3',
        key: 'email',
        label: 'Email',
        type: 'text',
        required: true,
        pageIndex: 0,
        rect: { x: 0, y: 60, width: 100, height: 20 },
      },
    ],
  });

  template.currentVersionId = templateVersion._id;
  await template.save();

  const batch = await Batch.create({
    ownerId: userA.id,
    templateId: template._id,
    templateVersionId: templateVersion._id,
    name: 'Reimport Diff Test Batch',
    status: 'review',
    currentImportRevision: 1,
    totalRows: 3,
    validRows: 3,
    invalidRows: 0,
    duplicateRows: 0,
    version: 1,
  });

  const importRev1 = await BatchImport.create({
    batchId: batch._id,
    ownerId: userA.id,
    revision: 1,
    sourceFileName: 'students_rev1.xlsx',
    sourceFileSize: 1024,
    columnMap: { studentId: 'ID', studentName: 'Name', email: 'Email' },
    status: 'completed',
    rowCount: 3,
    validCount: 3,
    invalidCount: 0,
    duplicateCount: 0,
  });

  // Old rows (Rev 1): S1, S2, S3
  const rowA = await DraftRow.create({
    batchId: batch._id,
    importId: importRev1._id,
    ownerId: userA.id,
    revision: 1,
    rowKey: 'row_1',
    sourceRowNumber: 1,
    importedData: { ID: 'S1', Name: 'Alice', Email: 'alice@example.com' },
    overrides: {},
    effectiveData: { studentId: 'S1', studentName: 'Alice', email: 'alice@example.com' },
    status: 'valid',
    errors: [],
    warnings: [],
    isDuplicate: false,
    version: 1,
  });

  await DraftRow.create({
    batchId: batch._id,
    importId: importRev1._id,
    ownerId: userA.id,
    revision: 1,
    rowKey: 'row_2',
    sourceRowNumber: 2,
    importedData: { ID: 'S2', Name: 'Bob', Email: 'bob@example.com' },
    overrides: { email: 'bob_override@example.com' },
    effectiveData: { studentId: 'S2', studentName: 'Bob', email: 'bob_override@example.com' },
    status: 'valid',
    errors: [],
    warnings: [],
    isDuplicate: false,
    version: 1,
  });

  const rowC = await DraftRow.create({
    batchId: batch._id,
    importId: importRev1._id,
    ownerId: userA.id,
    revision: 1,
    rowKey: 'row_3',
    sourceRowNumber: 3,
    importedData: { ID: 'S3', Name: 'Charlie', Email: 'charlie@example.com' },
    overrides: {},
    effectiveData: { studentId: 'S3', studentName: 'Charlie', email: 'charlie@example.com' },
    status: 'valid',
    errors: [],
    warnings: [],
    isDuplicate: false,
    version: 1,
  });

  // New import (Rev 2)
  const importRev2 = await BatchImport.create({
    batchId: batch._id,
    ownerId: userA.id,
    revision: 2,
    sourceFileName: 'students_rev2.xlsx',
    sourceFileSize: 1200,
    columnMap: { studentId: 'ID', studentName: 'Name', email: 'Email' },
    status: 'uploading',
    rowCount: 3,
    validCount: 3,
    invalidCount: 0,
    duplicateCount: 0,
  });

  // New rows (Rev 2): S1 (unchanged), S2 (spreadsheet changed name to Bobby and email to bob_new@example.com), S4 (added)
  await DraftRow.create({
    batchId: batch._id,
    importId: importRev2._id,
    ownerId: userA.id,
    revision: 2,
    rowKey: 'row_1',
    sourceRowNumber: 1,
    importedData: { ID: 'S1', Name: 'Alice', Email: 'alice@example.com' },
    overrides: {},
    effectiveData: { studentId: 'S1', studentName: 'Alice', email: 'alice@example.com' },
    status: 'valid',
    errors: [],
    warnings: [],
    isDuplicate: false,
    version: 1,
  });

  const newRowB = await DraftRow.create({
    batchId: batch._id,
    importId: importRev2._id,
    ownerId: userA.id,
    revision: 2,
    rowKey: 'row_2',
    sourceRowNumber: 2,
    importedData: { ID: 'S2', Name: 'Bobby', Email: 'bob_new@example.com' },
    overrides: {},
    effectiveData: { studentId: 'S2', studentName: 'Bobby', email: 'bob_new@example.com' },
    status: 'valid',
    errors: [],
    warnings: [],
    isDuplicate: false,
    version: 1,
  });

  const newRowD = await DraftRow.create({
    batchId: batch._id,
    importId: importRev2._id,
    ownerId: userA.id,
    revision: 2,
    rowKey: 'row_3',
    sourceRowNumber: 3,
    importedData: { ID: 'S4', Name: 'David', Email: 'david@example.com' },
    overrides: {},
    effectiveData: { studentId: 'S4', studentName: 'David', email: 'david@example.com' },
    status: 'valid',
    errors: [],
    warnings: [],
    isDuplicate: false,
    version: 1,
  });

  console.log('✓ Seeded base fixtures for Rev 1 and Rev 2');

  // Test 1: test_diff_classification
  {
    console.log('Test 1: test_diff_classification (added, removed, unchanged)');
    const c = createMockContext({
      user: userA,
      params: { id: batch._id.toString(), importId: importRev2._id.toString() },
      query: { reconciliationKey: 'studentId' },
    });
    await getReimportDiff(c as any);
    const res = c._getResponse();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.summary.addedCount, 1, 'S4 is added');
    assert.strictEqual(res.data.added[0].newRowId, newRowD._id.toString());
    assert.strictEqual(res.data.summary.removedCount, 1, 'S3 is removed');
    assert.strictEqual(res.data.removed[0].oldRowId, rowC._id.toString());
    assert.strictEqual(res.data.summary.unchangedCount, 1, 'S1 is unchanged');
    assert.strictEqual(res.data.unchanged[0].oldRowId, rowA._id.toString());
    console.log('  ✓ test_diff_classification passed');
  }

  // Test 2: test_override_conflict_detection
  {
    console.log('Test 2: test_override_conflict_detection');
    const c = createMockContext({
      user: userA,
      params: { id: batch._id.toString(), importId: importRev2._id.toString() },
      query: { reconciliationKey: 'studentId' },
    });
    await getReimportDiff(c as any);
    const res = c._getResponse();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.summary.conflictedCount, 1, 'Row B has conflict on email');
    const conf = res.data.conflicted[0];
    assert.strictEqual(conf.field, 'email');
    assert.strictEqual(conf.oldImported, 'bob@example.com');
    assert.strictEqual(conf.newImported, 'bob_new@example.com');
    assert.strictEqual(conf.override, 'bob_override@example.com');
    console.log('  ✓ test_override_conflict_detection passed');
  }

  // Test 3: test_ambiguous_on_duplicate_key_collision
  {
    console.log('Test 3: test_ambiguous_on_duplicate_key_collision');
    const dupRow1 = await DraftRow.create({
      batchId: batch._id,
      importId: importRev2._id,
      ownerId: userA.id,
      revision: 2,
      rowKey: 'row_dup_1',
      sourceRowNumber: 10,
      importedData: { ID: 'S100', Name: 'Dup One', Email: 'dup1@example.com' },
      effectiveData: { studentId: 'S100', studentName: 'Dup One', email: 'dup1@example.com' },
      version: 1,
    });
    const dupRow2 = await DraftRow.create({
      batchId: batch._id,
      importId: importRev2._id,
      ownerId: userA.id,
      revision: 2,
      rowKey: 'row_dup_2',
      sourceRowNumber: 11,
      importedData: { ID: 'S100', Name: 'Dup Two', Email: 'dup2@example.com' },
      effectiveData: { studentId: 'S100', studentName: 'Dup Two', email: 'dup2@example.com' },
      version: 1,
    });

    const c = createMockContext({
      user: userA,
      params: { id: batch._id.toString(), importId: importRev2._id.toString() },
      query: { reconciliationKey: 'studentId' },
    });
    await getReimportDiff(c as any);
    const res = c._getResponse();

    const collisions = res.data.ambiguous.filter((a: any) => a.reason === 'COLLISION');
    assert.strictEqual(collisions.length, 2, 'Both colliding rows must be tagged COLLISION');
    assert(collisions.some((item: any) => item.rowKey === 'row_dup_1'));
    assert(collisions.some((item: any) => item.rowKey === 'row_dup_2'));

    await DraftRow.deleteMany({ _id: { $in: [dupRow1._id, dupRow2._id] } });
    console.log('  ✓ test_ambiguous_on_duplicate_key_collision passed');
  }

  // Test 4: test_ambiguous_on_missing_key
  {
    console.log('Test 4: test_ambiguous_on_missing_key');
    const blankKeyRow = await DraftRow.create({
      batchId: batch._id,
      importId: importRev2._id,
      ownerId: userA.id,
      revision: 2,
      rowKey: 'row_blank_key',
      sourceRowNumber: 12,
      importedData: { ID: '', Name: 'Blank Key', Email: 'blank@example.com' },
      effectiveData: { studentId: '', studentName: 'Blank Key', email: 'blank@example.com' },
      version: 1,
    });

    const c = createMockContext({
      user: userA,
      params: { id: batch._id.toString(), importId: importRev2._id.toString() },
      query: { reconciliationKey: 'studentId' },
    });
    await getReimportDiff(c as any);
    const res = c._getResponse();

    const missing = res.data.ambiguous.filter((a: any) => a.reason === 'MISSING_KEY');
    assert.strictEqual(missing.length, 1, 'Blank ID row must be tagged MISSING_KEY');
    assert.strictEqual(missing[0].rowKey, 'row_blank_key');

    await DraftRow.deleteOne({ _id: blankKeyRow._id });
    console.log('  ✓ test_ambiguous_on_missing_key passed');
  }

  // Test 5: test_reconcile_applies_decisions
  {
    console.log('Test 5: test_reconcile_applies_decisions');
    const c = createMockContext({
      user: userA,
      params: { id: batch._id.toString(), importId: importRev2._id.toString() },
      body: {
        reconciliationKey: 'studentId',
        resolutions: {
          conflicts: [
            {
              newRowId: newRowB._id.toString(),
              field: 'email',
              resolution: 'keep_override',
            },
          ],
          ambiguous: [],
          carryForwardOverrides: true,
        },
      },
    });
    await reconcileReimport(c as any);
    const res = c._getResponse();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);

    const updatedRowB = await DraftRow.findById(newRowB._id);
    assert.strictEqual(
      updatedRowB?.overrides.email,
      'bob_override@example.com',
      'Override email kept via keep_override'
    );
    assert.strictEqual(
      updatedRowB?.effectiveData.email,
      'bob_override@example.com',
      'Effective email recomputed to override'
    );
    assert.strictEqual(
      updatedRowB?.effectiveData.studentName,
      'Bobby',
      'New spreadsheet name Bobby preserved'
    );
    console.log('  ✓ test_reconcile_applies_decisions passed');
  }

  // Test 6: test_reconcile_finalizes_batch
  {
    console.log('Test 6: test_reconcile_finalizes_batch');
    const updatedBatch = await Batch.findById(batch._id);
    assert.strictEqual(updatedBatch?.currentImportRevision, 2, 'Batch revision bumped to 2');
    assert.strictEqual(updatedBatch?.approvedSnapshotId, null, 'Approval snapshot cleared');
    assert.strictEqual(updatedBatch?.status, 'review', 'Status reset to review');
    assert.strictEqual(updatedBatch?.totalRows, 3, 'Counts recalculated: 3 surviving rows');
    assert.strictEqual(updatedBatch?.validRows, 3, 'Valid rows updated');

    const updatedImportRev2 = await BatchImport.findById(importRev2._id);
    assert.strictEqual(updatedImportRev2?.status, 'completed');
    assert.strictEqual(updatedImportRev2?.rowCount, 3);
    console.log('  ✓ test_reconcile_finalizes_batch passed');
  }

  // Test 7: test_cross_user_isolation
  {
    console.log('Test 7: test_cross_user_isolation (User B cannot access User A diff or reconcile)');
    const cDiff = createMockContext({
      user: userB,
      params: { id: batch._id.toString(), importId: importRev2._id.toString() },
      query: { reconciliationKey: 'studentId' },
    });
    await getReimportDiff(cDiff as any);
    const resDiff = cDiff._getResponse();
    assert.strictEqual(resDiff.status, 404, 'Diff returns 404 for unauthorized user');

    const cReconcile = createMockContext({
      user: userB,
      params: { id: batch._id.toString(), importId: importRev2._id.toString() },
      body: {},
    });
    await reconcileReimport(cReconcile as any);
    const resReconcile = cReconcile._getResponse();
    assert.strictEqual(resReconcile.status, 404, 'Reconcile returns 404 for unauthorized user');
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

  console.log('\n🎉 ALL 7 SLICE 3 TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
