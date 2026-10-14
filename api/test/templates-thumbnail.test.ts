import assert from 'assert';
import { generateThumbnailUrl, repairThumbnailUrl } from '../src/controllers/templates.controller';

async function runTests() {
  console.log('--- RUNNING TEMPLATE THUMBNAIL UNIT TESTS ---');

  // Test 1: generateThumbnailUrl with clean public_id
  console.log('1. Testing generateThumbnailUrl with clean public ID...');
  const publicId = 'templates/user_123/cert_layout';
  const url = generateThumbnailUrl(publicId);
  assert.ok(url.includes('/image/authenticated/'), 'URL must use authenticated delivery path');
  assert.ok(url.includes('pg_1'), 'URL must specify page 1');
  assert.ok(url.includes('.png'), 'URL must specify png format');
  assert.ok(url.includes('s--'), 'URL must include Cloudinary signature');
  assert.ok(url.includes(publicId), 'URL must contain the publicId');
  console.log('   ✓ generateThumbnailUrl authenticated signed URL verified');

  // Test 2: generateThumbnailUrl stripping .pdf extension
  console.log('2. Testing generateThumbnailUrl stripping .pdf extension...');
  const publicIdWithExt = 'templates/user_123/cert_layout.pdf';
  const urlWithExt = generateThumbnailUrl(publicIdWithExt);
  assert.ok(!urlWithExt.includes('.pdf.png'), 'URL must not contain double extension .pdf.png');
  assert.ok(urlWithExt.endsWith('.png') || urlWithExt.includes('.png?'), 'URL must end with .png');
  assert.strictEqual(url, urlWithExt, 'Generated URLs must match whether extension is present or stripped');
  console.log('   ✓ Extension stripping verified');

  // Test 3: repairThumbnailUrl with legacy /image/upload/ URLs
  console.log('3. Testing repairThumbnailUrl with legacy /image/upload/...');
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
    'Legacy URL without publicId must be preserved unchanged to avoid unsigned authenticated URLs'
  );

  const preservedRaw = repairThumbnailUrl(legacyUrl, 'templates/user_1/sample', 'raw');
  assert.strictEqual(
    preservedRaw,
    legacyUrl,
    'Legacy URL for raw resource must be preserved unchanged'
  );
  console.log('   ✓ Legacy URL regeneration and preservation verified');

  // Test 4: repairThumbnailUrl preserving already authenticated URL
  console.log('4. Testing repairThumbnailUrl preserving valid authenticated URL...');
  const validAuthUrl = 'https://res.cloudinary.com/demo/image/authenticated/s--abc12345--/c_fill,h_450,pg_1,w_600/v1/templates/user_1/sample.png';
  assert.strictEqual(repairThumbnailUrl(validAuthUrl), validAuthUrl, 'Valid authenticated URL must remain unchanged');
  console.log('   ✓ Valid authenticated URL preservation verified');

  // Test 5: repairThumbnailUrl regenerating missing URL from sourceObjectKey
  console.log('5. Testing repairThumbnailUrl regenerating missing URL...');
  const regenerated = repairThumbnailUrl(null, 'templates/user_99/award');
  assert.ok(regenerated?.includes('/image/authenticated/'), 'Regenerated URL must use authenticated delivery');
  assert.ok(regenerated?.includes('templates/user_99/award'), 'Regenerated URL must contain public ID');
  console.log('   ✓ Missing URL regeneration verified');

  console.log('\nALL TEMPLATE THUMBNAIL UNIT TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
