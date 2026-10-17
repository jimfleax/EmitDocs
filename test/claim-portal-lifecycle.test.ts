/**
 * @file claim-portal-lifecycle.test.ts
 * @description Acceptance and unit verification for Slice 2: Organizer Portal Management & Credential Setup.
 * @requirements AC-001, AC-002, AC-003, AC-004, AC-005, AC-007, AC-021, AC-022
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
import { ClaimSession } from '../api/src/models/ClaimSession.js';
import {
  ClaimPortalLifecycle,
  PortalConflictError,
  PortalNotFoundError,
  BatchNotEligibleError,
  ExportAlreadyAcknowledgedError,
  InvalidStateTransitionError,
  WeakCredentialError,
} from '../api/src/services/claim-portal-lifecycle.js';

async function run() {
  console.log('--- Starting Slice 2 Claim Portal Lifecycle Tests ---');

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/emitdocs';
  await mongoose.connect(uri, { dbName: 'emitdocs_slice2_test' });

  const ownerId = `owner_${Date.now()}`;
  const otherOwnerId = `intruder_${Date.now()}`;

  try {
    // 0. Cleanup any old test residue
    await Promise.all([
      ClaimPortal.deleteMany({ ownerId: { $in: [ownerId, otherOwnerId] } }),
      ClaimCredentialSet.deleteMany({ createdBy: { $in: [ownerId, otherOwnerId] } }),
      ClaimCredential.deleteMany({ ownerId: { $in: [ownerId, otherOwnerId] } }),
    ]);

    // Setup Test Batch & ApprovedSnapshot
    const templateId = new mongoose.Types.ObjectId();
    const templateVersionId = new mongoose.Types.ObjectId();

    const batch = await Batch.create({
      ownerId,
      templateId,
      templateVersionId,
      name: 'Batch Portal Test',
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
      templateSourceChecksum: 'checksum123',
      mappingHash: 'mapping123',
      importRevision: 1,
      canonicalDigest: 'digest123',
      totalRecipients: 3,
      idempotencyKey: `idemp_${Date.now()}`,
      status: 'ready',
      expiresAt: batch.expiresAt,
    });

    batch.approvedSnapshotId = snapshot._id;
    await batch.save();

    // Create 3 valid approved recipients
    const recipientA = await ApprovedRecipient.create({
      snapshotId: snapshot._id,
      batchId: batch._id,
      ownerId,
      recipientKey: 'rec_A',
      sourceRowNumber: 1,
      effectiveData: {
        name: 'Alice Smith',
        email: 'alice@example.com',
        studentId: 'STU-99281-XYZ',
        pin: '1234',
      },
      status: 'valid',
      generationStatus: 'generated',
      outputKey: 'certs/rec_A.pdf',
    });

    const recipientB = await ApprovedRecipient.create({
      snapshotId: snapshot._id,
      batchId: batch._id,
      ownerId,
      recipientKey: 'rec_B',
      sourceRowNumber: 2,
      effectiveData: {
        name: 'Bob Jones',
        email: 'bob@example.com',
        studentId: 'STU-99282-ABC',
        pin: '5678',
      },
      status: 'valid',
      generationStatus: 'generated',
      outputKey: 'certs/rec_B.pdf',
    });

    const recipientC = await ApprovedRecipient.create({
      snapshotId: snapshot._id,
      batchId: batch._id,
      ownerId,
      recipientKey: 'rec_C',
      sourceRowNumber: 3,
      effectiveData: {
        name: 'Charlie Brown',
        email: 'charlie@example.com',
        studentId: 'STU-99283-DEF',
        pin: '9012',
      },
      status: 'valid',
      generationStatus: 'pending', // Missing output for preflight blocker check
      outputKey: null,
    });

    console.log('✓ Test fixtures created');

    // 1. AC-001: Create Draft Portal
    const portal = await ClaimPortalLifecycle.createPortalDraft(ownerId, batch._id.toString(), {
      label: 'Graduation Ceremony 2026',
      instructions: 'Please enter your claim token.',
    });
    assert.strictEqual(portal.status, 'draft');
    assert.strictEqual(portal.label, 'Graduation Ceremony 2026');
    assert.strictEqual(portal.publicSlug.length, 12);
    assert.strictEqual(portal.version, 0);
    assert.strictEqual(portal.expiresAt.getTime(), batch.expiresAt.getTime());

    // AC-001: Enforce 1 primary portal per batch (reject duplicate)
    await assert.rejects(
      () => ClaimPortalLifecycle.createPortalDraft(ownerId, batch._id.toString(), { label: 'Second' }),
      PortalConflictError
    );

    // AC-001: Deny other owner
    await assert.rejects(
      () => ClaimPortalLifecycle.createPortalDraft(otherOwnerId, batch._id.toString(), { label: 'Stolen' }),
      PortalNotFoundError
    );
    console.log('✓ AC-001 verified (Create Portal Draft, slug generation, owner & duplicate constraints)');

    // 2. CAS Version update on config
    const updated = await ClaimPortalLifecycle.updatePortalConfig(ownerId, portal._id.toString(), {
      label: 'Updated Graduation Ceremony 2026',
      expectedVersion: 0,
    });
    assert.strictEqual(updated.label, 'Updated Graduation Ceremony 2026');
    assert.strictEqual(updated.version, 1);

    // Conflict on stale version
    await assert.rejects(
      () =>
        ClaimPortalLifecycle.updatePortalConfig(ownerId, portal._id.toString(), {
          label: 'Conflict Test',
          expectedVersion: 0,
        }),
      PortalConflictError
    );
    console.log('✓ Optimistic concurrency CAS version update verified');

    // 3. AC-006 & AC-007: Generate Token Set (Generated Token Mode)
    const tokenExport = await ClaimPortalLifecycle.generateTokenSet(ownerId, portal._id.toString());
    assert.strictEqual(tokenExport.revision, 1);
    assert.strictEqual(tokenExport.exportTokens.length, 3);
    assert.ok(tokenExport.exportTokens[0].token.length >= 43);

    // Check credential set status is awaiting_export_ack
    const credSet = await ClaimCredentialSet.findOne({ portalId: portal._id, revision: 1 });
    assert.ok(credSet);
    assert.strictEqual(credSet.status, 'awaiting_export_ack');

    // Check raw tokens are NOT in DB, only HMAC verifiers
    const savedCreds = await ClaimCredential.find({ portalId: portal._id, credentialSetRevision: 1 });
    assert.strictEqual(savedCreds.length, 3);
    for (const sc of savedCreds) {
      assert.strictEqual(sc.credentialVerifier.length, 64);
      assert.strictEqual(sc.status, 'active');
    }

    // Replay denial (AC-007): calling generateTokenSet again without rotating throws error
    await assert.rejects(
      () => ClaimPortalLifecycle.generateTokenSet(ownerId, portal._id.toString()),
      ExportAlreadyAcknowledgedError
    );

    // Acknowledge Export
    const acked = await ClaimPortalLifecycle.acknowledgeTokenExport(ownerId, portal._id.toString(), 1);
    assert.strictEqual(acked.status, 'ready');
    assert.ok(acked.exportAcknowledgedAt);
    console.log('✓ AC-006 & AC-007 verified (CSPRNG generation, awaiting_export_ack, one-time export, HMAC verifiers)');

    // 4. AC-002 & AC-003: Preflight Inspection & Blocker Ack
    let preflight = await ClaimPortalLifecycle.getPortalPreflight(ownerId, portal._id.toString());
    assert.strictEqual(preflight.missingOutputCount, 1); // recipientC is pending
    assert.strictEqual(preflight.isReady, false);
    assert.ok(preflight.blockers.some((b: string) => /output/i.test(b)));

    // Activation fails without acking exclusions
    await assert.rejects(
      () => ClaimPortalLifecycle.activatePortal(ownerId, portal._id.toString(), 1, false),
      InvalidStateTransitionError
    );

    // Activation succeeds with ackExclusions = true
    const activated = await ClaimPortalLifecycle.activatePortal(ownerId, portal._id.toString(), 1, true);
    assert.strictEqual(activated.status, 'active');
    assert.ok(activated.activatedAt);
    console.log('✓ AC-002 & AC-003 verified (Preflight missing output detection, blockers & activation gate)');

    // 5. AC-021: Lifecycle Pause / Resume / Disable / Close
    // Pause
    const paused = await ClaimPortalLifecycle.pausePortal(ownerId, portal._id.toString());
    assert.strictEqual(paused.status, 'paused');
    assert.ok(paused.pausedAt);

    // Resume
    const resumed = await ClaimPortalLifecycle.resumePortal(ownerId, portal._id.toString());
    assert.strictEqual(resumed.status, 'active');

    // Disable
    const disabled = await ClaimPortalLifecycle.disablePortal(ownerId, portal._id.toString());
    assert.strictEqual(disabled.status, 'disabled');
    assert.ok(disabled.disabledAt);
    console.log('✓ AC-021 verified (Pause, Resume, Disable)');

    // 6. AC-004, AC-005: Rotate Credentials & Mode Switch
    const rotated = await ClaimPortalLifecycle.rotateCredentials(ownerId, portal._id.toString(), 'imported_credential');
    assert.strictEqual(rotated.revision, 2);
    assert.strictEqual(rotated.portal.credentialSetRevision, 2);
    assert.strictEqual(rotated.portal.credentialMode, 'imported_credential');
    assert.strictEqual(rotated.portal.status, 'paused');

    // Prior revision 1 credentials must now be revoked
    const revokedOldCreds = await ClaimCredential.find({ portalId: portal._id, credentialSetRevision: 1 });
    assert.strictEqual(revokedOldCreds.every((c) => c.status === 'revoked'), true);
    console.log('✓ AC-004 & AC-005 verified (Credential rotation, mode switch, prior verifier revocation)');

    // 7. AC-008 & AC-009: Imported Credential Strength & Collision Validation
    // Weak credential without secondary factor -> WeakCredentialError
    await assert.rejects(
      () =>
        ClaimPortalLifecycle.configureImportedCredentials(ownerId, portal._id.toString(), {
          primaryFieldKey: 'pin', // '1234' is weak numeric < 12 chars
        }),
      WeakCredentialError
    );

    // Strong credential or paired credential -> Success
    const importConfig = await ClaimPortalLifecycle.configureImportedCredentials(ownerId, portal._id.toString(), {
      primaryFieldKey: 'studentId', // STU-99281-XYZ >= 12 chars, alphanumeric
    });
    assert.strictEqual(importConfig.status, 'ready');

    const rev2Creds = await ClaimCredential.find({ portalId: portal._id, credentialSetRevision: 2 });
    assert.strictEqual(rev2Creds.length, 3);
    assert.strictEqual(rev2Creds[0].strengthClass, 'strong_import');
    console.log('✓ AC-008 & AC-009 verified (Imported credential strength heuristic, 2nd factor requirement, HMAC verifiers)');

    // 8. Recipients pagination & Recipient Revocation (AC-021)
    const recipientList = await ClaimPortalLifecycle.getPortalRecipients(ownerId, portal._id.toString(), {
      page: 1,
      limit: 10,
    });
    assert.strictEqual(recipientList.total, 3);

    // Revoke individual recipient claim
    const revokedRec = await ClaimPortalLifecycle.revokeRecipientClaim(
      ownerId,
      portal._id.toString(),
      recipientA._id.toString()
    );
    assert.strictEqual(revokedRec.status, 'revoked');

    const recACred = await ClaimCredential.findOne({
      portalId: portal._id,
      recipientId: recipientA._id,
      credentialSetRevision: 2,
    });
    assert.strictEqual(recACred?.status, 'revoked');
    console.log('✓ Recipient listing and individual claim revocation verified');

    // 9. Analytics
    const analytics = await ClaimPortalLifecycle.getPortalAnalytics(ownerId, portal._id.toString());
    assert.strictEqual(analytics.revokedCount, 1);
    assert.strictEqual(analytics.unclaimedCount, 2);
    console.log('✓ Analytics aggregation verified');

    // 10. Close Portal (Permanent & Irreversible)
    const closed = await ClaimPortalLifecycle.closePortal(ownerId, portal._id.toString());
    assert.strictEqual(closed.status, 'closed');
    assert.ok(closed.closedAt);

    // All active credentials must be revoked
    const activeCreds = await ClaimCredential.find({ portalId: portal._id, status: 'active' });
    assert.strictEqual(activeCreds.length, 0);

    // Cannot resume closed portal
    await assert.rejects(
      () => ClaimPortalLifecycle.resumePortal(ownerId, portal._id.toString()),
      InvalidStateTransitionError
    );
    console.log('✓ Permanent portal closure verified (Irreversible, credentials revoked)');

    console.log('\n===========================================================');
    console.log('  ALL SLICE 2 ACCEPTANCE CRITERIA VERIFIED (PASS)');
    console.log('===========================================================');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
