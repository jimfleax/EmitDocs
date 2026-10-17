/**
 * @file claim-retention.test.ts
 * @description TDD test suite for Slice 5: Claim Portal Retention Pruning and Account Deletion Integration (AC-023, AC-024).
 * @architecture Verifies that when a batch expires, the linked ClaimPortal transitions to 'expired',
 *               all ClaimCredential verifiers, ClaimSession tokens, and ClaimRecipientState records are purged,
 *               while the ClaimPortal audit record is preserved with aggregate counts.
 *               Also verifies that cascading user account deletion removes all user claim portals,
 *               credential sets, credentials, sessions, and recipient states.
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../api/.env') });

import { RetentionPruner } from '../api/src/services/retention-pruner.js';
import { deleteUserAccount } from '../api/src/services/account-deletion.js';
import { Batch } from '../api/src/models/Batch.js';
import { ClaimPortal } from '../api/src/models/ClaimPortal.js';
import { ClaimCredential } from '../api/src/models/ClaimCredential.js';
import { ClaimSession } from '../api/src/models/ClaimSession.js';
import { ClaimRecipientState } from '../api/src/models/ClaimRecipientState.js';
import { ClaimCredentialSet } from '../api/src/models/ClaimCredentialSet.js';

async function runTests() {
  console.log('--- Starting Slice 5 Claim Retention & Account Deletion Tests ---');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/emitdocs_test');

  const testOwner = `test_owner_${Date.now()}`;
  const testBatchId = new mongoose.Types.ObjectId();
  const testSnapshotId = new mongoose.Types.ObjectId();
  const pastDate = new Date(Date.now() - 3600 * 1000); // 1 hour ago

  try {
    // -------------------------------------------------------------
    // Test 1: Batch Expiration triggers ClaimPortal Expiry & PII Purge (AC-023)
    // -------------------------------------------------------------
    console.log('[Test 1] Verifying batch expiration cascades to claim portal...');

    const batch = await Batch.create({
      _id: testBatchId,
      name: 'Retention Batch',
      ownerId: testOwner,
      templateId: new mongoose.Types.ObjectId(),
      templateVersionId: new mongoose.Types.ObjectId(),
      status: 'approved',
      expiresAt: pastDate,
      retentionHours: 24,
    });

    const portal = await ClaimPortal.create({
      publicSlug: `test-slug-${Date.now().toString(36)}`,
      ownerId: testOwner,
      batchId: batch._id,
      snapshotId: testSnapshotId,
      credentialMode: 'generated_token',
      credentialSetRevision: 1,
      status: 'active',
      label: 'Annual Conference 2026',
      eligibleRecipientCount: 10,
      uniqueClaimedCount: 5,
      expiresAt: pastDate,
    });

    const recipientId = new mongoose.Types.ObjectId();
    const credSet = await ClaimCredentialSet.create({
      portalId: portal._id,
      revision: 1,
      mode: 'generated_token',
      status: 'ready',
      createdBy: testOwner,
    });

    await ClaimCredential.create({
      ownerId: testOwner,
      portalId: portal._id,
      credentialSetId: credSet._id,
      credentialSetRevision: 1,
      recipientId,
      credentialVerifier: `mock_verifier_hash_${Date.now()}`,
      credentialKind: 'single',
      strengthClass: 'generated',
      status: 'active',
    });

    await ClaimSession.create({
      sessionTokenHash: `mock_session_hash_${Date.now()}`,
      portalId: portal._id,
      recipientId,
      credentialSetRevision: 1,
      expiresAt: new Date(Date.now() + 900000),
    });

    await ClaimRecipientState.create({
      portalId: portal._id,
      snapshotId: testSnapshotId,
      recipientId,
      status: 'claimed',
      credentialSetRevision: 1,
    });

    // Run expireBatchIfDue
    const result = await RetentionPruner.expireBatchIfDue(batch._id, testOwner);
    assert.strictEqual(result.expired, true, 'Batch should be marked expired');

    // Verify ClaimPortal transitioned to 'expired'
    const updatedPortal = await ClaimPortal.findById(portal._id);
    assert.ok(updatedPortal, 'Portal audit record must persist');
    assert.strictEqual(updatedPortal.status, 'expired', 'Portal status must be expired');
    assert.strictEqual(updatedPortal.eligibleRecipientCount, 10, 'Eligible count preserved');
    assert.strictEqual(updatedPortal.uniqueClaimedCount, 5, 'Claimed count preserved');

    // Verify PII collections purged
    const remainingCreds = await ClaimCredential.countDocuments({ portalId: portal._id });
    assert.strictEqual(remainingCreds, 0, 'Credentials must be purged');

    const remainingSessions = await ClaimSession.countDocuments({ portalId: portal._id });
    assert.strictEqual(remainingSessions, 0, 'Sessions must be purged');

    const remainingStates = await ClaimRecipientState.countDocuments({ portalId: portal._id });
    assert.strictEqual(remainingStates, 0, 'Recipient states must be purged');

    console.log('[Test 1] PASS: Portal expired and PII scrubbed while audit counts preserved.');

    // -------------------------------------------------------------
    // Test 2: Cascading User Account Deletion removes all claim assets (AC-024)
    // -------------------------------------------------------------
    console.log('[Test 2] Verifying cascading user account deletion...');
    const userToDelete = `delete_user_${Date.now()}`;
    const userBatchId = new mongoose.Types.ObjectId();

    const userBatch = await Batch.create({
      _id: userBatchId,
      name: 'User Batch',
      ownerId: userToDelete,
      templateId: new mongoose.Types.ObjectId(),
      templateVersionId: new mongoose.Types.ObjectId(),
      status: 'approved',
      expiresAt: new Date(Date.now() + 86400000),
      retentionHours: 24,
    });

    const userPortal = await ClaimPortal.create({
      publicSlug: `del-slug-${Date.now().toString(36)}`,
      ownerId: userToDelete,
      batchId: userBatch._id,
      snapshotId: new mongoose.Types.ObjectId(),
      credentialMode: 'generated_token',
      credentialSetRevision: 1,
      status: 'active',
      label: 'User Portal',
      expiresAt: new Date(Date.now() + 86400000),
    });

    const userRecipientId = new mongoose.Types.ObjectId();
    const userCredSet = await ClaimCredentialSet.create({
      portalId: userPortal._id,
      revision: 1,
      mode: 'generated_token',
      status: 'ready',
      createdBy: userToDelete,
    });

    await ClaimCredential.create({
      ownerId: userToDelete,
      portalId: userPortal._id,
      credentialSetId: userCredSet._id,
      credentialSetRevision: 1,
      recipientId: userRecipientId,
      credentialVerifier: `user_mock_verifier_${Date.now()}`,
      credentialKind: 'single',
      strengthClass: 'generated',
      status: 'active',
    });

    await ClaimSession.create({
      sessionTokenHash: `user_mock_session_${Date.now()}`,
      portalId: userPortal._id,
      recipientId: userRecipientId,
      credentialSetRevision: 1,
      expiresAt: new Date(Date.now() + 900000),
    });

    await ClaimRecipientState.create({
      portalId: userPortal._id,
      snapshotId: userPortal.snapshotId,
      recipientId: userRecipientId,
      status: 'eligible',
      credentialSetRevision: 1,
    });

    // Execute deleteUserAccount
    const delResult = await deleteUserAccount(userToDelete);
    assert.strictEqual(delResult.success, true, 'deleteUserAccount must succeed');

    // Verify all portal records for user are deleted
    const portalsLeft = await ClaimPortal.countDocuments({ ownerId: userToDelete });
    assert.strictEqual(portalsLeft, 0, 'All user ClaimPortals must be deleted');

    const credSetsLeft = await ClaimCredentialSet.countDocuments({ portalId: userPortal._id });
    assert.strictEqual(credSetsLeft, 0, 'All user ClaimCredentialSets must be deleted');

    const credsLeft = await ClaimCredential.countDocuments({ portalId: userPortal._id });
    assert.strictEqual(credsLeft, 0, 'All user ClaimCredentials must be deleted');

    const sessionsLeft = await ClaimSession.countDocuments({ portalId: userPortal._id });
    assert.strictEqual(sessionsLeft, 0, 'All user ClaimSessions must be deleted');

    const statesLeft = await ClaimRecipientState.countDocuments({ portalId: userPortal._id });
    assert.strictEqual(statesLeft, 0, 'All user ClaimRecipientStates must be deleted');

    console.log('[Test 2] PASS: All claim resources cascaded and purged on account deletion.');

    console.log('--- All Slice 5 tests PASSED ---');
  } finally {
    // Cleanup any lingering test data
    await Promise.all([
      Batch.deleteMany({ ownerId: { $in: [testOwner] } }),
      ClaimPortal.deleteMany({ ownerId: { $in: [testOwner] } }),
      ClaimCredentialSet.deleteMany({ createdBy: testOwner }),
      ClaimCredential.deleteMany({ ownerId: testOwner }),
    ]);
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
