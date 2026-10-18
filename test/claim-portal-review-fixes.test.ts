/**
 * @file claim-portal-review-fixes.test.ts
 * @description Dedicated verification test suite for review comment fixes in claim-portal-lifecycle.
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../api/.env') });

import { Batch } from '../api/src/models/Batch.js';
import { ApprovedSnapshot } from '../api/src/models/ApprovedSnapshot.js';
import { ApprovedRecipient } from '../api/src/models/ApprovedRecipient.js';
import { ClaimPortal } from '../api/src/models/ClaimPortal.js';
import { ClaimCredentialSet } from '../api/src/models/ClaimCredentialSet.js';
import { ClaimCredential } from '../api/src/models/ClaimCredential.js';
import { ClaimRecipientState } from '../api/src/models/ClaimRecipientState.js';
import {
  ClaimPortalLifecycle,
  BatchNotEligibleError,
  InvalidStateTransitionError,
} from '../api/src/services/claim-portal-lifecycle.js';
import { CLAIM_PORTAL_HMAC_SECRET } from '../api/src/services/participant-claim.js';

async function runTests() {
  console.log('🧪 Starting Claim Portal Review Fixes Test Suite...\n');

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/emitdocs';
  await mongoose.connect(uri, { dbName: 'emitdocs_review_portal_test' });

  const ownerId = `owner_review_${Date.now()}`;

  try {
    // -------------------------------------------------------------------------
    // Test 1: CLAIM_PORTAL_HMAC_SECRET shared definition & production check
    // -------------------------------------------------------------------------
    console.log('1. Testing CLAIM_PORTAL_HMAC_SECRET...');
    assert.ok(CLAIM_PORTAL_HMAC_SECRET, 'CLAIM_PORTAL_HMAC_SECRET must be exported');
    assert.ok(
      Buffer.byteLength(CLAIM_PORTAL_HMAC_SECRET, 'utf8') >= 32,
      'CLAIM_PORTAL_HMAC_SECRET must be at least 32 bytes'
    );
    console.log('   ✓ Secret exported and >= 32 bytes\n');

    // Setup Test Batch & ApprovedSnapshot
    const templateId = new mongoose.Types.ObjectId();
    const templateVersionId = new mongoose.Types.ObjectId();

    const batch = await Batch.create({
      ownerId,
      templateId,
      templateVersionId,
      name: 'Batch Review Test',
      status: 'approved',
      retentionHours: 168,
      expiresAt: new Date(Date.now() + 1000 * 3600 * 24 * 7),
    });

    const snapshot = await ApprovedSnapshot.create({
      batchId: batch._id,
      ownerId,
      templateId,
      templateVersionId,
      templateVersion: 1,
      templateSourceChecksum: 'chk123',
      mappingHash: 'map123',
      importRevision: 1,
      canonicalDigest: 'dig123',
      totalRecipients: 3,
      idempotencyKey: `idemp_rev_${Date.now()}`,
      status: 'ready',
      expiresAt: batch.expiresAt,
    });

    batch.approvedSnapshotId = snapshot._id;
    await batch.save();

    const [rec1, rec2, rec3] = await Promise.all([
      ApprovedRecipient.create({
        snapshotId: snapshot._id,
        batchId: batch._id,
        ownerId,
        recipientKey: 'r1',
        sourceRowNumber: 1,
        effectiveData: { name: 'Recipient One', studentId: 'STU-REV-001-A' },
        status: 'valid',
        generationStatus: 'generated',
        outputKey: 'certs/r1.pdf',
      }),
      ApprovedRecipient.create({
        snapshotId: snapshot._id,
        batchId: batch._id,
        ownerId,
        recipientKey: 'r2',
        sourceRowNumber: 2,
        effectiveData: { name: 'Recipient Two', studentId: 'STU-REV-002-B' },
        status: 'valid',
        generationStatus: 'generated',
        outputKey: 'certs/r2.pdf',
      }),
      ApprovedRecipient.create({
        snapshotId: snapshot._id,
        batchId: batch._id,
        ownerId,
        recipientKey: 'r3',
        sourceRowNumber: 3,
        effectiveData: { name: 'Recipient Three', studentId: 'STU-REV-003-C' },
        status: 'valid',
        generationStatus: 'generated',
        outputKey: 'certs/r3.pdf',
      }),
    ]);

    // -------------------------------------------------------------------------
    // Test 2: Input validation on createPortalDraft & updatePortalConfig
    // -------------------------------------------------------------------------
    console.log('2. Testing input validation on portal label & instructions...');
    // Missing label
    await assert.rejects(
      () => ClaimPortalLifecycle.createPortalDraft(ownerId, batch._id.toString(), { label: '' }),
      BatchNotEligibleError
    );
    await assert.rejects(
      () => ClaimPortalLifecycle.createPortalDraft(ownerId, batch._id.toString(), { label: undefined as any }),
      BatchNotEligibleError
    );
    await assert.rejects(
      () => ClaimPortalLifecycle.createPortalDraft(ownerId, batch._id.toString(), { label: 123 as any }),
      BatchNotEligibleError
    );
    // Non-string instructions
    await assert.rejects(
      () => ClaimPortalLifecycle.createPortalDraft(ownerId, batch._id.toString(), { label: 'Valid', instructions: 123 as any }),
      BatchNotEligibleError
    );

    const portal = await ClaimPortalLifecycle.createPortalDraft(ownerId, batch._id.toString(), {
      label: 'Valid Portal',
      instructions: 'Valid instructions',
    });
    assert.strictEqual(portal.status, 'draft');

    // updatePortalConfig invalid fields
    await assert.rejects(
      () => ClaimPortalLifecycle.updatePortalConfig(ownerId, portal._id.toString(), { label: '   ' }),
      BatchNotEligibleError
    );
    await assert.rejects(
      () => ClaimPortalLifecycle.updatePortalConfig(ownerId, portal._id.toString(), { label: null as any }),
      BatchNotEligibleError
    );
    await assert.rejects(
      () => ClaimPortalLifecycle.updatePortalConfig(ownerId, portal._id.toString(), { instructions: 999 as any }),
      BatchNotEligibleError
    );
    console.log('   ✓ Input validation prevents TypeError and throws BatchNotEligibleError\n');

    // -------------------------------------------------------------------------
    // Test 3: credentialSetId stores ClaimCredentialSet document ID (not portal._id)
    // -------------------------------------------------------------------------
    console.log('3. Testing credentialSetId stores ClaimCredentialSet document ID...');
    const tokenResult = await ClaimPortalLifecycle.generateTokenSet(ownerId, portal._id.toString());
    const credSet1 = await ClaimCredentialSet.findOne({ portalId: portal._id, revision: tokenResult.revision });
    assert.ok(credSet1);

    const creds1 = await ClaimCredential.find({ portalId: portal._id, credentialSetRevision: 1 });
    assert.strictEqual(creds1.length, 3);
    for (const c of creds1) {
      assert.strictEqual(c.credentialSetId.toString(), credSet1._id.toString());
      assert.notStrictEqual(c.credentialSetId.toString(), portal._id.toString());
    }
    console.log('   ✓ ClaimCredential.credentialSetId matches credSet._id\n');

    // -------------------------------------------------------------------------
    // Test 4: Recipient state provisioning preserves revoked/claimed, excludes revoked from active creds
    // -------------------------------------------------------------------------
    console.log('4. Testing recipient state preservation and exclusion of revoked recipients...');
    // Mark rec1 as revoked, rec2 as claimed
    await ClaimRecipientState.updateOne(
      { portalId: portal._id, recipientId: rec1._id },
      { $set: { status: 'revoked' } }
    );
    await ClaimRecipientState.updateOne(
      { portalId: portal._id, recipientId: rec2._id },
      { $set: { status: 'claimed' } }
    );

    // Rotate credentials
    await ClaimPortalLifecycle.rotateCredentials(ownerId, portal._id.toString(), 'imported_credential');

    // Configure imported credentials (re-provisioning)
    const credSet2 = await ClaimPortalLifecycle.configureImportedCredentials(ownerId, portal._id.toString(), {
      primaryFieldKey: 'studentId',
    });
    assert.ok(credSet2);

    // Check states: rec1 must remain revoked, rec2 must remain claimed, rec3 must remain eligible
    const state1 = await ClaimRecipientState.findOne({ portalId: portal._id, recipientId: rec1._id });
    const state2 = await ClaimRecipientState.findOne({ portalId: portal._id, recipientId: rec2._id });
    const state3 = await ClaimRecipientState.findOne({ portalId: portal._id, recipientId: rec3._id });
    assert.strictEqual(state1?.status, 'revoked', 'Revoked status must be preserved');
    assert.strictEqual(state2?.status, 'claimed', 'Claimed status must be preserved');
    assert.strictEqual(state3?.status, 'eligible', 'Eligible status must be preserved');

    // Check active credentials: rec1 (revoked) must NOT have an active ClaimCredential!
    const activeCredForRec1 = await ClaimCredential.findOne({
      portalId: portal._id,
      recipientId: rec1._id,
      credentialSetRevision: 2,
    });
    assert.strictEqual(activeCredForRec1, null, 'Revoked recipient must be excluded from active ClaimCredential creation');

    const activeCredsRev2 = await ClaimCredential.find({
      portalId: portal._id,
      credentialSetRevision: 2,
    });
    assert.strictEqual(activeCredsRev2.length, 2, 'Only non-revoked recipients receive active credentials');
    for (const c of activeCredsRev2) {
      assert.strictEqual(c.credentialSetId.toString(), credSet2._id.toString());
      assert.notStrictEqual(c.credentialSetId.toString(), portal._id.toString());
    }
    console.log('   ✓ Revoked & claimed statuses preserved and revoked recipient excluded from active credentials\n');

    // -------------------------------------------------------------------------
    // Test 5: rotateCredentials preserves draft, disabled, and expired statuses
    // -------------------------------------------------------------------------
    console.log('5. Testing rotateCredentials preserves draft, disabled, expired statuses...');
    // Create new portal in draft status
    const batch2 = await Batch.create({
      ownerId,
      templateId,
      templateVersionId,
      name: 'Batch 2',
      status: 'approved',
      approvedSnapshotId: snapshot._id,
      expiresAt: new Date(Date.now() + 1000 * 3600 * 24),
    });
    const draftPortal = await ClaimPortalLifecycle.createPortalDraft(ownerId, batch2._id.toString(), {
      label: 'Draft Portal',
    });
    assert.strictEqual(draftPortal.status, 'draft');

    const rotatedDraft = await ClaimPortalLifecycle.rotateCredentials(ownerId, draftPortal._id.toString());
    assert.strictEqual(rotatedDraft.portal.status, 'draft', 'Draft status must be preserved');

    // Test disabled status preserved
    await ClaimPortal.updateOne({ _id: draftPortal._id }, { $set: { status: 'disabled' } });
    const rotatedDisabled = await ClaimPortalLifecycle.rotateCredentials(ownerId, draftPortal._id.toString());
    assert.strictEqual(rotatedDisabled.portal.status, 'disabled', 'Disabled status must be preserved');

    // Test expired status preserved
    await ClaimPortal.updateOne({ _id: draftPortal._id }, { $set: { status: 'expired' } });
    const rotatedExpired = await ClaimPortalLifecycle.rotateCredentials(ownerId, draftPortal._id.toString());
    assert.strictEqual(rotatedExpired.portal.status, 'expired', 'Expired status must be preserved');
    console.log('   ✓ rotateCredentials preserves draft, disabled, and expired statuses\n');

    // -------------------------------------------------------------------------
    // Test 6: resumePortal preflight check when credential set is not ready
    // -------------------------------------------------------------------------
    console.log('6. Testing resumePortal runs preflight when credential set is not ready...');
    // Put portal in paused state with credential set NOT ready
    await ClaimPortal.updateOne({ _id: draftPortal._id }, { $set: { status: 'paused' } });
    // Credential set revision 4 is in 'preparing' state
    await assert.rejects(
      () => ClaimPortalLifecycle.resumePortal(ownerId, draftPortal._id.toString()),
      (err: any) =>
        err instanceof InvalidStateTransitionError &&
        err.message.includes('Credential set is not ready')
    );
    console.log('   ✓ resumePortal rejects when credential set is not ready\n');

    console.log('🎉 All Review Fixes tests PASSED successfully!');
  } finally {
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
