import assert from 'node:assert';
import mongoose from 'mongoose';
import { Batch } from '../api/models/Batch.js';
import { BatchImport } from '../api/models/BatchImport.js';
import { DraftRow } from '../api/models/DraftRow.js';

async function runTests() {
  console.log('🧪 Starting Batch domain models unit test suite...');

  // 1. Batch model defaults & validation
  {
    console.log('Test 1: Batch default values and required field validation');
    const ownerId = 'user_test_123';
    const templateId = new mongoose.Types.ObjectId();
    const templateVersionId = new mongoose.Types.ObjectId();

    const batch = new Batch({
      ownerId,
      templateId,
      templateVersionId,
      name: 'Spring 2026 Batch',
    });

    const validationError = batch.validateSync();
    assert.strictEqual(validationError, undefined, 'Batch with valid fields should validate without error');
    assert.strictEqual(batch.status, 'draft', 'status should default to draft');
    assert.strictEqual(batch.currentImportRevision, 0, 'currentImportRevision should default to 0');
    assert.strictEqual(batch.retentionHours, 168, 'retentionHours should default to 168');
    assert.strictEqual(batch.totalRows, 0, 'totalRows should default to 0');
    assert.strictEqual(batch.validRows, 0, 'validRows should default to 0');
    assert.strictEqual(batch.invalidRows, 0, 'invalidRows should default to 0');
    assert.strictEqual(batch.duplicateRows, 0, 'duplicateRows should default to 0');
    assert.strictEqual(batch.version, 1, 'version should default to 1');

    // Missing required fields
    const invalidBatch = new Batch({});
    const invErr = invalidBatch.validateSync();
    assert.ok(invErr, 'Batch without required fields should fail validation');
    assert.ok(invErr.errors.ownerId, 'ownerId is required');
    assert.ok(invErr.errors.templateId, 'templateId is required');
    assert.ok(invErr.errors.templateVersionId, 'templateVersionId is required');
    assert.ok(invErr.errors.name, 'name is required');

    // Check indexes
    const indexes = Batch.schema.indexes();
    const hasOwnerIdx = indexes.some(
      ([idx]: [any, any]) => idx.ownerId === 1 && idx.createdAt === -1
    );
    const hasTemplateIdx = indexes.some(
      ([idx]: [any, any]) => idx.templateId === 1 && idx.createdAt === -1
    );
    assert.ok(hasOwnerIdx, 'Batch schema should have { ownerId: 1, createdAt: -1 } index');
    assert.ok(hasTemplateIdx, 'Batch schema should have { templateId: 1, createdAt: -1 } index');
    console.log('  ✓ Batch defaults and indexes verified');
  }

  // 2. BatchImport model defaults & validation
  {
    console.log('Test 2: BatchImport schema validation and indexes');
    const batchId = new mongoose.Types.ObjectId();
    const batchImport = new BatchImport({
      batchId,
      ownerId: 'user_test_123',
      revision: 1,
      sourceFileName: 'students.csv',
      sourceFileSize: 2048,
    });

    const valErr = batchImport.validateSync();
    assert.strictEqual(valErr, undefined, 'BatchImport with valid fields should validate');
    assert.strictEqual(batchImport.status, 'pending', 'status should default to pending');
    assert.strictEqual(batchImport.totalExpectedRows, 0);
    assert.strictEqual(batchImport.totalExpectedChunks, 0);
    assert.deepStrictEqual(batchImport.receivedChunkIds, []);
    assert.deepStrictEqual(batchImport.rawHeaders, []);
    assert.deepStrictEqual(batchImport.disambiguatedHeaders, []);

    // Missing required fields
    const invalidImport = new BatchImport({});
    const invErr = invalidImport.validateSync();
    assert.ok(invErr, 'BatchImport missing required fields should fail');
    assert.ok(invErr.errors.batchId, 'batchId is required');
    assert.ok(invErr.errors.ownerId, 'ownerId is required');
    assert.ok(invErr.errors.revision, 'revision is required');
    assert.ok(invErr.errors.sourceFileName, 'sourceFileName is required');
    assert.ok(invErr.errors.sourceFileSize, 'sourceFileSize is required');

    // Indexes
    const indexes = BatchImport.schema.indexes();
    const hasCompoundUnique = indexes.some(
      ([idx, opt]: [any, any]) => idx.batchId === 1 && idx.revision === 1 && opt?.unique === true
    );
    const hasOwnerIdx = indexes.some(
      ([idx]: [any, any]) => idx.ownerId === 1 && idx.createdAt === -1
    );
    assert.ok(hasCompoundUnique, 'BatchImport must have compound unique index on { batchId: 1, revision: 1 }');
    assert.ok(hasOwnerIdx, 'BatchImport must have index on { ownerId: 1, createdAt: -1 }');
    console.log('  ✓ BatchImport schema and compound unique index verified');
  }

  // 3. DraftRow model validation and indexes
  {
    console.log('Test 3: DraftRow validation, required fields, and compound unique index');
    const batchId = new mongoose.Types.ObjectId();
    const importId = new mongoose.Types.ObjectId();

    const draftRow = new DraftRow({
      batchId,
      importId,
      ownerId: 'user_test_123',
      revision: 1,
      rowKey: 'row_1',
      sourceRowNumber: 2,
      importedData: { 'Full Name': 'Jane Doe' },
      effectiveData: { studentName: 'Jane Doe' },
    });

    const valErr = draftRow.validateSync();
    assert.strictEqual(valErr, undefined, 'DraftRow with valid fields should validate');
    assert.strictEqual(draftRow.status, 'valid');
    assert.strictEqual(draftRow.isDuplicate, false);
    assert.strictEqual(draftRow.version, 1);
    assert.deepStrictEqual(draftRow.errors, []);
    assert.deepStrictEqual(draftRow.warnings, []);
    assert.deepStrictEqual(draftRow.duplicateReferences, []);

    // Missing required fields
    const invalidRow = new DraftRow({
      batchId,
      importId,
      ownerId: 'user_test_123',
      revision: 1,
    });
    const invErr = invalidRow.validateSync();
    assert.ok(invErr, 'DraftRow missing rowKey and sourceRowNumber should fail');
    assert.ok(invErr.errors.rowKey, 'rowKey is required');
    assert.ok(invErr.errors.sourceRowNumber, 'sourceRowNumber is required');

    // Check indexes
    const indexes = DraftRow.schema.indexes();
    const hasCompoundUnique = indexes.some(
      ([idx, opt]: [any, any]) => idx.importId === 1 && idx.rowKey === 1 && opt?.unique === true
    );
    const hasBatchRevisionRowIdx = indexes.some(
      ([idx]: [any, any]) => idx.batchId === 1 && idx.revision === 1 && idx.sourceRowNumber === 1
    );
    const hasStatusIdx = indexes.some(
      ([idx]: [any, any]) => idx.batchId === 1 && idx.revision === 1 && idx.status === 1
    );
    assert.ok(hasCompoundUnique, 'DraftRow must have compound unique index on { importId: 1, rowKey: 1 }');
    assert.ok(hasBatchRevisionRowIdx, 'DraftRow must have index on { batchId: 1, revision: 1, sourceRowNumber: 1 }');
    assert.ok(hasStatusIdx, 'DraftRow must have index on { batchId: 1, revision: 1, status: 1 }');
    console.log('  ✓ DraftRow required fields and compound unique indexes verified');
  }

  // 4. DraftRow errors and warnings storage
  {
    console.log('Test 4: DraftRow errors & warnings schema validation with referenceRowNumbers');
    const batchId = new mongoose.Types.ObjectId();
    const importId = new mongoose.Types.ObjectId();

    const rowWithIssues = new DraftRow({
      batchId,
      importId,
      ownerId: 'user_test_123',
      revision: 1,
      rowKey: 'row_10',
      sourceRowNumber: 11,
      status: 'invalid',
      errors: [
        {
          field: 'gradDate',
          code: 'REQUIRED_FIELD_MISSING',
          message: 'Field gradDate is required but empty',
        },
        {
          field: 'gpa',
          code: 'INVALID_NUMBER',
          message: 'Value "abc" cannot be parsed as number',
        },
      ],
      warnings: [
        {
          field: 'studentId',
          code: 'DUPLICATE_ROW',
          message: 'Duplicate value matches row 2 and 5',
          referenceRowNumbers: [2, 5],
        },
      ],
      isDuplicate: true,
      duplicateReferences: [2, 5],
    });

    const valErr = rowWithIssues.validateSync();
    assert.strictEqual(valErr, undefined, 'DraftRow with errors and warnings should validate');
    assert.strictEqual(rowWithIssues.errors.length, 2);
    assert.strictEqual(rowWithIssues.errors[0].code, 'REQUIRED_FIELD_MISSING');
    assert.strictEqual(rowWithIssues.warnings.length, 1);
    assert.strictEqual(rowWithIssues.warnings[0].code, 'DUPLICATE_ROW');
    assert.deepStrictEqual(rowWithIssues.warnings[0].referenceRowNumbers, [2, 5]);

    // Subdocument error validation failure test
    const rowWithBadError = new DraftRow({
      batchId,
      importId,
      ownerId: 'user_test_123',
      revision: 1,
      rowKey: 'row_11',
      sourceRowNumber: 12,
      errors: [
        {} as any,
      ],
    });
    const badErrVal = rowWithBadError.validateSync();
    assert.ok(badErrVal, 'Subdocument error must require field, code, message');
    assert.ok(badErrVal.errors['errors.0.field'], 'errors.0.field is required');
    assert.ok(badErrVal.errors['errors.0.code'], 'errors.0.code is required');
    assert.ok(badErrVal.errors['errors.0.message'], 'errors.0.message is required');

    console.log('  ✓ DraftRow errors and warnings with referenceRowNumbers verified');
  }

  console.log('\n🎉 ALL TESTS PASSED! Slice 1 domain models are 100% verified.');
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
