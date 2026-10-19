/**
 * @file cloudinary-cleanup-orphans.test.ts
 * @description Tests Cloudinary orphan cleanup routines to ensure orphaned snapshot assets and unreferenced remote files are pruned properly.
 * @architecture Service layer integration test suite validating asset reference calculations, orphan snapshot detection, and Cloudinary deletion calls.
 * @agent_note Requires MONGODB_URI in environment; runs against emitdocs_test database with isolated test owner namespaces and mocked Cloudinary API methods.
 */

import 'dotenv/config';
import assert from 'node:assert';
import mongoose from 'mongoose';
import cloudinary from '../src/lib/cloudinary.js';
import { Template } from '../src/models/Template.js';
import { TemplateVersion } from '../src/models/TemplateVersion.js';
import { Batch } from '../src/models/Batch.js';
import { ApprovedSnapshot } from '../src/models/ApprovedSnapshot.js';
import { ApprovedRecipient } from '../src/models/ApprovedRecipient.js';
import {
  getReferencedKeysInDatabase,
  pruneOrphanedSnapshotsAndRecipients,
  cleanupUnreferencedCloudinaryAssets,
} from '../src/services/cloudinary-cleanup.js';

/**
 * @desc Main test runner verifying orphan snapshot pruning and Cloudinary asset cleanup mechanics.
 * @returns Promise resolving when all orphan cleanup assertions pass.
 */
async function runTest() {
  console.log('🧪 Starting Cloudinary Cleanup Orphan Handling & Seam 1 Test Suite...\n');

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { dbName: 'emitdocs_test' });
  console.log('   ✓ Connected to test database\n');

  const testOwner = `test_orphan_owner_${Date.now()}`;

  try {
    /* -------------------------------------------------------------------------- */
    /*  1. Test: Orphaned snapshots (batch or template deleted) are NOT referenced */
    /* -------------------------------------------------------------------------- */
    console.log('1. Testing getReferencedKeysInDatabase ignores orphaned snapshots...');

    // Create 1 active template + version
    const activeTemplate = await Template.create({
      ownerId: testOwner,
      name: 'Active Template',
      thumbnailUrl: `https://res.cloudinary.com/demo/image/authenticated/templates/${testOwner}/active_thumb.png`,
    });

    const activeVersion = await TemplateVersion.create({
      templateId: activeTemplate._id,
      ownerId: testOwner,
      version: 1,
      sourceObjectKey: `templates/${testOwner}/active_template.pdf`,
      bytes: 2048,
      pageCount: 1,
      status: 'active',
      fieldMappings: [],
      mappingHash: 'active_hash',
    });

    activeTemplate.currentVersionId = activeVersion._id;
    await activeTemplate.save();

    // Create 1 active batch
    const activeBatch = await Batch.create({
      ownerId: testOwner,
      templateId: activeTemplate._id,
      templateVersionId: activeVersion._id,
      name: 'Active Batch',
      status: 'approved',
    });

    // Valid snapshot attached to active batch and active template
    await ApprovedSnapshot.create({
      batchId: activeBatch._id,
      ownerId: testOwner,
      templateId: activeTemplate._id,
      templateVersionId: activeVersion._id,
      templateVersion: 1,
      templateSourceChecksum: `templates/${testOwner}/active_template.pdf`,
      mappingHash: 'active_hash',
      importRevision: 1,
      expiresAt: new Date(Date.now() + 86400000),
      canonicalDigest: 'active_digest',
      idempotencyKey: `idemp_active_${Date.now()}`,
      status: 'ready',
    });

    // Orphaned snapshot 1: points to a deleted/non-existent batch
    const deletedBatchId = new mongoose.Types.ObjectId();
    await ApprovedSnapshot.create({
      batchId: deletedBatchId,
      ownerId: testOwner,
      templateId: activeTemplate._id,
      templateVersionId: activeVersion._id,
      templateVersion: 1,
      templateSourceChecksum: `templates/${testOwner}/orphan_batch_asset.pdf`,
      mappingHash: 'orphan_hash_1',
      importRevision: 1,
      expiresAt: new Date(Date.now() + 86400000),
      canonicalDigest: 'orphan_digest_1',
      idempotencyKey: `idemp_orphan_1_${Date.now()}`,
      status: 'ready',
    });

    // Orphaned snapshot 2: points to a deleted/non-existent template
    const deletedTemplateId = new mongoose.Types.ObjectId();
    await ApprovedSnapshot.create({
      batchId: activeBatch._id,
      ownerId: testOwner,
      templateId: deletedTemplateId,
      templateVersionId: activeVersion._id,
      templateVersion: 1,
      templateSourceChecksum: `templates/${testOwner}/orphan_template_asset.pdf`,
      mappingHash: 'orphan_hash_2',
      importRevision: 1,
      expiresAt: new Date(Date.now() + 86400000),
      canonicalDigest: 'orphan_digest_2',
      idempotencyKey: `idemp_orphan_2_${Date.now()}`,
      status: 'ready',
    });

    // Orphaned recipient attached to deleted batch
    await ApprovedRecipient.create({
      snapshotId: new mongoose.Types.ObjectId(),
      batchId: deletedBatchId,
      ownerId: testOwner,
      recipientKey: 'rec_orphan',
      sourceRowNumber: 1,
      effectiveData: { name: 'Ghost' },
      outputKey: `templates/${testOwner}/orphan_recipient_output.pdf`,
      status: 'valid',
      generationStatus: 'generated',
    });

    const { referencedKeys } = await getReferencedKeysInDatabase(testOwner);

    assert.ok(
      referencedKeys.has(`templates/${testOwner}/active_template.pdf`),
      'Must contain active template asset'
    );
    assert.strictEqual(
      referencedKeys.has(`templates/${testOwner}/orphan_batch_asset.pdf`),
      false,
      'Must NOT contain asset from orphaned snapshot with deleted batch'
    );
    assert.strictEqual(
      referencedKeys.has(`templates/${testOwner}/orphan_template_asset.pdf`),
      false,
      'Must NOT contain asset from orphaned snapshot with deleted template'
    );
    assert.strictEqual(
      referencedKeys.has(`templates/${testOwner}/orphan_recipient_output.pdf`),
      false,
      'Must NOT contain output from orphaned recipient with deleted batch'
    );

    console.log('   ✓ getReferencedKeysInDatabase strictly filters out orphaned snapshot & recipient references\n');

    /* -------------------------------------------------------------------------- */
    /*  2. Test: pruneOrphanedSnapshotsAndRecipients cleans dangling records       */
    /* -------------------------------------------------------------------------- */
    console.log('2. Testing pruneOrphanedSnapshotsAndRecipients...');

    const pruneResult = await pruneOrphanedSnapshotsAndRecipients(testOwner);
    assert.strictEqual(pruneResult.prunedSnapshotsCount, 2, 'Should prune the 2 orphaned snapshots');
    assert.strictEqual(pruneResult.prunedRecipientsCount, 1, 'Should prune the 1 orphaned recipient');

    const remainingSnapshots = await ApprovedSnapshot.find({ ownerId: testOwner });
    assert.strictEqual(remainingSnapshots.length, 1, 'Only 1 active snapshot must remain');
    assert.strictEqual(
      remainingSnapshots[0].templateSourceChecksum,
      `templates/${testOwner}/active_template.pdf`,
      'Active snapshot must remain intact'
    );

    console.log('   ✓ pruneOrphanedSnapshotsAndRecipients correctly removed dangling records\n');

    /* -------------------------------------------------------------------------- */
    /*  3. Test: cleanupUnreferencedCloudinaryAssets purges newly unlocked orphans  */
    /* -------------------------------------------------------------------------- */
    console.log('3. Testing cleanupUnreferencedCloudinaryAssets deletes unlocked orphan assets...');

    const origResources = cloudinary.api.resources;
    const origDelete = cloudinary.api.delete_resources;
    const origAddTag = cloudinary.uploader.add_tag;

    const deletedPublicIds: string[] = [];

    try {
      cloudinary.api.resources = (async (opts: any) => {
        if (opts.resource_type === 'image') {
          return {
            resources: [
              {
                public_id: `templates/${testOwner}/active_template.pdf`,
                resource_type: 'image',
                bytes: 2048,
              },
              {
                public_id: `templates/${testOwner}/orphan_batch_asset.pdf`,
                resource_type: 'image',
                bytes: 4096,
              },
            ],
          };
        }
        return { resources: [] };
      }) as any;

      cloudinary.uploader.add_tag = (async () => ({ public_ids: [] })) as any;

      cloudinary.api.delete_resources = (async (publicIds: string[]) => {
        deletedPublicIds.push(...publicIds);
        return {
          deleted: publicIds.reduce((acc, id) => ({ ...acc, [id]: 'deleted' }), {}),
        };
      }) as any;

      const cleanupSummary = await cleanupUnreferencedCloudinaryAssets({ ownerId: testOwner });
      assert.strictEqual(cleanupSummary.checkedCount, 2);
      assert.strictEqual(cleanupSummary.referencedCount, 1, 'Active template should be preserved');
      assert.strictEqual(cleanupSummary.unreferencedCount, 1, 'Orphan asset must be unreferenced');
      assert.strictEqual(cleanupSummary.deletedCount, 1, 'Orphan asset must be deleted');
      assert.ok(
        deletedPublicIds.includes(`templates/${testOwner}/orphan_batch_asset.pdf`),
        'Must delete orphan_batch_asset.pdf from Cloudinary'
      );
    } finally {
      cloudinary.api.resources = origResources;
      cloudinary.api.delete_resources = origDelete;
      cloudinary.uploader.add_tag = origAddTag;
    }

    console.log('   ✓ cleanupUnreferencedCloudinaryAssets successfully purged orphan asset\n');

    console.log('🎉 ALL SEAM 1 ORPHAN HANDLING TESTS PASSED SUCCESSFULLY!');
  } finally {
    // Teardown
    await Template.deleteMany({ ownerId: testOwner });
    await TemplateVersion.deleteMany({ ownerId: testOwner });
    await Batch.deleteMany({ ownerId: testOwner });
    await ApprovedSnapshot.deleteMany({ ownerId: testOwner });
    await ApprovedRecipient.deleteMany({ ownerId: testOwner });
    await mongoose.disconnect();
  }
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
