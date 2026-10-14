import 'dotenv/config';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { Batch } from '../src/models/Batch.js';
import { BatchImport } from '../src/models/BatchImport.js';
import { DraftRow } from '../src/models/DraftRow.js';
import { Template } from '../src/models/Template.js';
import { TemplateVersion, IFieldMapping } from '../src/models/TemplateVersion.js';
import {
  BatchIntake,
  BatchNotFoundError,
  ConcurrencyConflictError,
  ChunkMismatchError,
  BatchIntakeValidationError,
} from '../src/services/batch-intake.js';

async function runTests() {
  console.log('🧪 Starting BatchIntake Slice 1 (ingestChunk & finalizeImport) test suite...\n');

  // Test 1: Verify Typed Error Classes
  console.log('1. Testing typed domain error classes...');
  const notFoundErr = new BatchNotFoundError('Test not found');
  assert.strictEqual(notFoundErr instanceof Error, true);
  assert.strictEqual(notFoundErr.name, 'BatchNotFoundError');
  assert.strictEqual(notFoundErr.code, 'BATCH_NOT_FOUND');

  const conflictErr = new ConcurrencyConflictError('Stale revision', 'STALE_REVISION');
  assert.strictEqual(conflictErr instanceof Error, true);
  assert.strictEqual(conflictErr.name, 'ConcurrencyConflictError');
  assert.strictEqual(conflictErr.code, 'STALE_REVISION');

  const chunkErr = new ChunkMismatchError('Chunk missing', 'IMPORT_CHUNK_MISMATCH');
  assert.strictEqual(chunkErr instanceof Error, true);
  assert.strictEqual(chunkErr.name, 'ChunkMismatchError');
  assert.strictEqual(chunkErr.code, 'IMPORT_CHUNK_MISMATCH');

  const validationErr = new BatchIntakeValidationError('Invalid rows', 'INVALID_ROWS');
  assert.strictEqual(validationErr instanceof Error, true);
  assert.strictEqual(validationErr.name, 'BatchIntakeValidationError');
  assert.strictEqual(validationErr.code, 'INVALID_ROWS');
  console.log('   ✓ Typed error classes verified\n');

  // Database Connection
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { dbName: 'emitdocs_test' });
  console.log('   ✓ Connected to test database\n');

  const testUserId = `test_owner_${Date.now()}`;

  // Test 2: Input Validation Failures
  console.log('2. Testing input validation guardrails...');
  await assert.rejects(
    async () => {
      await BatchIntake.ingestChunk({
        batchId: new mongoose.Types.ObjectId(),
        importId: new mongoose.Types.ObjectId(),
        ownerId: testUserId,
        chunkId: '',
        rows: [],
      });
    },
    (err: any) => err instanceof BatchIntakeValidationError && err.code === 'INVALID_CHUNK_ID'
  );

  await assert.rejects(
    async () => {
      await BatchIntake.ingestChunk({
        batchId: new mongoose.Types.ObjectId(),
        importId: new mongoose.Types.ObjectId(),
        ownerId: testUserId,
        chunkId: 'chunk_1',
        rows: null as any,
      });
    },
    (err: any) => err instanceof BatchIntakeValidationError && err.code === 'INVALID_ROWS'
  );

  await assert.rejects(
    async () => {
      await BatchIntake.ingestChunk({
        batchId: new mongoose.Types.ObjectId(),
        importId: new mongoose.Types.ObjectId(),
        ownerId: testUserId,
        chunkId: 'chunk_1',
        rows: [],
      });
    },
    (err: any) => err instanceof BatchNotFoundError
  );
  console.log('   ✓ Input and entity presence validation verified\n');

  // Seed Template and TemplateVersion
  console.log('3. Seeding Template, TemplateVersion, Batch, and BatchImport...');
  const template = await Template.create({
    ownerId: testUserId,
    name: 'Graduation Diploma',
  });

  const fieldMappings: IFieldMapping[] = [
    {
      id: 'f1',
      key: 'studentName',
      label: 'Student Name',
      required: true,
      type: 'text',
      pageIndex: 0,
      rect: { x: 100, y: 200, width: 300, height: 40 },
      alignment: 'center',
      fontFamily: 'Helvetica',
      fontSize: 16,
      minFontSize: 10,
      maxFontSize: 24,
      color: '#000000',
      fitMode: 'shrink-to-fit',
      maskMode: 'none',
    },
    {
      id: 'f2',
      key: 'graduationDate',
      label: 'Graduation Date',
      required: true,
      type: 'date',
      pageIndex: 0,
      rect: { x: 100, y: 300, width: 200, height: 30 },
      alignment: 'left',
      fontFamily: 'Helvetica',
      fontSize: 12,
      minFontSize: 8,
      maxFontSize: 16,
      color: '#333333',
      fitMode: 'shrink-to-fit',
      maskMode: 'none',
    },
    {
      id: 'f3',
      key: 'gpa',
      label: 'GPA',
      required: false,
      type: 'number',
      pageIndex: 0,
      rect: { x: 100, y: 350, width: 100, height: 30 },
      alignment: 'left',
      fontFamily: 'Helvetica',
      fontSize: 12,
      minFontSize: 8,
      maxFontSize: 16,
      color: '#333333',
      fitMode: 'shrink-to-fit',
      maskMode: 'none',
    },
  ];

  const templateVersion = await TemplateVersion.create({
    templateId: template._id,
    ownerId: testUserId,
    version: 1,
    sourceObjectKey: 'templates/diploma.pdf',
    bytes: 20480,
    pageCount: 1,
    status: 'active',
    fieldMappings,
    mappingHash: 'test_hash_123',
  });

  const batch = await Batch.create({
    ownerId: testUserId,
    templateId: template._id,
    templateVersionId: templateVersion._id,
    name: 'Spring 2026 Batch',
    status: 'importing',
    currentImportRevision: 1,
  });

  const batchImport = await BatchImport.create({
    batchId: batch._id,
    ownerId: testUserId,
    revision: 1,
    sourceFileName: 'students.xlsx',
    sourceFileSize: 10240,
    columnMap: {
      studentName: 'Full Name',
      graduationDate: 'Grad Date',
      gpa: 'Score',
    },
    status: 'uploading',
  });
  console.log('   ✓ Test fixtures initialized\n');

  // Test 4: Ingest Chunk with Row Validation
  console.log('4. Testing ingestChunk (row validation against fieldMappings & DraftRow upsert)...');
  const chunk1Rows = [
    {
      sourceRowNumber: 1,
      rowKey: 'row_1',
      importedData: {
        'Full Name': 'Alice Walker',
        'Grad Date': '2026-05-15',
        Score: '3.95',
      },
    },
    {
      sourceRowNumber: 2,
      rowKey: 'row_2',
      importedData: {
        'Full Name': '', // Required field missing!
        'Grad Date': 'invalid-date', // Invalid date format!
        Score: '4.0',
      },
    },
  ];

  const chunk1Res = await BatchIntake.ingestChunk({
    batchId: batch._id,
    importId: batchImport._id,
    ownerId: testUserId,
    chunkId: 'chunk_alpha',
    totalChunks: 2,
    rows: chunk1Rows,
  });

  assert.strictEqual(chunk1Res.chunkId, 'chunk_alpha');
  assert.strictEqual(chunk1Res.processed, 2);
  assert.strictEqual(chunk1Res.idempotent, false);

  // Inspect persisted DraftRow documents
  const row1 = await DraftRow.findOne({ importId: batchImport._id, rowKey: 'row_1' });
  assert.ok(row1, 'Row 1 must be persisted');
  assert.strictEqual(row1.status, 'valid');
  assert.strictEqual(row1.effectiveData.studentName, 'Alice Walker');
  assert.strictEqual(row1.effectiveData.graduationDate, '2026-05-15');
  assert.strictEqual(row1.effectiveData.gpa, 3.95);
  assert.strictEqual(row1.errors.length, 0);

  const row2 = await DraftRow.findOne({ importId: batchImport._id, rowKey: 'row_2' });
  assert.ok(row2, 'Row 2 must be persisted');
  assert.strictEqual(row2.status, 'invalid');
  assert.ok(row2.errors.length >= 2, 'Row 2 must have multiple errors');
  const errorFields = row2.errors.map((e: any) => e.field);
  assert.ok(errorFields.includes('studentName'));
  assert.ok(errorFields.includes('graduationDate'));
  console.log('   ✓ ingestChunk successfully validated and upserted valid and invalid rows\n');

  // Test 5: Idempotency
  console.log('5. Testing idempotent chunk skipping...');
  const chunk1Replay = await BatchIntake.ingestChunk({
    batchId: batch._id,
    importId: batchImport._id,
    ownerId: testUserId,
    chunkId: 'chunk_alpha',
    rows: chunk1Rows,
  });

  assert.strictEqual(chunk1Replay.idempotent, true);
  assert.strictEqual(chunk1Replay.processed, 2);

  const totalDraftRowsAfterReplay = await DraftRow.countDocuments({ importId: batchImport._id });
  assert.strictEqual(totalDraftRowsAfterReplay, 2, 'Replay must not duplicate DraftRows');

  const importDocAfterReplay = await BatchImport.findById(batchImport._id);
  assert.strictEqual(
    importDocAfterReplay.receivedChunkIds.filter((c: string) => c === 'chunk_alpha').length,
    1,
    'receivedChunkIds must only contain chunk_alpha once'
  );
  console.log('   ✓ Idempotency guarantees verified\n');

  // Test 6: Finalize Import Mismatch Guards
  console.log('6. Testing finalizeImport chunk and row mismatch guards...');
  // Mismatch chunks (expected 2 chunks, only 1 received)
  await assert.rejects(
    async () => {
      await BatchIntake.finalizeImport({
        batchId: batch._id,
        importId: batchImport._id,
        ownerId: testUserId,
        totalExpectedChunks: 2,
      });
    },
    (err: any) => err instanceof ChunkMismatchError && err.code === 'IMPORT_CHUNK_MISMATCH'
  );

  // Mismatch rows (expected 5 rows, only 2 persisted)
  await assert.rejects(
    async () => {
      await BatchIntake.finalizeImport({
        batchId: batch._id,
        importId: batchImport._id,
        ownerId: testUserId,
        totalExpectedChunks: 1,
        totalExpectedRows: 5,
      });
    },
    (err: any) => err instanceof ChunkMismatchError && err.code === 'IMPORT_CHUNK_MISMATCH'
  );
  console.log('   ✓ Chunk and row mismatch guards verified\n');

  // Test 7: Duplicate Detection Across Rows & Authoritative Counters
  console.log('7. Ingesting Chunk 2 with a duplicate row and finalizing import...');
  const chunk2Rows = [
    {
      sourceRowNumber: 3,
      rowKey: 'row_3',
      importedData: {
        'Full Name': 'Alice Walker', // Duplicate of Row 1!
        'Grad Date': '2026-05-15',
        Score: '3.95',
      },
    },
  ];

  await BatchIntake.ingestChunk({
    batchId: batch._id,
    importId: batchImport._id,
    ownerId: testUserId,
    chunkId: 'chunk_beta',
    totalChunks: 2,
    rows: chunk2Rows,
  });

  const finalizeRes = await BatchIntake.finalizeImport({
    batchId: batch._id,
    importId: batchImport._id,
    ownerId: testUserId,
    totalExpectedChunks: 2,
    totalExpectedRows: 3,
  });

  // Verify counters and status
  assert.strictEqual(finalizeRes.summary.totalRows, 3);
  assert.strictEqual(finalizeRes.summary.validRows, 2); // Row 1 and Row 3 have valid data
  assert.strictEqual(finalizeRes.summary.invalidRows, 1); // Row 2 has validation errors
  assert.strictEqual(finalizeRes.summary.duplicateRows, 1); // Row 3 is duplicate of Row 1

  // Verify Duplicate Flags on Row 3
  const row3 = await DraftRow.findOne({ importId: batchImport._id, rowKey: 'row_3' });
  assert.ok(row3);
  assert.strictEqual(row3.isDuplicate, true);
  assert.deepStrictEqual(row3.duplicateReferences, [1]);
  assert.ok(row3.warnings.some((w: any) => w.code === 'DUPLICATE_ROW'));

  // Verify Batch and BatchImport status transitions
  const finalBatch = await Batch.findById(batch._id);
  assert.strictEqual(finalBatch.status, 'review');
  assert.strictEqual(finalBatch.totalRows, 3);
  assert.strictEqual(finalBatch.validRows, 2);
  assert.strictEqual(finalBatch.invalidRows, 1);
  assert.strictEqual(finalBatch.duplicateRows, 1);
  assert.strictEqual(finalBatch.currentImportRevision, 1);

  const finalImport = await BatchImport.findById(batchImport._id);
  assert.strictEqual(finalImport.status, 'completed');
  assert.strictEqual(finalImport.rowCount, 3);
  assert.strictEqual(finalImport.validCount, 2);
  assert.strictEqual(finalImport.invalidCount, 1);
  assert.strictEqual(finalImport.duplicateCount, 1);
  console.log('   ✓ Duplicate detection and authoritative counter rollup verified\n');

  // 7b. Verify duplicateChecked persistence clears stale duplicate status when rows are no longer duplicates
  await DraftRow.updateOne(
    { _id: row3._id },
    {
      $set: {
        importedData: {
          'Full Name': 'Zoe Unique',
          'Grad Date': '2026-07-01',
          GPA: '3.90',
        },
      },
    }
  );
  await BatchIntake.finalizeImport({
    batchId: batch._id,
    importId: batchImport._id,
    ownerId: testUserId,
    totalExpectedChunks: 2,
    totalExpectedRows: 3,
  });
  const row3Cleared = await DraftRow.findById(row3._id);
  assert.strictEqual(row3Cleared.isDuplicate, false);
  assert.deepStrictEqual(row3Cleared.duplicateReferences, []);
  assert.strictEqual(row3Cleared.warnings.some((w: any) => w.code === 'DUPLICATE_ROW'), false);

  // Restore row3 back to duplicate for subsequent test steps
  await DraftRow.updateOne(
    { _id: row3._id },
    {
      $set: {
        importedData: {
          'Full Name': 'Alice Smith',
          'Grad Date': '2026-05-15',
          GPA: '3.85',
        },
      },
    }
  );
  await BatchIntake.finalizeImport({
    batchId: batch._id,
    importId: batchImport._id,
    ownerId: testUserId,
    totalExpectedChunks: 2,
    totalExpectedRows: 3,
  });

  // Test 8: patchRowOverride with CAS, revalidation, approval invalidation & counter rollup
  console.log('8. Testing patchRowOverride (CAS protection, override persistence, approval invalidation)...');
  
  // 8a. CAS Revision mismatch
  await assert.rejects(
    async () => {
      await BatchIntake.patchRowOverride({
        batchId: batch._id,
        rowId: row2._id,
        ownerId: testUserId,
        overrides: { studentName: 'Bob Dylan' },
        expectedRevision: 99,
      });
    },
    (err: any) => err instanceof ConcurrencyConflictError && err.code === 'STALE_BATCH_REVISION'
  );

  // 8b. CAS Row Version mismatch
  await assert.rejects(
    async () => {
      await BatchIntake.patchRowOverride({
        batchId: batch._id,
        rowId: row2._id,
        ownerId: testUserId,
        overrides: { studentName: 'Bob Dylan' },
        expectedVersion: 99,
      });
    },
    (err: any) => err instanceof ConcurrencyConflictError && err.code === 'CONCURRENT_MODIFICATION'
  );

  // 8c. Mark batch as approved to test approval invalidation
  await Batch.updateOne(
    { _id: batch._id },
    {
      $set: {
        status: 'approved',
        approvedSnapshotId: new mongoose.Types.ObjectId(),
      },
    }
  );

  // 8d. Successful override that repairs row2
  const patchRes = await BatchIntake.patchRowOverride({
    batchId: batch._id,
    rowId: row2._id,
    ownerId: testUserId,
    overrides: {
      studentName: 'Bob Dylan',
      graduationDate: '2026-06-01',
    },
    expectedRevision: 1,
    expectedVersion: 1,
  });

  assert.strictEqual(patchRes.row.status, 'valid');
  assert.strictEqual(patchRes.row.effectiveData.studentName, 'Bob Dylan');
  assert.strictEqual(patchRes.row.effectiveData.graduationDate, '2026-06-01');
  assert.strictEqual(patchRes.row.version, 2);

  // Verify approval state invalidated back to review
  const reloadedBatch = await Batch.findById(batch._id);
  assert.strictEqual(reloadedBatch.status, 'review');
  assert.strictEqual(reloadedBatch.approvedSnapshotId, null);

  // Verify counters recomputed authoritatively: row2 became valid, so validRows is now 3, invalidRows is 0
  assert.strictEqual(reloadedBatch.totalRows, 3);
  assert.strictEqual(reloadedBatch.validRows, 3);
  assert.strictEqual(reloadedBatch.invalidRows, 0);
  assert.strictEqual(patchRes.batchSummary.validRows, 3);
  assert.strictEqual(patchRes.batchSummary.invalidRows, 0);

  // 8e. Override row3 to not be a duplicate, verify patchRowOverride refreshes duplicate detection & counters
  const patchResRow3 = await BatchIntake.patchRowOverride({
    batchId: batch._id,
    rowId: row3._id,
    ownerId: testUserId,
    overrides: {
      studentName: 'Zoe Unique',
    },
    expectedRevision: 1,
    expectedVersion: 1,
  });
  assert.strictEqual(patchResRow3.row.isDuplicate, false);
  assert.deepStrictEqual(patchResRow3.row.duplicateReferences, []);
  assert.strictEqual(patchResRow3.batchSummary.duplicateRows, 0);

  const reloadedBatchAfterDup = await Batch.findById(batch._id);
  assert.strictEqual(reloadedBatchAfterDup.duplicateRows, 0);

  console.log('   ✓ patchRowOverride CAS, approval invalidation, and counter recalculation verified\n');

  // Test 9: reconcileImportRevision (diff calculation, override carry-forward, duplicate detection, counter rollup)
  console.log('9. Testing reconcileImportRevision across revisions...');

  // 9a. Test rejection when import chunks are incomplete and chunks are expected
  const incompleteImport = await BatchImport.create({
    batchId: batch._id,
    ownerId: testUserId,
    revision: 3,
    sourceFileName: 'students_v3.xlsx',
    sourceFileSize: 5000,
    totalExpectedChunks: 3,
    receivedChunkIds: ['c1'],
    status: 'uploading',
  });
  await assert.rejects(
    async () => {
      await BatchIntake.reconcileImportRevision({
        batchId: batch._id,
        importId: incompleteImport._id,
        ownerId: testUserId,
      });
    },
    (err: any) => err instanceof ChunkMismatchError && err.code === 'IMPORT_CHUNK_MISMATCH'
  );

  // 9b. Test rejection when import revision is not newer than current batch revision
  await assert.rejects(
    async () => {
      await BatchIntake.reconcileImportRevision({
        batchId: batch._id,
        importId: batchImport._id,
        ownerId: testUserId,
      });
    },
    (err: any) => err instanceof ConcurrencyConflictError && err.code === 'STALE_IMPORT_REVISION'
  );
  const revision2Import = await BatchImport.create({
    batchId: batch._id,
    ownerId: testUserId,
    revision: 2,
    sourceFileName: 'students_v2.xlsx',
    sourceFileSize: 12000,
    columnMap: {
      studentName: 'Full Name',
      graduationDate: 'Grad Date',
      gpa: 'Score',
    },
    status: 'uploading',
  });

  // Ingest Revision 2 rows
  await BatchIntake.ingestChunk({
    batchId: batch._id,
    importId: revision2Import._id,
    ownerId: testUserId,
    chunkId: 'chunk_v2_1',
    totalChunks: 1,
    rows: [
      {
        sourceRowNumber: 1,
        rowKey: 'v2_row_1',
        importedData: {
          'Full Name': 'Alice Walker',
          'Grad Date': '2026-05-20', // Changed date
          Score: '3.98',
        },
      },
      {
        sourceRowNumber: 2,
        rowKey: 'v2_row_2',
        importedData: {
          'Full Name': 'Charlie Brown',
          'Grad Date': '2026-06-15',
          Score: '3.50',
        },
      },
    ],
  });

  const reconcileRes = await BatchIntake.reconcileImportRevision({
    batchId: batch._id,
    importId: revision2Import._id,
    ownerId: testUserId,
    reconciliationKey: 'studentName',
    resolutions: {
      carryForwardOverrides: true,
    },
  });

  assert.strictEqual(reconcileRes.batch.currentImportRevision, 2);
  assert.strictEqual(reconcileRes.batch.status, 'review');
  assert.strictEqual(reconcileRes.batch.approvedSnapshotId, null);
  assert.strictEqual(reconcileRes.summary.totalRows, 2);
  assert.strictEqual(reconcileRes.summary.validRows, 2);
  assert.strictEqual(reconcileRes.summary.invalidRows, 0);

  const updatedImport2 = await BatchImport.findById(revision2Import._id);
  assert.strictEqual(updatedImport2.status, 'completed');
  assert.strictEqual(updatedImport2.rowCount, 2);
  console.log('   ✓ reconcileImportRevision verified\n');

  // Teardown Test Data
  console.log('10. Cleaning up test data...');
  await Template.deleteMany({ ownerId: testUserId });
  await TemplateVersion.deleteMany({ ownerId: testUserId });
  await Batch.deleteMany({ ownerId: testUserId });
  await BatchImport.deleteMany({ ownerId: testUserId });
  await DraftRow.deleteMany({ ownerId: testUserId });
  await mongoose.disconnect();
  console.log('   ✓ Test fixtures cleaned up and database disconnected\n');

  console.log('🎉 ALL BATCH INTAKE TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
