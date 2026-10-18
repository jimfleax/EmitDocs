/**
 * @file storage-calculation-accuracy.test.ts
 * @description Tests storage calculation accuracy and residual asset protection against unreferenced remote Cloudinary files.
 * @architecture Service and controller integration test suite verifying user storage calculation ignores unreferenced or abandoned cloud files.
 * @agent_note Requires MONGODB_URI in environment; runs against emitdocs_test database with mocked Cloudinary API methods.
 */

import 'dotenv/config';
import assert from 'node:assert';
import mongoose from 'mongoose';
import cloudinary from '../src/lib/cloudinary.js';
import { Template } from '../src/models/Template.js';
import { TemplateVersion } from '../src/models/TemplateVersion.js';
import { calculateUserStorage } from '../src/controllers/storage.controller.js';

/**
 * @desc Main test runner verifying storage calculation accuracy, zero-template edge cases, and residual protection.
 * @returns Promise resolving when all storage calculation accuracy tests pass.
 */
async function runTest() {
  console.log('🧪 Starting Storage Calculation Accuracy & Residual Protection Test Suite (Seam 3)...\n');

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { dbName: 'emitdocs_test' });
  console.log('   ✓ Connected to test database\n');

  const testOwner = `test_storage_acc_${Date.now()}`;

  const origResources = cloudinary.api.resources;
  const origDelete = cloudinary.api.delete_resources;
  const origAddTag = cloudinary.uploader.add_tag;

  try {
    /* -------------------------------------------------------------------------- */
    /*  1. Test: 0 templates in DB returns 0 bytes & 0 docs despite cloud orphans  */
    /* -------------------------------------------------------------------------- */
    console.log('1. Testing 0 templates in DB returns 0 bytes despite cloud orphans...');

    let cleanupTriggered = false;
    cloudinary.api.resources = (async (opts: any) => {
      if (opts.resource_type === 'image') {
        return {
          resources: [
            {
              public_id: `templates/${testOwner}/abandoned_file_1`,
              resource_type: 'image',
              bytes: 50000,
              format: 'pdf',
              created_at: new Date().toISOString(),
            },
            {
              public_id: `templates/${testOwner}/abandoned_file_2`,
              resource_type: 'image',
              bytes: 75000,
              format: 'pdf',
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      return { resources: [] };
    }) as any;

    cloudinary.uploader.add_tag = (async () => {
      cleanupTriggered = true;
      return { public_ids: [] };
    }) as any;

    cloudinary.api.delete_resources = (async (publicIds: string[]) => {
      cleanupTriggered = true;
      return {
        deleted: publicIds.reduce((acc, id) => ({ ...acc, [id]: 'deleted' }), {}),
      };
    }) as any;

    const summaryZero = await calculateUserStorage(testOwner);

    assert.strictEqual(summaryZero.success, true);
    assert.strictEqual(summaryZero.totalBytes, 0, 'totalBytes must be 0 when user has no templates in DB');
    assert.strictEqual(summaryZero.formattedTotal, '0 B', 'formattedTotal must be 0 B');
    assert.strictEqual(summaryZero.documentCount, 0, 'documentCount must be 0 when user has no templates in DB');
    assert.strictEqual(summaryZero.documents.length, 0, 'documents list must be empty');

    console.log('   ✓ Zero templates in DB strictly returns 0 bytes and 0 documents\n');

    /* -------------------------------------------------------------------------- */
    /*  2. Test: Filter out residual orphaned files when active templates exist   */
    /* -------------------------------------------------------------------------- */
    console.log('2. Testing orphaned files excluded when active template exists...');

    const activeTpl = await Template.create({
      ownerId: testOwner,
      name: 'Single Real Template',
    });

    const activeVer = await TemplateVersion.create({
      templateId: activeTpl._id,
      ownerId: testOwner,
      version: 1,
      sourceObjectKey: `templates/${testOwner}/real_template`,
      bytes: 30000,
      pageCount: 1,
      status: 'active',
      fieldMappings: [],
      mappingHash: 'real_hash',
    });

    activeTpl.currentVersionId = activeVer._id;
    await activeTpl.save();

    cloudinary.api.resources = (async (opts: any) => {
      if (opts.resource_type === 'image') {
        return {
          resources: [
            {
              public_id: `templates/${testOwner}/real_template`,
              resource_type: 'image',
              bytes: 30000,
              format: 'pdf',
              created_at: new Date().toISOString(),
            },
            {
              public_id: `templates/${testOwner}/leftover_ghost_file`,
              resource_type: 'image',
              bytes: 90000,
              format: 'pdf',
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      return { resources: [] };
    }) as any;

    const summaryActive = await calculateUserStorage(testOwner);

    assert.strictEqual(summaryActive.success, true);
    assert.strictEqual(summaryActive.documentCount, 1, 'Only the active template must be counted');
    assert.strictEqual(summaryActive.totalBytes, 30000, 'totalBytes must only reflect the active template');
    assert.strictEqual(summaryActive.documents.length, 1);
    assert.strictEqual(summaryActive.documents[0].id, `templates/${testOwner}/real_template`);
    assert.strictEqual(summaryActive.documents[0].name, 'Single Real Template');

    console.log('   ✓ Orphaned residual cloud files excluded from user storage metrics\n');

    console.log('🎉 ALL SEAM 3 STORAGE CALCULATION ACCURACY TESTS PASSED SUCCESSFULLY!');
  } finally {
    cloudinary.api.resources = origResources;
    cloudinary.api.delete_resources = origDelete;
    cloudinary.uploader.add_tag = origAddTag;

    await Template.deleteMany({ ownerId: testOwner });
    await TemplateVersion.deleteMany({ ownerId: testOwner });
    await mongoose.disconnect();
  }
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
