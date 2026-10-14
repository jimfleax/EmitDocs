import 'dotenv/config';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { Template } from '../src/models/Template.js';
import { TemplateVersion } from '../src/models/TemplateVersion.js';
import {
  formatBytes,
  calculateUserStorage,
  getUserStorage,
} from '../src/controllers/storage.controller.js';

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

async function runTests() {
  console.log('🧪 Starting storage-api controller and calculation test suite...\n');

  // Test 1: formatBytes utility function
  console.log('1. Testing formatBytes utility function...');
  assert.strictEqual(formatBytes(0), '0 B');
  assert.strictEqual(formatBytes(-10), '0 B');
  assert.strictEqual(formatBytes(NaN), '0 B');
  assert.strictEqual(formatBytes(512), '512 B');
  assert.strictEqual(formatBytes(1024), '1 KB');
  assert.strictEqual(formatBytes(1536), '1.5 KB');
  assert.strictEqual(formatBytes(1024 * 1024), '1 MB');
  assert.strictEqual(formatBytes(14.2 * 1024 * 1024), '14.2 MB');
  console.log('   ✓ formatBytes formats byte values accurately across units\n');

  // Test 2: Unauthorized request handling
  console.log('2. Testing getUserStorage without authentication...');
  const unauthCtx = createMockContext({ user: null });
  await getUserStorage(unauthCtx as any);
  const unauthRes = unauthCtx._getResponse();
  assert.strictEqual(unauthRes.status, 401);
  assert.strictEqual(unauthRes.data.error, 'Unauthorized');
  console.log('   ✓ Rejects unauthenticated requests with 401 Unauthorized\n');

  // Setup Database connection for storage calculation tests
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { dbName: 'emitdocs_test' });
  console.log('   ✓ Connected to test database\n');

  const testUserId = `storage_test_user_${Date.now()}`;
  const mockUser = { id: testUserId, email: 'storagetest@example.com' };

  // Test 3: Storage calculation for new user with no documents
  console.log('3. Testing storage calculation for user with 0 documents...');
  const emptyStorage = await calculateUserStorage(testUserId);
  assert.strictEqual(emptyStorage.success, true);
  assert.strictEqual(emptyStorage.totalBytes, 0);
  assert.strictEqual(emptyStorage.formattedTotal, '0 B');
  assert.strictEqual(emptyStorage.documentCount, 0);
  assert.strictEqual(emptyStorage.documents.length, 0);
  console.log('   ✓ Returns 0 bytes and empty document list for new users\n');

  // Test 4: Seed templates and test database calculation and correlation
  console.log('4. Testing storage calculation with seeded templates and versions...');
  const template1 = await Template.create({
    ownerId: testUserId,
    name: 'Certificate of Excellence',
    thumbnailUrl: 'https://example.com/thumb1.png',
  });

  await TemplateVersion.create({
    templateId: template1._id,
    ownerId: testUserId,
    version: 1,
    sourceObjectKey: `templates/${testUserId}/cert_v1`,
    bytes: 1048576, // 1 MB
    pageCount: 1,
    status: 'active',
  });

  await TemplateVersion.create({
    templateId: template1._id,
    ownerId: testUserId,
    version: 2,
    sourceObjectKey: `templates/${testUserId}/cert_v2`,
    bytes: 2097152, // 2 MB
    pageCount: 1,
    status: 'active',
  });

  // Second template
  const template2 = await Template.create({
    ownerId: testUserId,
    name: 'Archived Diploma',
    thumbnailUrl: null,
  });

  await TemplateVersion.create({
    templateId: template2._id,
    ownerId: testUserId,
    version: 1,
    sourceObjectKey: `templates/${testUserId}/diploma_v1`,
    bytes: 524288, // 512 KB
    pageCount: 2,
    status: 'active',
  });

  const storageWithDocs = await calculateUserStorage(testUserId);
  assert.strictEqual(storageWithDocs.success, true);
  assert.strictEqual(storageWithDocs.documentCount, 3);
  assert.strictEqual(storageWithDocs.totalBytes, 1048576 + 2097152 + 524288); // 3.5 MB
  assert.strictEqual(storageWithDocs.formattedTotal, '3.5 MB');

  // Verify document properties
  const doc3 = storageWithDocs.documents.find((d) => d.id === `templates/${testUserId}/diploma_v1`);
  assert(doc3, 'Expected to find diploma_v1 in documents');
  assert.strictEqual(doc3.name, 'Archived Diploma');
  assert.strictEqual(doc3.bytes, 524288);
  assert.strictEqual(doc3.formattedSize, '512 KB');

  const doc1 = storageWithDocs.documents.find((d) => d.id === `templates/${testUserId}/cert_v1`);
  assert(doc1, 'Expected to find cert_v1 in documents');

  console.log('   ✓ Correctly sums totalBytes (3.5 MB) and parses document names\n');

  // Test 5: Controller integration through mock context
  console.log('5. Testing getUserStorage controller execution...');
  const ctrlCtx = createMockContext({ user: mockUser });
  await getUserStorage(ctrlCtx as any);
  const ctrlRes = ctrlCtx._getResponse();
  assert.strictEqual(ctrlRes.status, 200);
  assert.strictEqual(ctrlRes.data.success, true);
  assert.strictEqual(ctrlRes.data.documentCount, 3);
  assert.strictEqual(ctrlRes.data.formattedTotal, '3.5 MB');
  console.log('   ✓ Controller returns 200 OK with expected UserStorageSummary payload\n');

  // Cleanup test fixtures
  await Template.deleteMany({ ownerId: testUserId });
  await TemplateVersion.deleteMany({ ownerId: testUserId });
  await mongoose.disconnect();
  console.log('   ✓ Cleaned up test fixtures and disconnected from database\n');

  console.log('🎉 ALL STORAGE API VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
