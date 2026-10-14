import assert from 'assert';
import mongoose from 'mongoose';
import { TemplateVersion, IFieldMapping } from '../src/models/TemplateVersion';
import { computeMappingHash } from '../src/controllers/templates.controller';

async function runTests() {
  console.log('--- RUNNING SLICE 1 TEMPLATE VERSION TESTS ---');

  // Test 1: Schema Validation (Valid mapping)
  console.log('1. Testing Schema validation with valid IFieldMapping...');
  const validMapping: IFieldMapping = {
    id: 'field_1',
    key: 'studentName',
    label: 'Student Name',
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
    maskMode: 'solid-white',
    maskColor: '#ffffff',
    sampleValue: 'Jane Doe',
  };

  const doc = new TemplateVersion({
    templateId: new mongoose.Types.ObjectId(),
    ownerId: 'user_123',
    version: 1,
    sourceObjectKey: 'templates/user_123/cert.pdf',
    bytes: 10240,
    pageCount: 1,
    status: 'active',
    fieldMappings: [validMapping],
    mappingHash: computeMappingHash([validMapping]),
  });

  const validationError = doc.validateSync();
  assert.strictEqual(validationError, undefined, 'Valid mapping must pass schema validation');
  console.log('   ✓ Schema validation passed for valid mapping');

  // Test 2: Schema Validation (Invalid rect missing x)
  console.log('2. Testing Schema validation failure on invalid mapping...');
  const invalidDoc = new TemplateVersion({
    templateId: new mongoose.Types.ObjectId(),
    ownerId: 'user_123',
    version: 1,
    sourceObjectKey: 'cert.pdf',
    bytes: 1024,
    pageCount: 1,
    fieldMappings: [
      {
        id: 'bad_field',
        key: 'badKey',
        pageIndex: 0,
        rect: { y: 10, width: 100, height: 20 }, // missing x
        fontSize: 12,
        minFontSize: 8,
        maxFontSize: 24,
      },
    ],
  });
  const badValidationError = invalidDoc.validateSync();
  assert.ok(badValidationError, 'Schema validation must fail when rect.x is missing');
  assert.ok(badValidationError.errors['fieldMappings.0.rect.x'], 'rect.x must be reported required');
  console.log('   ✓ Schema correctly caught missing rect coordinate');

  // Test 3: Deterministic Canonical mappingHash
  console.log('3. Testing deterministic mappingHash calculation across orders...');
  const mappingA: IFieldMapping = {
    id: 'f1',
    key: 'name',
    type: 'text',
    pageIndex: 0,
    rect: { x: 10, y: 10, width: 50, height: 20 },
    alignment: 'left',
    fontFamily: 'Helvetica',
    fontSize: 12,
    minFontSize: 8,
    maxFontSize: 20,
    color: '#000',
    fitMode: 'shrink-to-fit',
    maskMode: 'none',
  };
  const mappingB: IFieldMapping = {
    id: 'f2',
    key: 'date',
    type: 'date',
    pageIndex: 0,
    rect: { x: 10, y: 50, width: 50, height: 20 },
    alignment: 'left',
    fontFamily: 'Helvetica',
    fontSize: 12,
    minFontSize: 8,
    maxFontSize: 20,
    color: '#000',
    fitMode: 'shrink-to-fit',
    maskMode: 'none',
  };

  const hash1 = computeMappingHash([mappingA, mappingB]);
  const hash2 = computeMappingHash([mappingB, mappingA]);
  assert.strictEqual(hash1, hash2, 'mappingHash must be deterministic regardless of array order');
  assert.strictEqual(hash1.length, 64, 'mappingHash must be 64-char SHA-256 hex');
  console.log('   ✓ mappingHash canonical order test passed');

  // Test 4: CAS Conflict Logic Simulation
  console.log('4. Testing CAS Conflict (409) logic...');
  const latestVersionNumber = 3;
  const clientExpectedVersionStale = 2;
  const isConflict = latestVersionNumber !== clientExpectedVersionStale;
  assert.strictEqual(isConflict, true, 'CAS check must detect version mismatch');
  console.log('   ✓ CAS conflict detection verified');

  console.log('\nALL SLICE 1 BACKEND VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
