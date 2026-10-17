import 'dotenv/config';
import assert from 'node:assert';
import mongoose from 'mongoose';
import cloudinary from '../src/lib/cloudinary.js';
import { Template } from '../src/models/Template.js';
import { TemplateVersion, IFieldMapping } from '../src/models/TemplateVersion.js';
import { Batch } from '../src/models/Batch.js';
import {
  computeMappingHash,
  publishVersion,
  listVersions,
  getVersion,
  signUploadParams,
  generateThumbnailUrl,
  repairThumbnailUrl,
  ensureThumbnailHealth,
  createTemplate,
  listTemplates,
  getTemplate,
  deleteTemplate,
  streamAsset,
  TemplateNotFoundError,
  VersionConflictError,
  TemplateValidationError,
  StorageAssetError,
} from '../src/services/template-lifecycle.js';

async function runTests() {
  console.log('🧪 Starting TemplateLifecycle Slice 1 & 2 test suite...\n');

  // Test 1: Typed Domain Error Classes
  console.log('1. Testing typed domain error classes...');
  const notFoundErr = new TemplateNotFoundError('Template missing');
  assert.strictEqual(notFoundErr instanceof Error, true);
  assert.strictEqual(notFoundErr.name, 'TemplateNotFoundError');
  assert.strictEqual(notFoundErr.code, 'TEMPLATE_NOT_FOUND');

  const conflictErr = new VersionConflictError('Version conflict', 4);
  assert.strictEqual(conflictErr instanceof Error, true);
  assert.strictEqual(conflictErr.name, 'VersionConflictError');
  assert.strictEqual(conflictErr.code, 'VERSION_CONFLICT');
  assert.strictEqual(conflictErr.currentVersion, 4);

  const validationErr = new TemplateValidationError('Invalid payload');
  assert.strictEqual(validationErr instanceof Error, true);
  assert.strictEqual(validationErr.name, 'TemplateValidationError');
  assert.strictEqual(validationErr.code, 'TEMPLATE_VALIDATION_ERROR');

  const storageErr = new StorageAssetError('Cloudinary failure');
  assert.strictEqual(storageErr instanceof Error, true);
  assert.strictEqual(storageErr.name, 'StorageAssetError');
  assert.strictEqual(storageErr.code, 'STORAGE_ASSET_ERROR');
  console.log('   ✓ Typed domain error classes verified\n');

  // Test 2: computeMappingHash Canonical Ordering & Reproducibility
  console.log('2. Testing computeMappingHash canonical ordering & SHA-256 reproducibility...');
  const fieldA: IFieldMapping = {
    id: 'field_b',
    key: 'studentName',
    type: 'text',
    pageIndex: 0,
    rect: { x: 50, y: 100, width: 200, height: 30 },
    alignment: 'center',
    fontFamily: 'Helvetica',
    fontSize: 14,
    minFontSize: 10,
    maxFontSize: 20,
    color: '#000000',
    fitMode: 'shrink-to-fit',
    maskMode: 'none',
  };

  const fieldB: IFieldMapping = {
    id: 'field_a',
    key: 'issueDate',
    type: 'date',
    pageIndex: 0,
    rect: { x: 50, y: 50, width: 150, height: 25 },
    alignment: 'left',
    fontFamily: 'Helvetica',
    fontSize: 12,
    minFontSize: 8,
    maxFontSize: 16,
    color: '#333333',
    fitMode: 'shrink-to-fit',
    maskMode: 'none',
  };

  const fieldC: IFieldMapping = {
    id: 'field_c',
    key: 'grade',
    type: 'text',
    pageIndex: 1,
    rect: { x: 10, y: 10, width: 100, height: 20 },
    alignment: 'left',
    fontFamily: 'Helvetica',
    fontSize: 12,
    minFontSize: 8,
    maxFontSize: 16,
    color: '#000000',
    fitMode: 'shrink-to-fit',
    maskMode: 'none',
  };

  const hash1 = computeMappingHash([fieldA, fieldB, fieldC]);
  const hash2 = computeMappingHash([fieldC, fieldA, fieldB]);
  const hash3 = computeMappingHash([fieldB, fieldC, fieldA]);

  assert.strictEqual(hash1, hash2, 'Hash must be identical regardless of input array ordering');
  assert.strictEqual(hash2, hash3, 'Hash must be deterministic across all permutations');
  assert.strictEqual(hash1.length, 64, 'Hash must be a valid 64-character SHA-256 hex string');

  const emptyHash = computeMappingHash([]);
  assert.strictEqual(emptyHash.length, 64, 'Empty mappings array produces deterministic SHA-256 hex');
  console.log('   ✓ computeMappingHash canonical sorting and deterministic hashing verified\n');

  // Connect to test database
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { dbName: 'emitdocs_test' });
  console.log('   ✓ Connected to test database\n');

  const testOwner = `test_owner_${Date.now()}`;
  const otherOwner = `other_owner_${Date.now()}`;
  let quotaOwner: string | undefined;
  let concurrentOwner: string | undefined;

  try {
    // Test 3: Input validation guardrails for publishVersion
    console.log('3. Testing publishVersion input validation guardrails...');
    await assert.rejects(
      async () => {
        await publishVersion({
          templateId: new mongoose.Types.ObjectId(),
          ownerId: testOwner,
          expectedVersion: '1' as any,
          fieldMappings: [],
        });
      },
      (err: any) => err instanceof TemplateValidationError && err.code === 'INVALID_EXPECTED_VERSION'
    );

    await assert.rejects(
      async () => {
        await publishVersion({
          templateId: new mongoose.Types.ObjectId(),
          ownerId: testOwner,
          expectedVersion: 1.5 as any,
          fieldMappings: [],
        });
      },
      (err: any) => err instanceof TemplateValidationError && err.code === 'INVALID_EXPECTED_VERSION'
    );

    await assert.rejects(
      async () => {
        await publishVersion({
          templateId: new mongoose.Types.ObjectId(),
          ownerId: testOwner,
          expectedVersion: 1,
          fieldMappings: 'not-an-array' as any,
        });
      },
      (err: any) => err instanceof TemplateValidationError && err.code === 'INVALID_FIELD_MAPPINGS'
    );
    console.log('   ✓ Input validation guardrails verified\n');

    // Test 4: Entity presence and ownership guardrails
    console.log('4. Testing publishVersion entity presence and access control...');
    const nonExistentTemplateId = new mongoose.Types.ObjectId();
    await assert.rejects(
      async () => {
        await publishVersion({
          templateId: nonExistentTemplateId,
          ownerId: testOwner,
          expectedVersion: 1,
          fieldMappings: [],
        });
      },
      (err: any) => err instanceof TemplateNotFoundError
    );

    // Seed Template and initial Version
    const template = await Template.create({
      ownerId: testOwner,
      name: 'Degree Certificate',
    });

    const initialVersion = await TemplateVersion.create({
      templateId: template._id,
      ownerId: testOwner,
      version: 1,
      sourceObjectKey: 'templates/degree.pdf',
      bytes: 40960,
      pageCount: 1,
      status: 'active',
      fieldMappings: [fieldA],
      mappingHash: computeMappingHash([fieldA]),
    });

    template.currentVersionId = initialVersion._id;
    await template.save();

    await assert.rejects(
      async () => {
        await publishVersion({
          templateId: template._id,
          ownerId: otherOwner,
          expectedVersion: 1,
          fieldMappings: [fieldA, fieldB],
        });
      },
      (err: any) => err instanceof TemplateNotFoundError
    );
    console.log('   ✓ Entity presence and access control verified\n');

    // Test 5: CAS Optimistic Concurrency Conflict Detection
    console.log('5. Testing publishVersion CAS optimistic concurrency conflict detection...');
    await assert.rejects(
      async () => {
        await publishVersion({
          templateId: template._id,
          ownerId: testOwner,
          expectedVersion: 2,
          fieldMappings: [fieldA, fieldB],
        });
      },
      (err: any) => {
        return (
          err instanceof VersionConflictError &&
          err.code === 'VERSION_CONFLICT' &&
          err.currentVersion === 1
        );
      }
    );
    console.log('   ✓ VersionConflictError with currentVersion verified\n');

    // Test 6: Successful publishVersion
    console.log('6. Testing publishVersion happy path lifecycle transitions...');
    const publishRes = await publishVersion({
      templateId: template._id,
      ownerId: testOwner,
      expectedVersion: 1,
      fieldMappings: [fieldA, fieldB],
    });

    assert.strictEqual(publishRes.version.version, 2);
    assert.strictEqual(publishRes.version.status, 'active');
    assert.strictEqual(publishRes.version.fieldMappings.length, 2);
    assert.strictEqual(publishRes.version.mappingHash, computeMappingHash([fieldA, fieldB]));

    const prevVersionDoc = await TemplateVersion.findById(initialVersion._id);
    assert.strictEqual(prevVersionDoc?.status, 'superseded');

    const updatedTemplate = await Template.findById(template._id);
    assert.strictEqual(updatedTemplate?.currentVersionId?.toString(), publishRes.version._id.toString());
    console.log('   ✓ Superseded previous version, created new version, updated template.currentVersionId\n');

    // Test 7: listVersions
    console.log('7. Testing listVersions query and sorting...');
    const versions = await listVersions({
      templateId: template._id,
      ownerId: testOwner,
    });

    assert.strictEqual(versions.length, 2);
    assert.strictEqual(versions[0].version, 2);
    assert.strictEqual(versions[1].version, 1);

    await assert.rejects(
      async () => {
        await listVersions({
          templateId: template._id,
          ownerId: otherOwner,
        });
      },
      (err: any) => err instanceof TemplateNotFoundError
    );
    console.log('   ✓ listVersions returned versions in descending order\n');

    // Test 8: getVersion
    console.log('8. Testing getVersion retrieval and access guards...');
    const v1Doc = await getVersion({
      templateId: template._id,
      versionId: initialVersion._id,
      ownerId: testOwner,
    });
    assert.strictEqual(v1Doc.version, 1);
    assert.strictEqual(v1Doc.status, 'superseded');

    const v2Doc = await getVersion({
      templateId: template._id,
      versionId: publishRes.version._id,
      ownerId: testOwner,
    });
    assert.strictEqual(v2Doc.version, 2);
    assert.strictEqual(v2Doc.status, 'active');

    await assert.rejects(
      async () => {
        await getVersion({
          templateId: template._id,
          versionId: new mongoose.Types.ObjectId(),
          ownerId: testOwner,
        });
      },
      (err: any) => err instanceof TemplateNotFoundError
    );

    await assert.rejects(
      async () => {
        await getVersion({
          templateId: template._id,
          versionId: v2Doc._id,
          ownerId: otherOwner,
        });
      },
      (err: any) => err instanceof TemplateNotFoundError
    );

    await assert.rejects(
      async () => {
        await getVersion({
          templateId: 'invalid-template-id',
          versionId: v2Doc._id,
          ownerId: testOwner,
        });
      },
      (err: any) => err instanceof TemplateNotFoundError
    );

    await assert.rejects(
      async () => {
        await getVersion({
          templateId: template._id,
          versionId: 'invalid-version-id',
          ownerId: testOwner,
        });
      },
      (err: any) => err instanceof TemplateNotFoundError
    );
    console.log('   ✓ getVersion returned exact version and rejected invalid IDs\n');

    /* ---------------------------------------------------------------------- */
    /*                         Slice 2: Asset & Thumbnail                     */
    /* ---------------------------------------------------------------------- */

    // Test 9: generateThumbnailUrl
    console.log('9. Testing generateThumbnailUrl...');
    const cleanPublicId = 'templates/user_123/diploma';
    const generatedUrl = generateThumbnailUrl(cleanPublicId);
    assert.ok(generatedUrl.includes('/image/authenticated/'), 'Must use authenticated delivery');
    assert.ok(generatedUrl.includes('pg_1'), 'Must specify page 1');
    assert.ok(generatedUrl.includes('.png'), 'Must output png');
    assert.ok(generatedUrl.includes('s--'), 'Must contain signature');
    assert.ok(generatedUrl.includes(cleanPublicId), 'Must include publicId');

    const extUrl = generateThumbnailUrl('templates/user_123/diploma.pdf');
    assert.ok(!extUrl.includes('.pdf.png'), 'Must not create .pdf.png double extension');
    assert.strictEqual(generatedUrl, extUrl, 'URLs must match whether input has .pdf or not');

    assert.throws(
      () => generateThumbnailUrl(''),
      (err: any) => err instanceof TemplateValidationError && err.code === 'INVALID_PUBLIC_ID'
    );
    console.log('   ✓ generateThumbnailUrl clean path, extension stripping, and guards verified\n');

    // Test 10: repairThumbnailUrl
    console.log('10. Testing repairThumbnailUrl...');
    const legacyUrl = 'https://res.cloudinary.com/demo/image/upload/s--abc12345--/c_fill,h_450,pg_1,w_600/v1/templates/user_1/sample.png';
    const regeneratedFromLegacy = repairThumbnailUrl(legacyUrl, 'templates/user_1/sample');
    const expectedRegenerated = generateThumbnailUrl('templates/user_1/sample');
    assert.strictEqual(
      regeneratedFromLegacy,
      expectedRegenerated,
      'Legacy URL with available publicId must be regenerated with signed authenticated URL'
    );

    const preservedWithoutPublicId = repairThumbnailUrl(legacyUrl);
    assert.strictEqual(
      preservedWithoutPublicId,
      legacyUrl,
      'Legacy URL without publicId must be preserved unchanged'
    );

    const preservedRaw = repairThumbnailUrl(legacyUrl, 'templates/user_1/sample', 'raw');
    assert.strictEqual(
      preservedRaw,
      legacyUrl,
      'Legacy URL for raw resource must be preserved unchanged'
    );

    const validAuthUrl = 'https://res.cloudinary.com/demo/image/authenticated/s--abc12345--/sample.png';
    assert.strictEqual(repairThumbnailUrl(validAuthUrl), validAuthUrl);

    const regenerated = repairThumbnailUrl(null, 'templates/user_99/cert');
    assert.ok(regenerated?.includes('/image/authenticated/'));
    assert.ok(regenerated?.includes('templates/user_99/cert'));
    assert.strictEqual(repairThumbnailUrl(null), null);
    console.log('   ✓ repairThumbnailUrl legacy conversion, preservation, and regeneration verified\n');

    // Test 11: ensureThumbnailHealth
    console.log('11. Testing ensureThumbnailHealth (in-memory immediate repair & background DB sync)...');
    const healthTemplate = await Template.create({
      ownerId: testOwner,
      name: 'Health Check Template',
      thumbnailUrl: legacyUrl,
    });

    const healedUrl = ensureThumbnailHealth(healthTemplate, 'templates/user_1/sample');
    assert.strictEqual(healthTemplate.thumbnailUrl, expectedRegenerated, 'Must repair in-memory immediately');
    assert.strictEqual(healedUrl, expectedRegenerated);

    // Wait 100ms for background DB update to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    const persistedTemplate = await Template.findById(healthTemplate._id);
    assert.strictEqual(persistedTemplate?.thumbnailUrl, expectedRegenerated, 'Must persist repaired URL to database');
    console.log('   ✓ ensureThumbnailHealth in-memory and background DB persistence verified\n');

    // Test 12: signUploadParams
    console.log('12. Testing signUploadParams...');
    assert.throws(
      () => signUploadParams(''),
      (err: any) => err instanceof TemplateValidationError && err.code === 'INVALID_OWNER_ID'
    );

    const signed = signUploadParams({ ownerId: testOwner });
    assert.strictEqual(signed.folder, `templates/${testOwner}`);
    assert.ok(typeof signed.signature === 'string' && signed.signature.length > 0);
    assert.ok(typeof signed.timestamp === 'number');
    assert.ok(signed.timestamp > 0);

    // 12b. signUploadParams fails closed when database connection is not ready
    try {
      Object.defineProperty(mongoose.connection, 'readyState', { get: () => 0, configurable: true });
      await assert.rejects(
        async () => await signUploadParams({ ownerId: testOwner }),
        (err: any) => err instanceof StorageAssetError && err.code === 'DATABASE_UNAVAILABLE'
      );
    } finally {
      delete (mongoose.connection as any).readyState;
    }

    // 12c. signUploadParams rejects when owner storage quota is exceeded
    quotaOwner = `quota_exceeded_owner_${Date.now()}`;
    await TemplateVersion.create({
      templateId: new mongoose.Types.ObjectId(),
      ownerId: quotaOwner,
      version: 1,
      sourceObjectKey: `templates/${quotaOwner}/giant.pdf`,
      bytes: 501 * 1024 * 1024,
      pageCount: 1,
      status: 'active',
      fieldMappings: [],
      mappingHash: 'quota_hash',
    });
    await assert.rejects(
      async () => await signUploadParams({ ownerId: quotaOwner }),
      (err: any) => err instanceof StorageAssetError && err.code === 'STORAGE_QUOTA_EXCEEDED'
    );
    console.log('   ✓ signUploadParams validation, fail-closed readyState, quota enforcement, and signature verified\n');

    // Test 13: createTemplate
    console.log('13. Testing createTemplate (validation, dual-resource probing, entity creation)...');
    await assert.rejects(
      async () => createTemplate({ ownerId: testOwner, name: '', cloudinaryPublicId: 'sample' }),
      (err: any) => err instanceof TemplateValidationError && err.code === 'MISSING_NAME'
    );

    await assert.rejects(
      async () => createTemplate({ ownerId: testOwner, name: 'Sample', cloudinaryPublicId: '' }),
      (err: any) => err instanceof TemplateValidationError && err.code === 'MISSING_CLOUDINARY_PUBLIC_ID'
    );

    // Public ID outside owner's templates folder
    await assert.rejects(
      async () => createTemplate({ ownerId: testOwner, name: 'Sample', cloudinaryPublicId: 'templates/other_owner/sample' }),
      (err: any) => err instanceof TemplateValidationError && err.code === 'INVALID_CLOUDINARY_PUBLIC_ID'
    );

    // Bare folder without file name
    await assert.rejects(
      async () => createTemplate({ ownerId: testOwner, name: 'Sample', cloudinaryPublicId: `templates/${testOwner}/` }),
      (err: any) => err instanceof TemplateValidationError && err.code === 'INVALID_CLOUDINARY_PUBLIC_ID'
    );

    // Invalid thumbnailUrl from untrusted host
    await assert.rejects(
      async () => createTemplate({
        ownerId: testOwner,
        name: 'Sample',
        cloudinaryPublicId: `templates/${testOwner}/sample`,
        thumbnailUrl: 'https://evil.com/malicious.png',
      }),
      (err: any) => err instanceof TemplateValidationError && err.code === 'INVALID_THUMBNAIL_URL'
    );

    // Invalid thumbnailUrl from another owner
    await assert.rejects(
      async () => createTemplate({
        ownerId: testOwner,
        name: 'Sample',
        cloudinaryPublicId: `templates/${testOwner}/sample`,
        thumbnailUrl: 'https://res.cloudinary.com/demo/image/upload/v1/templates/other_owner/sample.png',
      }),
      (err: any) => err instanceof TemplateValidationError && err.code === 'INVALID_THUMBNAIL_URL'
    );

    const originalResource = cloudinary.api.resource;
    const origDeleteResources = cloudinary.api.delete_resources;
    try {
      // 13a. Probes 'image' resource first
      let probeLog: string[] = [];
      cloudinary.api.resource = (async (publicId: string, options: any) => {
        probeLog.push(options?.resource_type);
        if (options?.resource_type === 'image') {
          return { bytes: 48000, pages: 3, resource_type: 'image' };
        }
        throw new Error('Not found');
      }) as any;

      const imageCreated = await createTemplate({
        ownerId: testOwner,
        name: 'Award Certificate',
        cloudinaryPublicId: `templates/${testOwner}/award_pdf`,
      });

      assert.strictEqual(imageCreated.template.name, 'Award Certificate');
      assert.strictEqual(imageCreated.version.version, 1);
      assert.strictEqual(imageCreated.version.resourceType, 'image');
      assert.strictEqual(imageCreated.version.bytes, 48000);
      assert.strictEqual(imageCreated.version.pageCount, 3);
      assert.strictEqual(imageCreated.version.status, 'active');
      assert.strictEqual(imageCreated.template.currentVersionId?.toString(), imageCreated.version._id.toString());
      assert.ok(imageCreated.template.thumbnailUrl?.includes('/image/authenticated/'));
      assert.deepStrictEqual(probeLog, ['image'], 'Image probe must succeed on first attempt');

      // 13b. Falls back to 'raw' when 'image' fails
      probeLog = [];
      cloudinary.api.resource = (async (publicId: string, options: any) => {
        probeLog.push(options?.resource_type);
        if (options?.resource_type === 'image') throw new Error('Not an image');
        if (options?.resource_type === 'raw') return { bytes: 12000, pages: 1, resource_type: 'raw' };
        throw new Error('Not found');
      }) as any;

      const rawCreated = await createTemplate({
        ownerId: testOwner,
        name: 'Raw Document Template',
        cloudinaryPublicId: `templates/${testOwner}/raw_doc`,
      });

      assert.strictEqual(rawCreated.version.bytes, 12000);
      assert.strictEqual(rawCreated.version.resourceType, 'raw');
      assert.strictEqual(rawCreated.template.thumbnailUrl, null);
      assert.deepStrictEqual(probeLog, ['image', 'raw'], 'Must probe image first, then fallback to raw');

      // 13c. Both probes fail -> throws StorageAssetError
      cloudinary.api.resource = (async () => {
        throw new Error('Cloudinary 404');
      }) as any;

      await assert.rejects(
        async () => {
          await createTemplate({
            ownerId: testOwner,
            name: 'Missing Resource',
            cloudinaryPublicId: `templates/${testOwner}/missing`,
          });
        },
        (err: any) => err instanceof StorageAssetError && err.code === 'STORAGE_ASSET_NOT_FOUND'
      );
      // 13d. Size limit exceeded -> purges Cloudinary asset and throws TemplateValidationError
      let deletedAssets: string[] = [];
      cloudinary.api.delete_resources = (async (publicIds: string[], _opts: any) => {
        deletedAssets.push(...publicIds);
        return { deleted: { [publicIds[0]]: 'deleted' } };
      }) as any;

      cloudinary.api.resource = (async () => ({
        bytes: 16 * 1024 * 1024,
        pages: 1,
        resource_type: 'image',
      })) as any;

      await assert.rejects(
        async () => {
          await createTemplate({
            ownerId: testOwner,
            name: 'Oversized PDF',
            cloudinaryPublicId: `templates/${testOwner}/oversized_pdf`,
          });
        },
        (err: any) => err instanceof TemplateValidationError && err.code === 'TEMPLATE_SIZE_EXCEEDED'
      );
      assert.ok(
        deletedAssets.includes(`templates/${testOwner}/oversized_pdf`),
        'Must purge Cloudinary asset when rejected due to exceeding 15MB limit'
      );

      // 13e. Storage quota exceeded -> purges Cloudinary asset and throws StorageAssetError
      deletedAssets = [];
      cloudinary.api.resource = (async () => ({
        bytes: 10 * 1024 * 1024,
        pages: 1,
        resource_type: 'image',
      })) as any;

      await assert.rejects(
        async () => {
          await createTemplate({
            ownerId: quotaOwner,
            name: 'Quota Exceeded PDF',
            cloudinaryPublicId: `templates/${quotaOwner}/quota_pdf`,
          });
        },
        (err: any) => err instanceof StorageAssetError && err.code === 'STORAGE_QUOTA_EXCEEDED'
      );
      assert.ok(
        deletedAssets.includes(`templates/${quotaOwner}/quota_pdf`),
        'Must purge Cloudinary asset when rejected due to user storage quota exceeded'
      );

      // 13f. Concurrency safety: concurrent registrations for same owner are serialized and cannot exceed quota
      concurrentOwner = `concurrent_owner_${Date.now()}`;
      await TemplateVersion.create({
        templateId: new mongoose.Types.ObjectId(),
        ownerId: concurrentOwner,
        version: 1,
        sourceObjectKey: `templates/${concurrentOwner}/base.pdf`,
        bytes: 490 * 1024 * 1024,
        pageCount: 1,
        status: 'active',
        fieldMappings: [],
        mappingHash: 'concurrent_base_hash',
      });

      cloudinary.api.resource = (async (publicId: string) => ({
        bytes: 8 * 1024 * 1024,
        pages: 1,
        resource_type: 'image',
        public_id: publicId,
      })) as any;

      const concurrentResults = await Promise.allSettled([
        createTemplate({
          ownerId: concurrentOwner,
          name: 'Concurrent Template 1',
          cloudinaryPublicId: `templates/${concurrentOwner}/c1`,
        }),
        createTemplate({
          ownerId: concurrentOwner,
          name: 'Concurrent Template 2',
          cloudinaryPublicId: `templates/${concurrentOwner}/c2`,
        }),
      ]);

      const fulfilled = concurrentResults.filter((r) => r.status === 'fulfilled');
      const rejected = concurrentResults.filter((r) => r.status === 'rejected');
      assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent template registration should succeed under tight quota');
      assert.strictEqual(rejected.length, 1, 'The other concurrent template registration must be rejected with quota exceeded');
      assert.strictEqual((rejected[0] as PromiseRejectedResult).reason?.code, 'STORAGE_QUOTA_EXCEEDED');
    } finally {
      cloudinary.api.resource = originalResource;
      cloudinary.api.delete_resources = origDeleteResources;
    }
    console.log('   ✓ createTemplate validation, dual-resource probing, asset purge on rejection, quota enforcement, and concurrency safety verified\n');

    // Test 14: listTemplates
    console.log('14. Testing listTemplates (population, auto-healing, mappedOnly filter, owner isolation)...');
    
    // 14a. Input validation
    await assert.rejects(
      async () => listTemplates({ ownerId: '' }),
      (err: any) => err instanceof TemplateValidationError && err.code === 'INVALID_OWNER_ID'
    );

    // Seed templates for testOwner
    const legacyUrlForList = 'https://res.cloudinary.com/demo/image/upload/s--xyz--/c_fill,h_450,pg_1,w_600/v1/templates/owner/doc1.png';
    const tMapped = await Template.create({
      ownerId: testOwner,
      name: 'Mapped Certificate',
      thumbnailUrl: legacyUrlForList,
    });
    const vMapped = await TemplateVersion.create({
      templateId: tMapped._id,
      ownerId: testOwner,
      version: 1,
      sourceObjectKey: 'templates/owner/doc1.pdf',
      bytes: 20480,
      pageCount: 1,
      status: 'active',
      fieldMappings: [fieldA],
      mappingHash: computeMappingHash([fieldA]),
    });
    tMapped.currentVersionId = vMapped._id;
    await tMapped.save();

    const tUnmapped = await Template.create({
      ownerId: testOwner,
      name: 'Unmapped Certificate',
      thumbnailUrl: null,
    });
    const vUnmapped = await TemplateVersion.create({
      templateId: tUnmapped._id,
      ownerId: testOwner,
      version: 1,
      sourceObjectKey: 'templates/owner/doc2.pdf',
      bytes: 10240,
      pageCount: 1,
      status: 'active',
      fieldMappings: [],
      mappingHash: computeMappingHash([]),
    });
    tUnmapped.currentVersionId = vUnmapped._id;
    await tUnmapped.save();

    // Seed template for otherOwner to test tenant isolation
    const tOther = await Template.create({
      ownerId: otherOwner,
      name: 'Other Owner Template',
    });
    const vOther = await TemplateVersion.create({
      templateId: tOther._id,
      ownerId: otherOwner,
      version: 1,
      sourceObjectKey: 'templates/other/cert.pdf',
      bytes: 10240,
      pageCount: 1,
      status: 'active',
      fieldMappings: [],
      mappingHash: computeMappingHash([]),
    });
    tOther.currentVersionId = vOther._id;
    await tOther.save();

    // Test listTemplates for testOwner (default: mappedOnly = false)
    const allTestOwnerTemplates = await listTemplates({ ownerId: testOwner });
    assert.ok(allTestOwnerTemplates.length >= 2, 'Must return at least the 2 seeded templates');
    const returnedIds = allTestOwnerTemplates.map((t) => t._id.toString());
    assert.ok(returnedIds.includes(tMapped._id.toString()));
    assert.ok(returnedIds.includes(tUnmapped._id.toString()));
    assert.ok(!returnedIds.includes(tOther._id.toString()), 'Must strictly isolate across owners');

    // Verify currentVersionId is populated
    const foundTMapped = allTestOwnerTemplates.find((t) => t._id.toString() === tMapped._id.toString());
    assert.ok(foundTMapped?.currentVersionId, 'currentVersionId must be populated');
    assert.strictEqual((foundTMapped?.currentVersionId as any).version, 1);
    assert.strictEqual((foundTMapped?.currentVersionId as any).sourceObjectKey, 'templates/owner/doc1.pdf');

    // Verify auto-healing occurred on thumbnail URL
    assert.ok(
      foundTMapped?.thumbnailUrl?.includes('/image/authenticated/'),
      'Must heal legacy upload thumbnail URL to authenticated URL'
    );

    // Test mappedOnly = true filter
    const mappedOnlyTemplates = await listTemplates({ ownerId: testOwner, mappedOnly: true });
    const mappedIds = mappedOnlyTemplates.map((t) => t._id.toString());
    assert.ok(mappedIds.includes(tMapped._id.toString()), 'Must include template with field mappings');
    assert.ok(!mappedIds.includes(tUnmapped._id.toString()), 'Must exclude template with empty field mappings');
    for (const t of mappedOnlyTemplates) {
      const ver = t.currentVersionId as any;
      assert.ok(ver && Array.isArray(ver.fieldMappings) && ver.fieldMappings.length > 0);
    }
    console.log('   ✓ listTemplates population, auto-healing, mappedOnly filtering, and owner isolation verified\n');

    // Test 15: getTemplate
    console.log('15. Testing getTemplate (retrieval, population, auto-healing, not-found & access guards)...');
    
    // 15a. Successful retrieval with populated currentVersionId
    const fetchedTemplate = await getTemplate({
      templateId: tMapped._id,
      ownerId: testOwner,
    });
    assert.strictEqual(fetchedTemplate._id.toString(), tMapped._id.toString());
    assert.strictEqual(fetchedTemplate.name, 'Mapped Certificate');
    assert.strictEqual((fetchedTemplate.currentVersionId as any).version, 1);
    assert.ok(fetchedTemplate.thumbnailUrl?.includes('/image/authenticated/'));

    // 15b. Throws TemplateNotFoundError on missing template ID
    await assert.rejects(
      async () => getTemplate({ templateId: new mongoose.Types.ObjectId(), ownerId: testOwner }),
      (err: any) => err instanceof TemplateNotFoundError && err.code === 'TEMPLATE_NOT_FOUND'
    );

    // 15c. Throws TemplateNotFoundError when accessed by another owner
    await assert.rejects(
      async () => getTemplate({ templateId: tMapped._id, ownerId: otherOwner }),
      (err: any) => err instanceof TemplateNotFoundError && err.code === 'TEMPLATE_NOT_FOUND'
    );

    console.log('   ✓ getTemplate retrieval, population, auto-healing, and access guards verified\n');

    // Test 16: deleteTemplate
    console.log('16. Testing deleteTemplate (permanent deletion, cascade confirmation, idempotency guards)...');
    
    // Seed template to delete
    const tToDelete = await Template.create({
      ownerId: testOwner,
      name: 'Temporary Template',
    });
    const vToDelete = await TemplateVersion.create({
      templateId: tToDelete._id,
      ownerId: testOwner,
      version: 1,
      sourceObjectKey: 'templates/owner/temp.pdf',
      bytes: 5120,
      pageCount: 1,
      status: 'active',
      fieldMappings: [],
      mappingHash: computeMappingHash([]),
    });
    tToDelete.currentVersionId = vToDelete._id;
    await tToDelete.save();

    // 16a. Permanent delete succeeds
    const deleteRes = await deleteTemplate({
      templateId: tToDelete._id,
      ownerId: testOwner,
    });
    assert.strictEqual(deleteRes.success, true);
    assert.strictEqual(deleteRes.message, 'Template deleted');

    // Verify Template and TemplateVersion are permanently removed from database
    const directDoc = await Template.findById(tToDelete._id);
    assert.strictEqual(directDoc, null, 'Template must be permanently removed');
    const versionDocs = await TemplateVersion.find({ templateId: tToDelete._id });
    assert.strictEqual(versionDocs.length, 0, 'Versions must be permanently removed');

    // 16b. Subsequent getTemplate throws TemplateNotFoundError
    await assert.rejects(
      async () => getTemplate({ templateId: tToDelete._id, ownerId: testOwner }),
      (err: any) => err instanceof TemplateNotFoundError
    );

    // 16c. Subsequent listTemplates excludes deleted template
    const listAfterDelete = await listTemplates({ ownerId: testOwner });
    const afterDeleteIds = listAfterDelete.map((t) => t._id.toString());
    assert.ok(!afterDeleteIds.includes(tToDelete._id.toString()), 'listTemplates must exclude deleted template');

    // 16d. Re-deleting already deleted template throws TemplateNotFoundError
    await assert.rejects(
      async () => deleteTemplate({ templateId: tToDelete._id, ownerId: testOwner }),
      (err: any) => err instanceof TemplateNotFoundError
    );

    // 16e. Deleting non-existent template throws TemplateNotFoundError
    await assert.rejects(
      async () => deleteTemplate({ templateId: new mongoose.Types.ObjectId(), ownerId: testOwner }),
      (err: any) => err instanceof TemplateNotFoundError
    );

    // 16f. Deleting another owner's template throws TemplateNotFoundError
    await assert.rejects(
      async () => deleteTemplate({ templateId: tOther._id, ownerId: testOwner }),
      (err: any) => err instanceof TemplateNotFoundError
    );

    // 16g. Deleting template with dependent batch in 'generating' status throws TemplateValidationError
    const tWithGenBatch = await Template.create({
      ownerId: testOwner,
      name: 'Template With Generating Batch',
    });
    const vWithGenBatch = await TemplateVersion.create({
      templateId: tWithGenBatch._id,
      ownerId: testOwner,
      version: 1,
      sourceObjectKey: 'templates/owner/gen.pdf',
      bytes: 1024,
      pageCount: 1,
      status: 'active',
      fieldMappings: [],
      mappingHash: computeMappingHash([]),
    });
    tWithGenBatch.currentVersionId = vWithGenBatch._id;
    await tWithGenBatch.save();

    const genBatch = await Batch.create({
      ownerId: testOwner,
      templateId: tWithGenBatch._id,
      templateVersionId: vWithGenBatch._id,
      name: 'Actively Generating Batch',
      status: 'generating',
      currentImportRevision: 0,
      totalRows: 10,
    });

    await assert.rejects(
      async () => deleteTemplate({ templateId: tWithGenBatch._id, ownerId: testOwner }),
      (err: any) => err instanceof TemplateValidationError && err.code === 'BATCH_GENERATING'
    );

    await assert.rejects(
      async () => deleteTemplate({ templateId: tWithGenBatch._id, ownerId: testOwner, confirmCascade: true }),
      (err: any) => err instanceof TemplateValidationError && err.code === 'BATCH_GENERATING'
    );

    // Verify template and batch are preserved
    assert.ok(await Template.findById(tWithGenBatch._id));
    assert.ok(await Batch.findById(genBatch._id));

    // Cleanup
    await Batch.deleteOne({ _id: genBatch._id });
    await TemplateVersion.deleteMany({ templateId: tWithGenBatch._id });
    await Template.deleteOne({ _id: tWithGenBatch._id });

    console.log('   ✓ deleteTemplate permanent deletion and guards verified\n');

    // Test 17: streamAsset
    console.log('17. Testing streamAsset (access guards, image probe, raw fallback, storage failure)...');
    
    // 17a. Access guards (missing template, missing version, wrong owner)
    await assert.rejects(
      async () => streamAsset({
        templateId: new mongoose.Types.ObjectId(),
        versionId: vMapped._id,
        ownerId: testOwner,
      }),
      (err: any) => err instanceof TemplateNotFoundError
    );

    await assert.rejects(
      async () => streamAsset({
        templateId: tMapped._id,
        versionId: new mongoose.Types.ObjectId(),
        ownerId: testOwner,
      }),
      (err: any) => err instanceof TemplateNotFoundError
    );

    await assert.rejects(
      async () => streamAsset({
        templateId: tMapped._id,
        versionId: vMapped._id,
        ownerId: otherOwner,
      }),
      (err: any) => err instanceof TemplateNotFoundError
    );

    // Mock global.fetch to verify dual-resource streaming behavior
    const originalFetch = global.fetch;
    try {
      // 17b. Attempts authenticated URL with 'image' resource type first
      let fetchCalls: string[] = [];
      const mockImageStream = { readable: true, type: 'image-stream' };
      global.fetch = (async (url: string) => {
        fetchCalls.push(url);
        return {
          ok: true,
          body: mockImageStream,
        };
      }) as any;

      const imageStreamRes = await streamAsset({
        templateId: tMapped._id,
        versionId: vMapped._id,
        ownerId: testOwner,
      });

      assert.strictEqual(imageStreamRes.body, mockImageStream);
      assert.strictEqual(imageStreamRes.filename, `template-v${vMapped.version}.pdf`);
      assert.strictEqual(imageStreamRes.versionNumber, vMapped.version);
      assert.strictEqual(fetchCalls.length, 1);
      assert.ok(fetchCalls[0].includes('image'), 'First attempt must use image resource type');

      // 17c. Falls back to 'raw' resource type when 'image' fails
      fetchCalls = [];
      const mockRawStream = { readable: true, type: 'raw-stream' };
      global.fetch = (async (url: string) => {
        fetchCalls.push(url);
        if (url.includes('image')) {
          return { ok: false, status: 404 };
        }
        return {
          ok: true,
          body: mockRawStream,
        };
      }) as any;

      const rawStreamRes = await streamAsset({
        templateId: tMapped._id,
        versionId: vMapped._id,
        ownerId: testOwner,
      });

      assert.strictEqual(rawStreamRes.body, mockRawStream);
      assert.strictEqual(rawStreamRes.filename, `template-v${vMapped.version}.pdf`);
      assert.strictEqual(rawStreamRes.versionNumber, vMapped.version);
      assert.strictEqual(fetchCalls.length, 2);
      assert.ok(fetchCalls[0].includes('image'), 'First attempt must use image');
      assert.ok(fetchCalls[1].includes('raw'), 'Fallback attempt must use raw');

      // 17d. Throws StorageAssetError when both 'image' and 'raw' fail
      fetchCalls = [];
      global.fetch = (async (url: string) => {
        fetchCalls.push(url);
        return { ok: false, status: 404 };
      }) as any;

      await assert.rejects(
        async () => streamAsset({
          templateId: tMapped._id,
          versionId: vMapped._id,
          ownerId: testOwner,
        }),
        (err: any) => err instanceof StorageAssetError && err.code === 'STORAGE_ASSET_FETCH_FAILED'
      );
      assert.strictEqual(fetchCalls.length, 2, 'Must have attempted image then raw before failing');

      // 17e. Streams directly via 'raw' when version.resourceType is raw
      const vRawAsset = await TemplateVersion.create({
        templateId: tMapped._id,
        ownerId: testOwner,
        version: 99,
        sourceObjectKey: 'templates/owner/raw_file.pdf',
        resourceType: 'raw',
        bytes: 1024,
        pageCount: 1,
        status: 'active',
        fieldMappings: [],
        mappingHash: computeMappingHash([]),
      });

      fetchCalls = [];
      global.fetch = (async (url: string) => {
        fetchCalls.push(url);
        return {
          ok: true,
          body: mockRawStream,
        };
      }) as any;

      const directRawRes = await streamAsset({
        templateId: tMapped._id,
        versionId: vRawAsset._id,
        ownerId: testOwner,
      });

      assert.strictEqual(directRawRes.body, mockRawStream);
      assert.strictEqual(fetchCalls.length, 1, 'Must only perform 1 fetch attempt directly to raw');
      assert.ok(fetchCalls[0].includes('raw'), 'Attempt must use raw resource type');
      assert.ok(!fetchCalls[0].includes('image'), 'Must not treat raw assets as images');
    } finally {
      global.fetch = originalFetch;
    }
    console.log('   ✓ streamAsset access guards, image delivery, raw fallback, and storage errors verified\n');

    console.log('🎉 ALL TEMPLATE LIFECYCLE SLICE 1, SLICE 2 & SLICE 3 TESTS PASSED SUCCESSFULLY!');
  } finally {
    // Teardown
    console.log('\n🧹 Cleaning up test fixtures...');
    const ownersToClean = [testOwner, otherOwner, quotaOwner, concurrentOwner].filter(
      (o): o is string => Boolean(o)
    );
    await Template.deleteMany({ ownerId: { $in: ownersToClean } });
    await TemplateVersion.deleteMany({ ownerId: { $in: ownersToClean } });
    await mongoose.disconnect();
    console.log('   ✓ Cleaned up test data and disconnected from database');
  }
}

runTests().catch((err) => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
