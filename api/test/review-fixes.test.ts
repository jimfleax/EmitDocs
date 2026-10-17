import 'dotenv/config';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { deleteAccount } from '../src/controllers/account.controller.js';
import { deleteUserAccount } from '../src/services/account-deletion.js';
import { approveBatch } from '../src/services/batch-approval.js';
import { Batch } from '../src/models/Batch.js';
import { BatchImport } from '../src/models/BatchImport.js';
import { DraftRow } from '../src/models/DraftRow.js';
import { Template } from '../src/models/Template.js';
import { TemplateVersion } from '../src/models/TemplateVersion.js';
import { ApprovedSnapshot } from '../src/models/ApprovedSnapshot.js';
import cloudinary from '../src/lib/cloudinary.js';

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

async function runReviewFixesTests() {
  console.log('🧪 Starting Review Fixes Verification Test Suite...\n');

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { dbName: 'emitdocs_review_fixes_test' });
  console.log('   ✓ Connected to test database\n');

  try {
    // -------------------------------------------------------------------------
    // Test 1: account.controller.ts check result.success
    // -------------------------------------------------------------------------
    console.log('1. Testing account.controller.ts non-200 on result.success === false...');
    const origDraftRowDelete = DraftRow.deleteMany;
    DraftRow.deleteMany = (async () => {
      throw new Error('Simulated cascade deletion error for controller test');
    }) as any;

    const mockCtxFail = createMockContext({ user: { id: 'u_ctrl_fail' } });
    await deleteAccount(mockCtxFail as any);
    const failResp = mockCtxFail._getResponse();
    assert.strictEqual(failResp.status, 500, 'Must return status 500 when result.success is false');
    assert.strictEqual(failResp.data.success, false);
    assert.strictEqual(failResp.data.result.success, false);
    assert(
      failResp.data.result.errors?.some((e: string) => e.includes('Simulated cascade deletion error')),
      'Result must contain cascade error'
    );
    console.log('   ✓ Failure response returned non-200 status and included result');

    // Restore DraftRow.deleteMany for success response test
    DraftRow.deleteMany = origDraftRowDelete;

    const mockCtxSuccess = createMockContext({ user: { id: `u_ctrl_succ_${Date.now()}` } });
    await deleteAccount(mockCtxSuccess as any);
    const successResp = mockCtxSuccess._getResponse();
    assert.strictEqual(successResp.status, 200, 'Must preserve status 200 when result.success is true');
    assert.strictEqual(successResp.data.success, true);
    assert.strictEqual(successResp.data.result.success, true);
    console.log('   ✓ Success response preserved status 200 with result');

    // -------------------------------------------------------------------------
    // Test 2: batch-approval.ts copy retentionHours and expiresAt in resumed-snapshot branch
    // -------------------------------------------------------------------------
    console.log('\n2. Testing batch-approval.ts resumed-snapshot recovery branch...');
    const testOwner = `resumed_test_${Date.now()}`;
    const tpl = await Template.create({
      ownerId: testOwner,
      name: 'Resumed Test Template',
      cloudinaryPublicId: 'templates/resumed/pdf',
      sourceUrl: 'https://example.com/test.pdf',
      status: 'active',
    });
    const tplVersion = await TemplateVersion.create({
      templateId: tpl._id,
      ownerId: testOwner,
      version: 1,
      bytes: 2048,
      pageCount: 1,
      fieldMappings: [
        {
          id: 'f1',
          key: 'fullName',
          label: 'Full Name',
          type: 'text',
          pageIndex: 0,
          rect: { x: 10, y: 10, width: 200, height: 30 },
          alignment: 'left',
        },
      ],
      mappingHash: 'test_hash_1',
      sourceObjectKey: 'templates/resumed/pdf',
    });

    const batch = await Batch.create({
      ownerId: testOwner,
      templateId: tpl._id,
      templateVersionId: tplVersion._id,
      name: 'Resumed Snapshot Test Batch',
      status: 'draft',
      retentionHours: 24, // Initial
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      currentImportRevision: 1,
    });

    const batchImport = await BatchImport.create({
      batchId: batch._id,
      ownerId: testOwner,
      revision: 1,
      sourceFileName: 'test.csv',
      sourceFileSize: 100,
      columnMap: { fullName: 'fullName' },
      rowCount: 1,
    });

    // Create a draft row
    await DraftRow.create({
      batchId: batch._id,
      importId: batchImport._id,
      ownerId: testOwner,
      revision: 1,
      sourceRowNumber: 1,
      rowKey: 'row_1',
      rawData: { fullName: 'Alice' },
      effectiveData: { fullName: 'Alice' },
      status: 'valid',
    });

    // Pre-create existing snapshot in 'building' status with retention 168 hours (7 days)
    const expectedRetentionHours = 168;
    const expectedExpiresAt = new Date(Date.now() + 168 * 3600 * 1000);
    const existingSnapshot = await ApprovedSnapshot.create({
      batchId: batch._id,
      ownerId: testOwner,
      templateId: tpl._id,
      templateVersionId: tplVersion._id,
      templateVersion: 1,
      mappingHash: 'test_hash_1',
      importRevision: 1,
      retentionHours: expectedRetentionHours,
      expiresAt: expectedExpiresAt,
      idempotencyKey: 'test_idempotency_resumed',
      status: 'building',
      totalRecipients: 1,
      canonicalDigest: 'in_progress',
    });

    // Point batch to existingSnapshot while still in draft to trigger resumed-snapshot flow
    batch.approvedSnapshotId = existingSnapshot._id;
    await batch.save();

    // Call approveBatch with idempotencyKey
    const approvalResult = await approveBatch({
      batchId: batch._id.toString(),
      ownerId: testOwner,
      idempotencyKey: 'test_idempotency_resumed',
      retentionHours: 24, // Request 24, but resumed snapshot should preserve its 168 hours!
    });

    assert.strictEqual(approvalResult.snapshot.status, 'ready');
    const updatedBatch = await Batch.findById(batch._id);
    assert(updatedBatch, 'Updated batch must exist');
    assert.strictEqual(updatedBatch.status, 'approved', 'Batch status must be approved');
    assert.strictEqual(
      updatedBatch.retentionHours,
      expectedRetentionHours,
      'Batch retentionHours must be copied from existingSnapshot'
    );
    assert.strictEqual(
      updatedBatch.expiresAt?.getTime(),
      expectedExpiresAt.getTime(),
      'Batch expiresAt must be copied from existingSnapshot'
    );
    console.log('   ✓ Resumed-snapshot recovery branch copied retentionHours and expiresAt onto batch');

    // -------------------------------------------------------------------------
    // Test 3: account-deletion.ts session and account deletion with string and ObjectId
    // -------------------------------------------------------------------------
    console.log('\n3. Testing account-deletion.ts session/account string and ObjectId matching...');
    const userDb = mongoose.connection.db;
    assert(userDb, 'User database connection must be available');

    const testUserIdStr = new mongoose.Types.ObjectId().toHexString();
    const testUserIdObj = new mongoose.Types.ObjectId(testUserIdStr);

    // Insert sessions: one with string userId, one with ObjectId userId
    await userDb.collection('session').insertMany([
      { _id: new mongoose.Types.ObjectId() as any, userId: testUserIdStr, token: 's_str' },
      { _id: new mongoose.Types.ObjectId() as any, userId: testUserIdObj as any, token: 's_obj' },
      { _id: new mongoose.Types.ObjectId() as any, userId: 'other_user', token: 's_other' },
    ]);

    // Insert accounts: one with string userId, one with ObjectId userId
    await userDb.collection('account').insertMany([
      { _id: new mongoose.Types.ObjectId() as any, userId: testUserIdStr, providerId: 'google_str' },
      { _id: new mongoose.Types.ObjectId() as any, userId: testUserIdObj as any, providerId: 'google_obj' },
      { _id: new mongoose.Types.ObjectId() as any, userId: 'other_user', providerId: 'google_other' },
    ]);

    // Insert user record
    await userDb.collection('user').insertOne({
      _id: testUserIdObj as any,
      id: testUserIdStr,
      email: 'delete_match@example.com',
    });

    const delResult = await deleteUserAccount(testUserIdStr);
    assert.strictEqual(delResult.success, true, 'deleteUserAccount must succeed');

    const remainingSessions = await userDb.collection('session').find({
      userId: { $in: [testUserIdStr, testUserIdObj] },
    }).toArray();
    assert.strictEqual(remainingSessions.length, 0, 'Both string and ObjectId session records must be deleted');

    const remainingAccounts = await userDb.collection('account').find({
      userId: { $in: [testUserIdStr, testUserIdObj] },
    }).toArray();
    assert.strictEqual(remainingAccounts.length, 0, 'Both string and ObjectId account records must be deleted');

    const remainingUser = await userDb.collection('user').findOne({
      $or: [{ _id: testUserIdObj }, { id: testUserIdStr }],
    });
    assert.strictEqual(remainingUser, null, 'User record must be deleted');

    const otherSession = await userDb.collection('session').findOne({ userId: 'other_user' });
    assert(otherSession, 'Unrelated session must remain intact');
    await userDb.collection('session').deleteOne({ userId: 'other_user' });
    await userDb.collection('account').deleteOne({ userId: 'other_user' });
    console.log('   ✓ Session and account collections wiped for both string and ObjectId representations');

    // -------------------------------------------------------------------------
    // Test 4: account-deletion.ts children deleted before parent & stop on cascade error
    // -------------------------------------------------------------------------
    console.log('\n4. Testing account-deletion.ts cascade failure stops before user/session deletion...');
    const failUserId = new mongoose.Types.ObjectId().toHexString();

    // Insert user and session for failUserId
    await userDb.collection('user').insertOne({
      _id: new mongoose.Types.ObjectId(failUserId) as any,
      id: failUserId,
      email: 'fail_cascade@example.com',
    });
    await userDb.collection('session').insertOne({
      _id: new mongoose.Types.ObjectId() as any,
      userId: failUserId,
      token: 'fail_session',
    });

    // Mock DraftRow.deleteMany to throw an error simulating a cascade deletion failure
    const originalDraftRowDeleteMany = DraftRow.deleteMany;
    DraftRow.deleteMany = (async () => {
      throw new Error('Simulated DraftRow cascade failure');
    }) as any;

    try {
      const failCascadeResult = await deleteUserAccount(failUserId);
      assert.strictEqual(failCascadeResult.success, false, 'Result must be success: false on cascade error');
      assert(failCascadeResult.errors?.length, 'Errors must contain cascade failure error');

      // Verify that execution DID NOT proceed to deleting user or session!
      const userStillExists = await userDb.collection('user').findOne({ id: failUserId });
      assert(userStillExists, 'User record must NOT be deleted when cascade deletion fails');

      const sessionStillExists = await userDb.collection('session').findOne({ userId: failUserId });
      assert(sessionStillExists, 'Session record must NOT be deleted when cascade deletion fails');

      console.log('   ✓ Cascade failure stopped execution: user and session records preserved');
    } finally {
      DraftRow.deleteMany = originalDraftRowDeleteMany;
      await userDb.collection('user').deleteOne({ id: failUserId });
      await userDb.collection('session').deleteOne({ userId: failUserId });
    }

    // -------------------------------------------------------------------------
    // Test 5: Cloudinary purge pagination & error filtering
    // -------------------------------------------------------------------------
    console.log('\n5. Testing Cloudinary purge pagination and error filtering...');
    const originalDeletePrefix = cloudinary.api.delete_resources_by_prefix;
    const originalDeleteFolder = cloudinary.api.delete_folder;

    let prefixCalls = 0;
    (cloudinary.api as any).delete_resources_by_prefix = async (_prefix: string, _options: any) => {
      prefixCalls++;
      if (prefixCalls === 1) {
        // First call indicates partial results with next_cursor
        return { deleted: { a: 'deleted' }, partial: true, next_cursor: 'cursor_123' };
      }
      // Second call finishes
      return { deleted: { b: 'deleted' }, partial: false };
    };

    let folderCalled = false;
    (cloudinary.api as any).delete_folder = async () => {
      folderCalled = true;
      // Simulate 404 not found (which should be ignored)
      const notFoundErr: any = new Error("Can't find folder");
      notFoundErr.http_code = 404;
      throw notFoundErr;
    };

    const mockOwner = `cl_test_${Date.now()}`;
    const clTestResult = await deleteUserAccount(mockOwner);
    assert.strictEqual(clTestResult.success, true, 'Must succeed when folder error is 404 not-found');
    assert.strictEqual(clTestResult.cloudinaryPurged, true, 'cloudinaryPurged must be true');
    assert(prefixCalls >= 2, 'Must have looped for partial results');
    assert(folderCalled, 'delete_folder must have been called');
    console.log('   ✓ Cloudinary purge continued on partial and ignored 404 not-found');

    // Test Cloudinary purge with unexpected error
    (cloudinary.api as any).delete_folder = async () => {
      const fatalErr: any = new Error('Cloudinary 500 Internal API Error');
      fatalErr.http_code = 500;
      throw fatalErr;
    };

    const fatalOwner = `cl_fatal_${Date.now()}`;
    const fatalResult = await deleteUserAccount(fatalOwner);
    assert.strictEqual(fatalResult.success, false, 'Must fail when unexpected Cloudinary error occurs');
    assert.strictEqual(fatalResult.cloudinaryPurged, false, 'cloudinaryPurged must be false');
    assert(fatalResult.errors?.some((e) => e.includes('500')), 'Errors must contain 500 error');
    console.log('   ✓ Cloudinary unexpected error recorded in errors and marked cloudinaryPurged as false');

    (cloudinary.api as any).delete_resources_by_prefix = originalDeletePrefix;
    (cloudinary.api as any).delete_folder = originalDeleteFolder;

    console.log('\n===========================================================');
    console.log('🎉 ALL REVIEW FIXES VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('===========================================================');
  } finally {
    await mongoose.disconnect();
  }
}

runReviewFixesTests().catch((err) => {
  console.error('❌ Review Fixes Test Suite Failed:', err);
  process.exit(1);
});
