import 'dotenv/config';
import assert from 'node:assert';
import mongoose from 'mongoose';
import cloudinary from '../src/lib/cloudinary.js';
import { Template } from '../src/models/Template.js';
import { TemplateVersion } from '../src/models/TemplateVersion.js';
import { ApprovedSnapshot } from '../src/models/ApprovedSnapshot.js';
import { ApprovedRecipient } from '../src/models/ApprovedRecipient.js';
import { Batch } from '../src/models/Batch.js';
import {
  isAssetReferenced,
  getReferencedKeysInDatabase,
  deleteAssetsFromCloudinary,
  cleanupUnreferencedCloudinaryAssets,
  type CloudinaryAssetSummary,
} from '../src/services/cloudinary-cleanup.js';
import { deleteTemplate } from '../src/services/template-lifecycle.js';

async function runTests() {
  console.log('🧪 Starting Cloudinary Cleanup Service test suite...\n');

  /* -------------------------------------------------------------------------- */
  /*  Unit Test 1: Reference Detection Logic (isAssetReferenced)                */
  /* -------------------------------------------------------------------------- */
  console.log('1. Testing isAssetReferenced reference detection...');

  // 1a. Exact match on sourceObjectKey
  const exactKeySet = new Set(['templates/owner_1/diploma.pdf']);
  assert.strictEqual(
    isAssetReferenced('templates/owner_1/diploma.pdf', exactKeySet, []),
    true,
    'Must match exact sourceObjectKey'
  );

  // 1b. Normalized cleanId without extension vs with .pdf
  const noExtKeySet = new Set(['templates/owner_1/cert']);
  assert.strictEqual(
    isAssetReferenced('templates/owner_1/cert.pdf', noExtKeySet, []),
    true,
    'Must match cleanId when publicId includes .pdf'
  );

  const withExtKeySet = new Set(['templates/owner_1/award.pdf']);
  assert.strictEqual(
    isAssetReferenced('templates/owner_1/award', withExtKeySet, []),
    true,
    'Must match with .pdf when publicId is extensionless'
  );

  // 1c. ApprovedSnapshot.templateSourceChecksum
  const snapshotChecksumSet = new Set(['templates/owner_1/snap_doc_123.pdf']);
  assert.strictEqual(
    isAssetReferenced('templates/owner_1/snap_doc_123.pdf', snapshotChecksumSet, []),
    true,
    'Must match ApprovedSnapshot.templateSourceChecksum'
  );
  assert.strictEqual(
    isAssetReferenced('templates/owner_1/snap_doc_123', snapshotChecksumSet, []),
    true,
    'Must match ApprovedSnapshot.templateSourceChecksum without extension'
  );

  // 1d. Template.thumbnailUrl containing publicId or cleanId
  const sampleThumbUrl =
    'https://res.cloudinary.com/demo/image/authenticated/s--xyz123--/c_fill,h_450,pg_1,w_600/v1/templates/owner_1/preview_thumb.png';
  assert.strictEqual(
    isAssetReferenced('templates/owner_1/preview_thumb', new Set(), [sampleThumbUrl]),
    true,
    'Must match when cleanId is contained in thumbnailUrl'
  );
  assert.strictEqual(
    isAssetReferenced('templates/owner_1/preview_thumb.pdf', new Set(), [sampleThumbUrl]),
    true,
    'Must match when publicId has .pdf and cleanId is in thumbnailUrl'
  );

  // 1e. ApprovedRecipient.outputKey
  const recipientOutputSet = new Set(['templates/owner_1/generated_cert_rec1.pdf']);
  assert.strictEqual(
    isAssetReferenced('templates/owner_1/generated_cert_rec1.pdf', recipientOutputSet, []),
    true,
    'Must match ApprovedRecipient.outputKey'
  );

  // 1f. Unreferenced assets return false
  assert.strictEqual(
    isAssetReferenced('templates/owner_1/unreferenced_asset.pdf', exactKeySet, [sampleThumbUrl]),
    false,
    'Unreferenced asset must return false'
  );
  assert.strictEqual(
    isAssetReferenced('', exactKeySet, [sampleThumbUrl]),
    false,
    'Empty publicId must return false'
  );

  console.log('   ✓ isAssetReferenced reference detection verified across all variants\n');

  /* -------------------------------------------------------------------------- */
  /*  Unit Test 2: Chunking of Cloudinary Deletions (<= 100 per chunk)          */
  /* -------------------------------------------------------------------------- */
  console.log('2. Testing deletion chunking in deleteAssetsFromCloudinary (<= 100 per chunk)...');
  const originalDeleteResources = cloudinary.api.delete_resources;
  const chunkSizes: number[] = [];

  try {
    cloudinary.api.delete_resources = (async (publicIds: string[], _options: any) => {
      chunkSizes.push(publicIds.length);
      return {
        deleted: publicIds.reduce((acc, id) => ({ ...acc, [id]: 'deleted' }), {}),
      };
    }) as any;

    const dummyAssets: CloudinaryAssetSummary[] = Array.from({ length: 245 }, (_, i) => ({
      publicId: `templates/owner_1/file_${i}`,
      resourceType: 'image',
    }));

    const totalDeleted = await deleteAssetsFromCloudinary(dummyAssets);
    assert.strictEqual(totalDeleted, 245, 'Total deleted count must match assets length');
    assert.deepStrictEqual(chunkSizes, [100, 100, 45], 'Must delete in chunks of <= 100 (100, 100, 45)');
    assert.ok(chunkSizes.every((sz) => sz <= 100), 'All chunks must be <= 100');
  } finally {
    cloudinary.api.delete_resources = originalDeleteResources;
  }
  console.log('   ✓ Deletion chunking <= 100 verified\n');

  /* -------------------------------------------------------------------------- */
  /*  Database Integration Setup                                                */
  /* -------------------------------------------------------------------------- */
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { dbName: 'emitdocs_test' });
  console.log('   ✓ Connected to test database\n');

  const testOwner = `test_owner_cleanup_${Date.now()}`;

  try {
    /* -------------------------------------------------------------------------- */
    /*  Test 3: Database Reference Scanning (getReferencedKeysInDatabase)         */
    /* -------------------------------------------------------------------------- */
    console.log('3. Testing getReferencedKeysInDatabase fixture retrieval...');

    const dbTemplate = await Template.create({
      ownerId: testOwner,
      name: 'Cleanup Test Template',
      thumbnailUrl: `https://res.cloudinary.com/demo/image/authenticated/s--abc--/templates/${testOwner}/thumb_fixture.png`,
    });

    const dbVersion = await TemplateVersion.create({
      templateId: dbTemplate._id,
      ownerId: testOwner,
      version: 1,
      sourceObjectKey: `templates/${testOwner}/version_source.pdf`,
      bytes: 1024,
      pageCount: 1,
      status: 'active',
      fieldMappings: [],
      mappingHash: 'hash_123',
    });

    dbTemplate.currentVersionId = dbVersion._id;
    await dbTemplate.save();

    const dbBatch = await Batch.create({
      ownerId: testOwner,
      templateId: dbTemplate._id,
      templateVersionId: dbVersion._id,
      name: 'Cleanup Batch Fixture',
      status: 'draft',
    });

    const dbSnapshot = await ApprovedSnapshot.create({
      batchId: dbBatch._id,
      ownerId: testOwner,
      templateId: dbTemplate._id,
      templateVersionId: dbVersion._id,
      templateVersion: 1,
      templateSourceChecksum: `templates/${testOwner}/snapshot_source.pdf`,
      mappingHash: 'hash_123',
      importRevision: 1,
      expiresAt: new Date(Date.now() + 86400000),
      canonicalDigest: 'digest_123',
      idempotencyKey: `idemp_${Date.now()}`,
      status: 'ready',
    });

    await ApprovedRecipient.create({
      snapshotId: dbSnapshot._id,
      batchId: dbBatch._id,
      ownerId: testOwner,
      recipientKey: 'rec_1',
      sourceRowNumber: 1,
      effectiveData: { name: 'John Doe' },
      outputKey: `templates/${testOwner}/recipient_output.pdf`,
      status: 'valid',
      generationStatus: 'generated',
    });

    const { referencedKeys, thumbnailUrls } = await getReferencedKeysInDatabase(testOwner);

    assert.ok(
      referencedKeys.has(`templates/${testOwner}/version_source.pdf`),
      'Must contain TemplateVersion.sourceObjectKey'
    );
    assert.ok(
      referencedKeys.has(`templates/${testOwner}/snapshot_source.pdf`),
      'Must contain ApprovedSnapshot.templateSourceChecksum'
    );
    assert.ok(
      referencedKeys.has(`templates/${testOwner}/recipient_output.pdf`),
      'Must contain ApprovedRecipient.outputKey'
    );
    assert.ok(
      thumbnailUrls.some((u) => u.includes(`templates/${testOwner}/thumb_fixture.png`)),
      'Must contain Template.thumbnailUrl'
    );

    // Verify isAssetReferenced with database-extracted sets
    assert.strictEqual(isAssetReferenced(`templates/${testOwner}/version_source.pdf`, referencedKeys, thumbnailUrls), true);
    assert.strictEqual(isAssetReferenced(`templates/${testOwner}/snapshot_source`, referencedKeys, thumbnailUrls), true);
    assert.strictEqual(isAssetReferenced(`templates/${testOwner}/recipient_output`, referencedKeys, thumbnailUrls), true);
    assert.strictEqual(isAssetReferenced(`templates/${testOwner}/thumb_fixture`, referencedKeys, thumbnailUrls), true);
    assert.strictEqual(isAssetReferenced(`templates/${testOwner}/orphan_file`, referencedKeys, thumbnailUrls), false);

    console.log('   ✓ Database references correctly scanned and matched\n');

    /* -------------------------------------------------------------------------- */
    /*  Test 4: Mark-and-Sweep Workflow (cleanupUnreferencedCloudinaryAssets)      */
    /* -------------------------------------------------------------------------- */
    console.log('4. Testing cleanupUnreferencedCloudinaryAssets mark-and-sweep workflow...');

    const origResources = cloudinary.api.resources;
    const origAddTag = cloudinary.uploader.add_tag;
    const origDelete = cloudinary.api.delete_resources;

    const taggedCalls: Array<{ tag: string; publicIds: string[]; options?: any }> = [];
    const deleteCalls: Array<{ publicIds: string[]; options?: any }> = [];

    try {
      // 4a. Stub resources returning mixed assets: 1 referenced image, 1 unreferenced image, 1 unreferenced raw
      cloudinary.api.resources = (async (options: any) => {
        if (options?.resource_type === 'image') {
          return {
            resources: [
              {
                public_id: `templates/${testOwner}/version_source.pdf`,
                resource_type: 'image',
                bytes: 2048,
              },
              {
                public_id: `templates/${testOwner}/unreferenced_img`,
                resource_type: 'image',
                bytes: 4096,
              },
            ],
          };
        }
        if (options?.resource_type === 'raw') {
          return {
            resources: [
              {
                public_id: `templates/${testOwner}/unreferenced_raw.dat`,
                resource_type: 'raw',
                bytes: 1024,
              },
            ],
          };
        }
        return { resources: [] };
      }) as any;

      // 4b. Stub add_tag
      cloudinary.uploader.add_tag = (async (tag: string, publicIds: string | string[], options: any) => {
        const ids = Array.isArray(publicIds) ? publicIds : [publicIds];
        taggedCalls.push({ tag, publicIds: ids, options });
        return { public_ids: ids };
      }) as any;

      // 4c. Stub delete_resources
      cloudinary.api.delete_resources = (async (publicIds: string[], options: any) => {
        deleteCalls.push({ publicIds, options });
        return {
          deleted: publicIds.reduce((acc, id) => ({ ...acc, [id]: 'deleted' }), {}),
        };
      }) as any;

      const summary = await cleanupUnreferencedCloudinaryAssets({ ownerId: testOwner });

      // Verify summary counts
      assert.strictEqual(summary.checkedCount, 3, 'checkedCount must be 3');
      assert.strictEqual(summary.referencedCount, 1, 'referencedCount must be 1');
      assert.strictEqual(summary.unreferencedCount, 2, 'unreferencedCount must be 2');
      assert.strictEqual(summary.markedAssets.length, 2, 'markedAssets must have 2 items');
      assert.strictEqual(summary.deletedCount, 2, 'deletedCount must be 2');

      // Verify tag application
      const allTaggedIds = taggedCalls.flatMap((c) => c.publicIds);
      assert.ok(taggedCalls.every((c) => c.tag === 'unreferenced'), "Must apply 'unreferenced' tag");
      assert.ok(allTaggedIds.includes(`templates/${testOwner}/unreferenced_img`));
      assert.ok(allTaggedIds.includes(`templates/${testOwner}/unreferenced_raw.dat`));
      assert.ok(
        !allTaggedIds.includes(`templates/${testOwner}/version_source.pdf`),
        'Referenced asset must NOT be tagged'
      );

      // Verify delete_resources invocation
      const allDeletedIds = deleteCalls.flatMap((c) => c.publicIds);
      assert.ok(allDeletedIds.includes(`templates/${testOwner}/unreferenced_img`));
      assert.ok(allDeletedIds.includes(`templates/${testOwner}/unreferenced_raw.dat`));
      assert.ok(
        !allDeletedIds.includes(`templates/${testOwner}/version_source.pdf`),
        'Referenced asset must NOT be deleted'
      );
      assert.ok(deleteCalls.every((c) => c.publicIds.length <= 100), 'Delete chunks must be <= 100');

      console.log('   ✓ Mark-and-sweep counts, tags, chunked deletions, and protection verified\n');
    } finally {
      cloudinary.api.resources = origResources;
      cloudinary.uploader.add_tag = origAddTag;
      cloudinary.api.delete_resources = origDelete;
    }

    /* -------------------------------------------------------------------------- */
    /*  Test 5: Graceful Error Handling                                           */
    /* -------------------------------------------------------------------------- */
    console.log('5. Testing graceful handling when credentials missing or API throws...');

    // 5a. Missing credentials
    const origApiKey = process.env.CLOUDINARY_API_KEY;
    try {
      delete process.env.CLOUDINARY_API_KEY;
      const missingCredsResult = await cleanupUnreferencedCloudinaryAssets({ ownerId: testOwner });
      assert.strictEqual(missingCredsResult.checkedCount, 0);
      assert.strictEqual(missingCredsResult.deletedCount, 0);
      assert.ok(missingCredsResult.errors && missingCredsResult.errors.length > 0);
      assert.ok(missingCredsResult.errors[0].includes('credentials missing'));
    } finally {
      process.env.CLOUDINARY_API_KEY = origApiKey;
    }

    // 5b. Cloudinary API error during resource listing
    const origResourcesForError = cloudinary.api.resources;
    try {
      cloudinary.api.resources = (async () => {
        throw new Error('Cloudinary rate limit exceeded');
      }) as any;

      const apiErrResult = await cleanupUnreferencedCloudinaryAssets({ ownerId: testOwner });
      assert.strictEqual(apiErrResult.checkedCount, 0);
      assert.strictEqual(apiErrResult.deletedCount, 0);
      assert.ok(apiErrResult.errors && apiErrResult.errors.length > 0);
      assert.ok(apiErrResult.errors[0].includes('Cloudinary rate limit exceeded'));
    } finally {
      cloudinary.api.resources = origResourcesForError;
    }

    // 5c. Missing ownerId
    const missingOwnerResult = await cleanupUnreferencedCloudinaryAssets({ ownerId: '' });
    assert.strictEqual(missingOwnerResult.checkedCount, 0);
    assert.ok(missingOwnerResult.errors && missingOwnerResult.errors.length > 0);

    console.log('   ✓ Graceful error handling verified across all failure modes\n');

    /* -------------------------------------------------------------------------- */
    /*  Test 6: Integration into deleteTemplate                                   */
    /* -------------------------------------------------------------------------- */
    console.log('6. Testing deleteTemplate integration with unreferenced Cloudinary cleanup...');

    const templateToDelete = await Template.create({
      ownerId: testOwner,
      name: 'Template For Delete With Cleanup',
    });

    const versionToDelete = await TemplateVersion.create({
      templateId: templateToDelete._id,
      ownerId: testOwner,
      version: 1,
      sourceObjectKey: `templates/${testOwner}/to_delete.pdf`,
      bytes: 1024,
      pageCount: 1,
      status: 'active',
      fieldMappings: [],
      mappingHash: 'hash_delete',
    });

    templateToDelete.currentVersionId = versionToDelete._id;
    await templateToDelete.save();

    // Stub resources returning the asset we are about to delete as unreferenced
    const origRes = cloudinary.api.resources;
    const origTag = cloudinary.uploader.add_tag;
    const origDel = cloudinary.api.delete_resources;

    try {
      cloudinary.api.resources = (async () => {
        return {
          resources: [
            {
              public_id: `templates/${testOwner}/to_delete.pdf`,
              resource_type: 'image',
              bytes: 1024,
            },
          ],
        };
      }) as any;
      cloudinary.uploader.add_tag = (async () => ({ public_ids: [`templates/${testOwner}/to_delete.pdf`] })) as any;
      cloudinary.api.delete_resources = (async (publicIds: string[]) => ({
        deleted: publicIds.reduce((acc, id) => ({ ...acc, [id]: 'deleted' }), {}),
      })) as any;

      const deleteRes = await deleteTemplate({
        templateId: templateToDelete._id,
        ownerId: testOwner,
      });

      assert.strictEqual(deleteRes.success, true);
      assert.strictEqual(deleteRes.message, 'Template deleted');
      assert.ok(deleteRes.cleanup, 'DeleteTemplateResult must include cleanup summary');
      assert.strictEqual(deleteRes.cleanup.checkedCount, 1);
      assert.strictEqual(deleteRes.cleanup.unreferencedCount, 1);
      assert.strictEqual(deleteRes.cleanup.deletedCount, 1);
      console.log('   ✓ deleteTemplate post-commit cleanup integration verified\n');
    } finally {
      cloudinary.api.resources = origRes;
      cloudinary.uploader.add_tag = origTag;
      cloudinary.api.delete_resources = origDel;
    }

    /* -------------------------------------------------------------------------- */
    /*  Teardown                                                                  */
    /* -------------------------------------------------------------------------- */
    console.log('7. Cleaning up test data...');
    await Template.deleteMany({ ownerId: testOwner });
    await TemplateVersion.deleteMany({ ownerId: testOwner });
    await Batch.deleteMany({ ownerId: testOwner });
    await ApprovedSnapshot.deleteMany({ ownerId: testOwner });
    await ApprovedRecipient.deleteMany({ ownerId: testOwner });
    await mongoose.disconnect();
    console.log('   ✓ Test database disconnected and fixtures removed\n');

    console.log('🎉 ALL CLOUDINARY CLEANUP TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    await mongoose.disconnect().catch(() => {});
    throw err;
  }
}

runTests().catch((err) => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
