import 'dotenv/config';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { deleteAccount } from '../src/controllers/account.controller.js';
import { deleteUserAccount } from '../src/services/account-deletion.js';
import { approveBatch } from '../src/services/batch-approval.js';
import { ingestChunk, BatchIntakeValidationError } from '../src/services/batch-intake.js';
import { Batch } from '../src/models/Batch.js';
import { BatchImport } from '../src/models/BatchImport.js';
import { DraftRow } from '../src/models/DraftRow.js';
import { Template } from '../src/models/Template.js';
import { TemplateVersion } from '../src/models/TemplateVersion.js';
import { ApprovedSnapshot } from '../src/models/ApprovedSnapshot.js';
import cloudinary from '../src/lib/cloudinary.js';
import { validateEnvironment, ConfigurationError } from '../src/config/production-guard.js';
import { requireAuth } from '../src/middleware/auth.middleware.js';
import { buildOpenApiSpec } from '../src/scripts/generate-openapi.js';
import { checkContractDrift } from '../src/scripts/check-contract-drift.js';

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

  const originalDeletePrefix = cloudinary.api.delete_resources_by_prefix;
  const originalDeleteFolder = cloudinary.api.delete_folder;

  // Install Cloudinary stubs before first test that calls deleteAccount
  (cloudinary.api as any).delete_resources_by_prefix = async (_prefix: string, _options?: any) => {
    return { deleted: {}, partial: false };
  };
  (cloudinary.api as any).delete_folder = async (_folder: string) => {
    return { deleted: [] };
  };

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

    // Restore DraftRow.deleteMany for success and partial response tests
    DraftRow.deleteMany = origDraftRowDelete;

    // Test 1b: When MongoDB deletion succeeded but Cloudinary purge failed, return 207 Multi-Status
    (cloudinary.api as any).delete_folder = async () => {
      const clError: any = new Error('Simulated Cloudinary purge 500 failure');
      clError.http_code = 500;
      throw clError;
    };
    const mockCtxPartial = createMockContext({ user: { id: `u_ctrl_part_${Date.now()}` } });
    await deleteAccount(mockCtxPartial as any);
    const partialResp = mockCtxPartial._getResponse();
    assert.strictEqual(partialResp.status, 207, 'Must return status 207 on partial deletion');
    assert.strictEqual(partialResp.data.success, false);
    assert.strictEqual(partialResp.data.result.cloudinaryPurged, false);
    assert(
      partialResp.data.message.includes('Account was removed but cleanup is incomplete'),
      'Message must indicate account was removed but cleanup is incomplete'
    );
    console.log('   ✓ Partial deletion response returned status 207 with accurate incomplete cleanup message');

    // Restore Cloudinary stubs
    (cloudinary.api as any).delete_folder = async (_folder: string) => {
      return { deleted: [] };
    };

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
    const idempotencyKey = `test_idempotency_resumed_${Date.now()}`;
    let tpl: any;
    let tplVersion: any;
    let batch: any;
    let batchImport: any;
    let draftRow: any;
    let existingSnapshot: any;

    try {
      tpl = await Template.create({
        ownerId: testOwner,
        name: 'Resumed Test Template',
        cloudinaryPublicId: 'templates/resumed/pdf',
        sourceUrl: 'https://example.com/test.pdf',
        status: 'active',
      });
      tplVersion = await TemplateVersion.create({
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

      batch = await Batch.create({
        ownerId: testOwner,
        templateId: tpl._id,
        templateVersionId: tplVersion._id,
        name: 'Resumed Snapshot Test Batch',
        status: 'draft',
        retentionHours: 24, // Initial
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        currentImportRevision: 1,
      });

      batchImport = await BatchImport.create({
        batchId: batch._id,
        ownerId: testOwner,
        revision: 1,
        sourceFileName: 'test.csv',
        sourceFileSize: 100,
        columnMap: { fullName: 'fullName' },
        rowCount: 1,
      });

      // Create a draft row
      draftRow = await DraftRow.create({
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
      existingSnapshot = await ApprovedSnapshot.create({
        batchId: batch._id,
        ownerId: testOwner,
        templateId: tpl._id,
        templateVersionId: tplVersion._id,
        templateVersion: 1,
        mappingHash: 'test_hash_1',
        importRevision: 1,
        retentionHours: expectedRetentionHours,
        expiresAt: expectedExpiresAt,
        idempotencyKey,
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
        idempotencyKey,
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
    } finally {
      if (existingSnapshot?._id) {
        await ApprovedSnapshot.deleteOne({ _id: existingSnapshot._id });
      }
      if (draftRow?._id) {
        await DraftRow.deleteOne({ _id: draftRow._id });
      }
      if (batchImport?._id) {
        await BatchImport.deleteOne({ _id: batchImport._id });
      }
      if (batch?._id) {
        await Batch.deleteOne({ _id: batch._id });
      }
      if (tplVersion?._id) {
        await TemplateVersion.deleteOne({ _id: tplVersion._id });
      }
      if (tpl?._id) {
        await Template.deleteOne({ _id: tpl._id });
      }
    }

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

    // Test "Folder is not empty" error is NOT treated as an ignorable error
    (cloudinary.api as any).delete_folder = async () => {
      const notEmptyErr: any = new Error('Folder is not empty');
      notEmptyErr.http_code = 400;
      throw notEmptyErr;
    };

    const notEmptyOwner = `cl_not_empty_${Date.now()}`;
    const notEmptyResult = await deleteUserAccount(notEmptyOwner);
    assert.strictEqual(notEmptyResult.success, false, 'Must fail when Folder is not empty');
    assert.strictEqual(notEmptyResult.cloudinaryPurged, false, 'cloudinaryPurged must be false when Folder is not empty');
    assert(notEmptyResult.errors?.some((e) => e.includes('Folder is not empty')), 'Errors must contain Folder is not empty');
    console.log('   ✓ "Folder is not empty" is correctly treated as non-ignorable failure');

    // -------------------------------------------------------------------------
    // Test 6: batch-intake.ts 5,000-row cap on resulting total & concurrent safety
    // -------------------------------------------------------------------------
    console.log('\n6. Testing batch-intake.ts 5,000-row cap and concurrent submissions...');
    const intakeOwner = `intake_test_${Date.now()}`;
    const intakeTpl = await Template.create({
      ownerId: intakeOwner,
      name: 'Intake Cap Test Template',
      cloudinaryPublicId: 'templates/intake/pdf',
      sourceUrl: 'https://example.com/test.pdf',
      status: 'active',
    });
    const intakeTplVersion = await TemplateVersion.create({
      templateId: intakeTpl._id,
      ownerId: intakeOwner,
      version: 1,
      bytes: 1024,
      pageCount: 1,
      fieldMappings: [
        {
          id: 'f1',
          key: 'fullName',
          label: 'Full Name',
          type: 'text',
          pageIndex: 0,
          rect: { x: 0, y: 0, width: 10, height: 10 },
          alignment: 'left',
        },
      ],
      mappingHash: 'hash_intake',
      sourceObjectKey: 'templates/intake/pdf',
    });
    const intakeBatch = await Batch.create({
      ownerId: intakeOwner,
      templateId: intakeTpl._id,
      templateVersionId: intakeTplVersion._id,
      name: 'Intake Cap Batch',
      status: 'draft',
    });
    const intakeImport = await BatchImport.create({
      batchId: intakeBatch._id,
      ownerId: intakeOwner,
      revision: 1,
      sourceFileName: 'intake.csv',
      sourceFileSize: 100,
      columnMap: { fullName: 'fullName' },
      rowCount: 0,
    });

    try {
      // 1. High sourceRowNumber should pass if resulting total <= 5000
      const highRes = await ingestChunk({
        batchId: intakeBatch._id,
        importId: intakeImport._id,
        ownerId: intakeOwner,
        chunkId: 'chunk_high_num',
        rows: [
          {
            sourceRowNumber: 9999,
            rowKey: 'row_9999',
            importedData: { fullName: 'High Row' },
          },
        ],
      });
      assert.strictEqual(highRes.processed, 1);
      console.log('   ✓ Row with sourceRowNumber > 5000 accepted when resulting total <= 5000');

      // 2. Pre-seed rows up to 4,998
      const seedOps = [];
      for (let i = 1; i <= 4997; i++) {
        seedOps.push({
          batchId: intakeBatch._id,
          importId: intakeImport._id,
          ownerId: intakeOwner,
          revision: 1,
          sourceRowNumber: i,
          rowKey: `seed_r_${i}`,
          importedData: { fullName: `Student ${i}` },
          effectiveData: { fullName: `Student ${i}` },
          status: 'valid',
          version: 1,
        });
      }
      await DraftRow.insertMany(seedOps);

      // Current total: 1 (from highRes) + 4997 = 4998 rows. Room for 2 more rows!
      // Ingest 2 rows -> should succeed (total reaches 5,000)
      const fillRes = await ingestChunk({
        batchId: intakeBatch._id,
        importId: intakeImport._id,
        ownerId: intakeOwner,
        chunkId: 'chunk_fill',
        rows: [
          { sourceRowNumber: 4999, rowKey: 'row_4999', importedData: { fullName: 'Row 4999' } },
          { sourceRowNumber: 5000, rowKey: 'row_5000', importedData: { fullName: 'Row 5000' } },
        ],
      });
      assert.strictEqual(fillRes.processed, 2);
      const totalReached = await DraftRow.countDocuments({ importId: intakeImport._id });
      assert.strictEqual(totalReached, 5000, 'Total rows should now be exactly 5,000');
      console.log('   ✓ Ingestion allowed up to exact 5,000 row ceiling');

      // Update existing row (same rowKey) -> should succeed because resulting total remains 5,000
      const updateRes = await ingestChunk({
        batchId: intakeBatch._id,
        importId: intakeImport._id,
        ownerId: intakeOwner,
        chunkId: 'chunk_update_existing',
        rows: [
          { sourceRowNumber: 5000, rowKey: 'row_5000', importedData: { fullName: 'Updated Row 5000' } },
        ],
      });
      assert.strictEqual(updateRes.processed, 1);
      const totalAfterUpdate = await DraftRow.countDocuments({ importId: intakeImport._id });
      assert.strictEqual(totalAfterUpdate, 5000, 'Updating existing rowKey must not increase total count');
      console.log('   ✓ Upserting existing rowKey allowed at 5,000 row ceiling');

      // 3. New row when at 5,000 ceiling -> must throw ROW_LIMIT_EXCEEDED
      await assert.rejects(
        async () => {
          await ingestChunk({
            batchId: intakeBatch._id,
            importId: intakeImport._id,
            ownerId: intakeOwner,
            chunkId: 'chunk_overflow',
            rows: [
              { sourceRowNumber: 5001, rowKey: 'row_5001', importedData: { fullName: 'Overflow' } },
            ],
          });
        },
        (err: any) => err instanceof BatchIntakeValidationError && err.code === 'ROW_LIMIT_EXCEEDED'
      );
      console.log('   ✓ New row exceeding 5,000 ceiling rejected with ROW_LIMIT_EXCEEDED');

      // 4. Concurrent chunk submissions safety
      // Reset by deleting 5 rows so total is 4,995 (room for 5 rows)
      await DraftRow.deleteMany({ importId: intakeImport._id, rowKey: { $in: ['row_4999', 'row_5000', 'seed_r_1', 'seed_r_2', 'seed_r_3'] } });
      const currentCount = await DraftRow.countDocuments({ importId: intakeImport._id });
      assert.strictEqual(currentCount, 4995);

      // Submit 2 concurrent chunks of 4 new rows each (total 8 rows, would result in 5,003 > 5,000)
      const concA = [{ sourceRowNumber: 6001, rowKey: 'conc_a_1', importedData: { fullName: 'A1' } }, { sourceRowNumber: 6002, rowKey: 'conc_a_2', importedData: { fullName: 'A2' } }, { sourceRowNumber: 6003, rowKey: 'conc_a_3', importedData: { fullName: 'A3' } }, { sourceRowNumber: 6004, rowKey: 'conc_a_4', importedData: { fullName: 'A4' } }];
      const concB = [{ sourceRowNumber: 7001, rowKey: 'conc_b_1', importedData: { fullName: 'B1' } }, { sourceRowNumber: 7002, rowKey: 'conc_b_2', importedData: { fullName: 'B2' } }, { sourceRowNumber: 7003, rowKey: 'conc_b_3', importedData: { fullName: 'B3' } }, { sourceRowNumber: 7004, rowKey: 'conc_b_4', importedData: { fullName: 'B4' } }];

      const concResults = await Promise.allSettled([
        ingestChunk({ batchId: intakeBatch._id, importId: intakeImport._id, ownerId: intakeOwner, chunkId: 'conc_chunk_a', rows: concA }),
        ingestChunk({ batchId: intakeBatch._id, importId: intakeImport._id, ownerId: intakeOwner, chunkId: 'conc_chunk_b', rows: concB }),
      ]);

      const concRejections = concResults.filter((r) => r.status === 'rejected');
      assert.strictEqual(concRejections.length, 1, 'Exactly one concurrent chunk must be rejected');
      const postConcCount = await DraftRow.countDocuments({ importId: intakeImport._id });
      assert.strictEqual(postConcCount, 4999, 'Resulting count must be 4999 (4995 + 4)');
      console.log('   ✓ Concurrent chunk submissions safely serialized; resulting total never exceeded 5,000');
    } finally {
      await DraftRow.deleteMany({ importId: intakeImport._id });
      await BatchImport.deleteOne({ _id: intakeImport._id });
      await Batch.deleteOne({ _id: intakeBatch._id });
      await TemplateVersion.deleteOne({ _id: intakeTplVersion._id });
      await Template.deleteOne({ _id: intakeTpl._id });
    }

    // -------------------------------------------------------------------------
    // Test 7: Production guard requiredInProd includes BETTER_AUTH_URL
    // -------------------------------------------------------------------------
    console.log('\n7. Testing production-guard.ts requires BETTER_AUTH_URL in production...');
    assert.throws(
      () => {
        validateEnvironment({
          NODE_ENV: 'production',
          ENABLE_TEST_AUTH: 'false',
          MONGODB_URI: 'mongodb://localhost:27017',
          BETTER_AUTH_SECRET: 'secret-123456789012345678901234567890',
          // BETTER_AUTH_URL intentionally omitted
          GOOGLE_CLIENT_ID: 'google-id',
          GOOGLE_CLIENT_SECRET: 'google-secret',
          CLOUDINARY_CLOUD_NAME: 'cloud',
          CLOUDINARY_API_KEY: 'key',
          CLOUDINARY_API_SECRET: 'secret',
          ALLOWED_ORIGINS: 'https://emitdocs.com',
        });
      },
      (err: any) =>
        err instanceof ConfigurationError &&
        err.message.includes('BETTER_AUTH_URL')
    );
    console.log('   ✓ Production guard rejects startup when BETTER_AUTH_URL is missing in production');

    // -------------------------------------------------------------------------
    // Test 8: Auth middleware test-auth user validation
    // -------------------------------------------------------------------------
    console.log('\n8. Testing auth.middleware.ts test-auth JSON.parse validation...');
    const originalEnv = process.env.ENABLE_TEST_AUTH;
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.ENABLE_TEST_AUTH = 'true';
    process.env.NODE_ENV = 'development';

    try {
      // 8.1 Primitive number input: '123'
      let userReceived: any = null;
      const ctxNumber = {
        req: { header: (name: string) => (name === 'x-test-auth-user' ? '123' : undefined) },
        set: (k: string, v: any) => { if (k === 'user') userReceived = v; },
        json: () => {},
      };
      await requireAuth(ctxNumber as any, async () => {});
      assert.strictEqual(typeof userReceived.id, 'string', 'mockUser.id must be a string');
      assert.strictEqual(userReceived.id, '123');

      // 8.2 Object without id: '{"name":"Tester"}'
      userReceived = null;
      const ctxNoId = {
        req: { header: (name: string) => (name === 'x-test-auth-user' ? '{"name":"Tester"}' : undefined) },
        set: (k: string, v: any) => { if (k === 'user') userReceived = v; },
        json: () => {},
      };
      await requireAuth(ctxNoId as any, async () => {});
      assert.strictEqual(typeof userReceived.id, 'string');
      assert.strictEqual(userReceived.id, '{"name":"Tester"}');

      // 8.3 Object with empty string id: '{"id":""}'
      userReceived = null;
      const ctxEmptyId = {
        req: { header: (name: string) => (name === 'x-test-auth-user' ? '{"id":""}' : undefined) },
        set: (k: string, v: any) => { if (k === 'user') userReceived = v; },
        json: () => {},
      };
      await requireAuth(ctxEmptyId as any, async () => {});
      assert.strictEqual(typeof userReceived.id, 'string');
      assert.strictEqual(userReceived.id, '{"id":""}');

      // 8.4 Valid object with non-empty string id: '{"id":"custom_user_456","role":"admin"}'
      userReceived = null;
      const ctxValid = {
        req: { header: (name: string) => (name === 'x-test-auth-user' ? '{"id":"custom_user_456","role":"admin"}' : undefined) },
        set: (k: string, v: any) => { if (k === 'user') userReceived = v; },
        json: () => {},
      };
      await requireAuth(ctxValid as any, async () => {});
      assert.strictEqual(userReceived.id, 'custom_user_456');
      assert.strictEqual(userReceived.role, 'admin');
      console.log('   ✓ Auth middleware safely handles primitives, invalid objects, and valid custom users');
    } finally {
      process.env.ENABLE_TEST_AUTH = originalEnv;
      process.env.NODE_ENV = originalNodeEnv;
    }

    // -------------------------------------------------------------------------
    // Test 9: OpenAPI UnauthorizedError schema matches actual 401 body
    // -------------------------------------------------------------------------
    console.log('\n9. Testing OpenAPI UnauthorizedError schema...');
    const spec = buildOpenApiSpec();
    const unauthResponse = (spec.components.responses as any).UnauthorizedError;
    const unauthSchema = unauthResponse.content['application/json'].schema;
    assert.strictEqual(unauthSchema.type, 'object', 'Schema must be object');
    assert.strictEqual(unauthSchema.properties.error.type, 'string', 'Error property must be string');
    assert.deepStrictEqual(unauthSchema.required, ['error'], 'Error property must be required');
    assert.strictEqual(unauthSchema.$ref, undefined, 'Must not reference StandardError');
    console.log('   ✓ OpenAPI UnauthorizedError schema directly matches 401 response body { error: string }');

    // -------------------------------------------------------------------------
    // Test 10: Contract drift check compares Hono routes against OpenAPI spec
    // -------------------------------------------------------------------------
    console.log('\n10. Testing check-contract-drift route comparison...');
    const driftResult = checkContractDrift();
    assert.strictEqual(driftResult.hasDrift, false, 'No drift should be detected in clean codebase');
    console.log('   ✓ Contract drift check verified with Hono router alignment');

    console.log('\n===========================================================');
    console.log('🎉 ALL REVIEW FIXES VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('===========================================================');
  } finally {
    (cloudinary.api as any).delete_resources_by_prefix = originalDeletePrefix;
    (cloudinary.api as any).delete_folder = originalDeleteFolder;
    await mongoose.disconnect();
  }
}

runReviewFixesTests().catch((err) => {
  console.error('❌ Review Fixes Test Suite Failed:', err);
  process.exit(1);
});
