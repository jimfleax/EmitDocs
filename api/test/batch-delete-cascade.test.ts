/**
 * @file batch-delete-cascade.test.ts
 * @description Validates cascading deletion behaviors across batches, templates, approved snapshots, recipients, and claim portal sessions.
 * @architecture Controller and service integration test suite verifying referential integrity and atomic cleanup in MongoDB.
 * @agent_note Requires MONGODB_URI in environment; exercises live database operations against emitdocs_test database with unique owner prefixes.
 */

import 'dotenv/config';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { Template } from '../src/models/Template.js';
import { TemplateVersion } from '../src/models/TemplateVersion.js';
import { Batch } from '../src/models/Batch.js';
import { BatchImport } from '../src/models/BatchImport.js';
import { DraftRow } from '../src/models/DraftRow.js';
import { ApprovedSnapshot } from '../src/models/ApprovedSnapshot.js';
import { ApprovedRecipient } from '../src/models/ApprovedRecipient.js';
import { ClaimPortal } from '../src/models/ClaimPortal.js';
import { ClaimCredential } from '../src/models/ClaimCredential.js';
import { ClaimCredentialSet } from '../src/models/ClaimCredentialSet.js';
import { ClaimSession } from '../src/models/ClaimSession.js';
import { ClaimRecipientState } from '../src/models/ClaimRecipientState.js';
import { deleteBatch } from '../src/controllers/batches.controller.js';
import { deleteTemplate } from '../src/services/template-lifecycle.js';

/**
 * @desc Main test runner executing cascade deletion verification suites across batches, templates, and claim entities.
 * @returns Promise resolving when all deletion assertions pass.
 */
async function runTest() {
  console.log('🧪 Starting Batch & Template Cascade Deletion Test Suite (Seam 2)...\n');

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { dbName: 'emitdocs_test' });
  console.log('   ✓ Connected to test database\n');

  const testOwner = `test_cascade_owner_${Date.now()}`;

  try {
    /* -------------------------------------------------------------------------- */
    /*  1. Test: deleteBatch cascades to snapshots, recipients, and claim portal   */
    /* -------------------------------------------------------------------------- */
    console.log('1. Testing deleteBatch cascades to all child documents...');

    const template1 = await Template.create({
      ownerId: testOwner,
      name: 'Batch Cascade Template 1',
    });

    const version1 = await TemplateVersion.create({
      templateId: template1._id,
      ownerId: testOwner,
      version: 1,
      sourceObjectKey: `templates/${testOwner}/batch_cascade_1.pdf`,
      bytes: 2048,
      pageCount: 1,
      status: 'active',
      fieldMappings: [],
      mappingHash: 'hash_b1',
    });
    template1.currentVersionId = version1._id;
    await template1.save();

    const batch1 = await Batch.create({
      ownerId: testOwner,
      templateId: template1._id,
      templateVersionId: version1._id,
      name: 'Batch To Delete',
      status: 'approved',
    });

    const batchImport1 = await BatchImport.create({
      batchId: batch1._id,
      ownerId: testOwner,
      revision: 1,
      sourceFileName: 'recipients.csv',
      sourceFileSize: 100,
      status: 'completed',
    });

    await DraftRow.create({
      batchId: batch1._id,
      importId: batchImport1._id,
      revision: 1,
      rowKey: 'row_1',
      ownerId: testOwner,
      sourceRowNumber: 1,
      importedData: { Name: 'Alice' },
      effectiveData: { Name: 'Alice' },
      status: 'valid',
    });

    const snapshot1 = await ApprovedSnapshot.create({
      batchId: batch1._id,
      ownerId: testOwner,
      templateId: template1._id,
      templateVersionId: version1._id,
      templateVersion: 1,
      templateSourceChecksum: `templates/${testOwner}/batch_cascade_1.pdf`,
      mappingHash: 'hash_b1',
      importRevision: 1,
      expiresAt: new Date(Date.now() + 86400000),
      canonicalDigest: 'digest_b1',
      idempotencyKey: `idemp_b1_${Date.now()}`,
      status: 'ready',
    });

    const recipient1 = await ApprovedRecipient.create({
      snapshotId: snapshot1._id,
      batchId: batch1._id,
      ownerId: testOwner,
      recipientKey: 'rec_b1',
      sourceRowNumber: 1,
      effectiveData: { name: 'Alice' },
      status: 'valid',
      generationStatus: 'generated',
    });

    const portal1 = await ClaimPortal.create({
      publicSlug: `slug_${Date.now()}`,
      ownerId: testOwner,
      batchId: batch1._id,
      snapshotId: snapshot1._id,
      label: 'Test Portal',
      expiresAt: new Date(Date.now() + 86400000),
    });

    const credSet1 = await ClaimCredentialSet.create({
      portalId: portal1._id,
      revision: 1,
      mode: 'generated_token',
      status: 'ready',
      createdBy: testOwner,
    });

    await ClaimCredential.create({
      ownerId: testOwner,
      portalId: portal1._id,
      credentialSetId: credSet1._id,
      credentialSetRevision: 1,
      recipientId: recipient1._id,
      credentialVerifier: `verifier_${Date.now()}`,
      credentialKind: 'single',
      strengthClass: 'generated',
      status: 'active',
    });

    await ClaimSession.create({
      sessionTokenHash: `hash_${Date.now()}`,
      portalId: portal1._id,
      recipientId: recipient1._id,
      credentialSetRevision: 1,
      expiresAt: new Date(Date.now() + 3600000),
    });

    await ClaimRecipientState.create({
      portalId: portal1._id,
      snapshotId: snapshot1._id,
      recipientId: recipient1._id,
      credentialSetRevision: 1,
      status: 'claimed',
    });

    // Mock Hono Context for deleteBatch
    const mockContext: any = {
      get: (key: string) => (key === 'user' ? { id: testOwner } : null),
      req: {
        param: (paramName: string) => (paramName === 'id' ? String(batch1._id) : null),
      },
      json: (data: any, status = 200) => ({ data, status }),
    };

    const deleteBatchResponse: any = await deleteBatch(mockContext);
    assert.strictEqual(deleteBatchResponse.status, 200, 'deleteBatch must return 200 OK');
    assert.strictEqual(deleteBatchResponse.data.success, true);

    // Verify all records associated with batch1 are deleted
    const [
      remainingBatch,
      remainingDraftRows,
      remainingImports,
      remainingSnapshots,
      remainingRecipients,
      remainingPortals,
      remainingCredSets,
      remainingCreds,
      remainingSessions,
      remainingStates,
    ] = await Promise.all([
      Batch.findById(batch1._id),
      DraftRow.find({ batchId: batch1._id }),
      BatchImport.find({ batchId: batch1._id }),
      ApprovedSnapshot.find({ batchId: batch1._id }),
      ApprovedRecipient.find({ batchId: batch1._id }),
      ClaimPortal.find({ batchId: batch1._id }),
      ClaimCredentialSet.find({ portalId: portal1._id }),
      ClaimCredential.find({ portalId: portal1._id }),
      ClaimSession.find({ portalId: portal1._id }),
      ClaimRecipientState.find({ portalId: portal1._id }),
    ]);

    assert.strictEqual(remainingBatch, null, 'Batch must be deleted');
    assert.strictEqual(remainingDraftRows.length, 0, 'DraftRows must be deleted');
    assert.strictEqual(remainingImports.length, 0, 'BatchImports must be deleted');
    assert.strictEqual(remainingSnapshots.length, 0, 'ApprovedSnapshots must be deleted');
    assert.strictEqual(remainingRecipients.length, 0, 'ApprovedRecipients must be deleted');
    assert.strictEqual(remainingPortals.length, 0, 'ClaimPortals must be deleted');
    assert.strictEqual(remainingCredSets.length, 0, 'ClaimCredentialSets must be deleted');
    assert.strictEqual(remainingCreds.length, 0, 'ClaimCredentials must be deleted');
    assert.strictEqual(remainingSessions.length, 0, 'ClaimSessions must be deleted');
    assert.strictEqual(remainingStates.length, 0, 'ClaimRecipientStates must be deleted');

    console.log('   ✓ deleteBatch completely purged all batch, snapshot, recipient, and portal entities\n');

    /* -------------------------------------------------------------------------- */
    /*  2. Test: deleteTemplate cascade purges snapshots and recipients          */
    /* -------------------------------------------------------------------------- */
    console.log('2. Testing deleteTemplate cascade purges dependent snapshots and recipients...');

    const template2 = await Template.create({
      ownerId: testOwner,
      name: 'Template To Delete With Cascaded Batches',
    });

    const version2 = await TemplateVersion.create({
      templateId: template2._id,
      ownerId: testOwner,
      version: 1,
      sourceObjectKey: `templates/${testOwner}/tpl_cascade_2.pdf`,
      bytes: 2048,
      pageCount: 1,
      status: 'active',
      fieldMappings: [],
      mappingHash: 'hash_t2',
    });
    template2.currentVersionId = version2._id;
    await template2.save();

    const batch2 = await Batch.create({
      ownerId: testOwner,
      templateId: template2._id,
      templateVersionId: version2._id,
      name: 'Dependent Batch 2',
      status: 'approved',
    });

    const snapshot2 = await ApprovedSnapshot.create({
      batchId: batch2._id,
      ownerId: testOwner,
      templateId: template2._id,
      templateVersionId: version2._id,
      templateVersion: 1,
      templateSourceChecksum: `templates/${testOwner}/tpl_cascade_2.pdf`,
      mappingHash: 'hash_t2',
      importRevision: 1,
      expiresAt: new Date(Date.now() + 86400000),
      canonicalDigest: 'digest_t2',
      idempotencyKey: `idemp_t2_${Date.now()}`,
      status: 'ready',
    });

    await ApprovedRecipient.create({
      snapshotId: snapshot2._id,
      batchId: batch2._id,
      ownerId: testOwner,
      recipientKey: 'rec_t2',
      sourceRowNumber: 1,
      effectiveData: { name: 'Bob' },
      status: 'valid',
      generationStatus: 'generated',
    });

    // Execute deleteTemplate with confirmCascade: true
    const deleteTplRes = await deleteTemplate({
      templateId: template2._id,
      ownerId: testOwner,
      confirmCascade: true,
    });

    assert.strictEqual(deleteTplRes.success, true);
    assert.strictEqual(deleteTplRes.deletedBatchesCount, 1);

    const [
      remTpl,
      remVer,
      remBatch2,
      remSnap2,
      remRec2,
    ] = await Promise.all([
      Template.findById(template2._id),
      TemplateVersion.find({ templateId: template2._id }),
      Batch.findById(batch2._id),
      ApprovedSnapshot.find({ templateId: template2._id }),
      ApprovedRecipient.find({ batchId: batch2._id }),
    ]);

    assert.strictEqual(remTpl, null, 'Template must be deleted');
    assert.strictEqual(remVer.length, 0, 'TemplateVersions must be deleted');
    assert.strictEqual(remBatch2, null, 'Dependent Batch must be deleted');
    assert.strictEqual(remSnap2.length, 0, 'Dependent ApprovedSnapshots must be deleted');
    assert.strictEqual(remRec2.length, 0, 'Dependent ApprovedRecipients must be deleted');

    console.log('   ✓ deleteTemplate cascaded cleanly across templates, batches, snapshots, and recipients\n');

    console.log('🎉 ALL SEAM 2 CASCADE DELETION TESTS PASSED SUCCESSFULLY!');
  } finally {
    // Teardown
    await Template.deleteMany({ ownerId: testOwner });
    await TemplateVersion.deleteMany({ ownerId: testOwner });
    await Batch.deleteMany({ ownerId: testOwner });
    await DraftRow.deleteMany({ ownerId: testOwner });
    await BatchImport.deleteMany({ ownerId: testOwner });
    await ApprovedSnapshot.deleteMany({ ownerId: testOwner });
    await ApprovedRecipient.deleteMany({ ownerId: testOwner });
    await ClaimPortal.deleteMany({ ownerId: testOwner });
    await mongoose.disconnect();
  }
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
