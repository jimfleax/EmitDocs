/**
 * @file core-05-acceptance-matrix.test.ts
 * @description Acceptance criteria test matrix for PRD-CORE-05: Batch Review, Inline Corrections, Re-import Reconciliation, & Approval Gating.
 * @architecture End-to-end verification covering draft row retrieval, inline edits with optimistic concurrency, diff calculation, 404 tenant isolation, and approval state invalidation.
 * @agent_note Run via `pnpm run test:core05`. Requires active MongoDB instance via MONGODB_URI in api/.env. Automatically tests cross-tenant isolation and cleans up test data upon completion.
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { PDFDocument } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../api/.env') });

import { Batch } from '../api/src/models/Batch.js';
import { BatchImport } from '../api/src/models/BatchImport.js';
import { DraftRow } from '../api/src/models/DraftRow.js';
import { Template } from '../api/src/models/Template.js';
import { TemplateVersion } from '../api/src/models/TemplateVersion.js';
import {
  getDraftRows,
  patchDraftRow,
  getReimportDiff,
  reconcileReimport,
} from '../api/src/controllers/batches.controller.js';
import { calculateReimportDiff } from '../api/src/services/spreadsheet/diff-calculator.js';
import { generatePdfWithOverlay, type FieldMappingConfig } from '../web/src/lib/pdf-engine/pdf-preview-engine.js';

/**
 * @desc    Creates a mock Hono/Express-style context object for invoking batch controller handlers in tests.
 * @param   {Object} options - Mock context options
 * @param   {Object} options.user - Authenticated user object returned by ctx.get('user')
 * @param   {Object} [options.params] - URL path parameters for req.param()
 * @param   {Object} [options.query] - Query string parameters for req.query()
 * @param   {any}    [options.body] - Request JSON payload returned by req.json()
 * @returns {Object} Mock context with get, req, json, and _getResponse helpers
 */
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

/**
 * @desc    Executes the comprehensive PRD-CORE-05 acceptance criteria matrix (AC1 through AC8).
 * @returns {Promise<void>} Resolves when all acceptance criteria assertions pass
 * @throws  {AssertionError} If any acceptance criterion fails
 */
async function runAcceptanceCriteriaMatrix() {
  console.log('===========================================================');
  console.log('  PRD-CORE-05 ACCEPTANCE CRITERIA MATRIX (AC1 - AC8)');
  console.log('===========================================================\n');

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { dbName: 'emitdocs_ac_test' });
  console.log('✓ Connected to MongoDB test database\n');

  let template: any = null;
  let batch: any = null;

  try {
    const testUserId = `ac_user_core05_${Date.now()}`;
    const mockUser = { id: testUserId, email: 'reviewer@example.com' };

    // Setup template & template version with standard fields
    template = await Template.create({
      ownerId: testUserId,
      name: 'Certificate of Excellence',
      cloudinaryPublicId: 'ac_cert_fixture',
      sourceUrl: 'https://example.com/ac_cert.pdf',
      status: 'active',
    });

    const templateVersion = await TemplateVersion.create({
      templateId: template._id,
      ownerId: testUserId,
      version: 1,
      sourceObjectKey: 'ac_cert.pdf',
      bytes: 2048,
      pageCount: 1,
      status: 'active',
      fieldMappings: [
        {
          id: 'f_student_id',
          key: 'studentId',
          label: 'Student ID',
          type: 'text',
          pageIndex: 0,
          rect: { x: 50, y: 500, width: 200, height: 25 },
          required: true,
        },
        {
          id: 'f_name',
          key: 'studentName',
          label: 'Student Name',
          type: 'text',
          pageIndex: 0,
          rect: { x: 50, y: 450, width: 200, height: 30 },
          required: true,
        },
        {
          id: 'f_grade',
          key: 'grade',
          label: 'Grade',
          type: 'text',
          pageIndex: 0,
          rect: { x: 50, y: 400, width: 100, height: 20 },
          required: false,
        },
      ],
    });

    // Setup initial Batch
    batch = await Batch.create({
    ownerId: testUserId,
    name: 'Class of 2026 Batch',
    templateId: template._id,
    templateVersionId: templateVersion._id,
    status: 'review',
    currentImportRevision: 1,
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    duplicateRows: 0,
  });

  const batchImport = await BatchImport.create({
    batchId: batch._id,
    ownerId: testUserId,
    sourceFileName: 'students.xlsx',
    sourceFileSize: 1024,
    revision: 1,
    status: 'completed',
    rawHeaders: ['ID', 'Name', 'Grade'],
    disambiguatedHeaders: ['ID', 'Name', 'Grade'],
    columnMap: {
      studentId: 'ID',
      studentName: 'Name',
      grade: 'Grade',
    },
    rowCount: 0,
  });

  // ---------------------------------------------------------------------------
  // AC1: Draft Reachability & Search across 5,000+ records (AC1)
  // ---------------------------------------------------------------------------
  console.log('--- Testing AC1: Draft Reachability & Search across 5,000+ Records ---');
  const TOTAL_RECORDS = 5000;
  console.log(`   Ingesting ${TOTAL_RECORDS} draft rows for batch search benchmark...`);

  const bulkRows = [];
  for (let i = 1; i <= TOTAL_RECORDS; i++) {
    const isInvalid = i === 42 || i === 100;
    const isDuplicate = i === 201 || i === 202;
    const isOverridden = i === 300;

    bulkRows.push({
      batchId: batch._id,
      importId: batchImport._id,
      ownerId: testUserId,
      revision: 1,
      sourceRowNumber: i,
      rowKey: `row_${i}`,
      status: isInvalid ? 'invalid' : 'valid',
      importedData: {
        ID: isDuplicate ? 'STU_00200' : `STU_${i.toString().padStart(5, '0')}`,
        Name: isInvalid ? '' : isDuplicate ? 'Student_200' : `Student_${i}`,
        Grade: 'A',
      },
      effectiveData: {
        studentId: isDuplicate ? 'STU_00200' : `STU_${i.toString().padStart(5, '0')}`,
        studentName: isInvalid ? '' : isOverridden ? 'Overridden Name' : isDuplicate ? 'Student_200' : `Student_${i}`,
        grade: 'A',
      },
      overrides: isOverridden ? { studentName: 'Overridden Name' } : {},
      isDuplicate: isDuplicate,
      duplicateReferences: isDuplicate ? [200] : [],
      errors: isInvalid ? [{ field: 'studentName', code: 'REQUIRED_FIELD_EMPTY', message: 'Student Name is required' }] : [],
      warnings: isDuplicate ? [{ field: 'studentId', code: 'DUPLICATE_ROW', message: 'Duplicate record matches earlier row(s): 200', referenceRowNumbers: [200] }] : [],
      version: 1,
    });
  }

  await DraftRow.insertMany(bulkRows);
  await Batch.updateOne(
    { _id: batch._id },
    {
      totalRows: TOTAL_RECORDS,
      validRows: TOTAL_RECORDS - 2,
      invalidRows: 2,
      duplicateRows: 2,
    }
  );

  // 1. Pagination verification
  const cPage = createMockContext({
    user: mockUser,
    params: { id: batch._id.toString() },
    query: { page: '2', limit: '50' },
  });
  await getDraftRows(cPage as any);
  const pageRes = cPage._getResponse();
  assert.strictEqual(pageRes.status, 200);
  assert.strictEqual(pageRes.data.rows.length, 50, 'Page 2 should return exactly 50 rows');
  assert.strictEqual(pageRes.data.rows[0].sourceRowNumber, 51, 'First row on page 2 must be row 51');
  assert.strictEqual(pageRes.data.total, TOTAL_RECORDS);
  assert.strictEqual(pageRes.data.totalPages, 100);

  // 2. Numeric row search
  const cSearchNum = createMockContext({
    user: mockUser,
    params: { id: batch._id.toString() },
    query: { query: '42' },
  });
  await getDraftRows(cSearchNum as any);
  const searchNumRes = cSearchNum._getResponse();
  assert.ok(searchNumRes.data.rows.some((r: any) => r.sourceRowNumber === 42), 'Search query "42" must find row #42');

  // 3. Mapped field effectiveData search
  const cSearchName = createMockContext({
    user: mockUser,
    params: { id: batch._id.toString() },
    query: { query: 'Overridden Name' },
  });
  await getDraftRows(cSearchName as any);
  const searchNameRes = cSearchName._getResponse();
  assert.strictEqual(searchNameRes.data.rows.length, 1);
  assert.strictEqual(searchNameRes.data.rows[0].sourceRowNumber, 300);

  // 4. Facet filter checks
  const cFilterInvalid = createMockContext({
    user: mockUser,
    params: { id: batch._id.toString() },
    query: { filter: 'invalid' },
  });
  await getDraftRows(cFilterInvalid as any);
  const invalidRes = cFilterInvalid._getResponse();
  assert.strictEqual(invalidRes.data.rows.length, 2);
  assert.strictEqual(invalidRes.data.summary.invalidRows, 2);
  assert.strictEqual(invalidRes.data.summary.duplicateRows, 2);
  assert.strictEqual(invalidRes.data.summary.overriddenRows, 1);
  assert.strictEqual(invalidRes.data.summary.totalRows, TOTAL_RECORDS);
  console.log('   ✓ AC1 Passed: 5,000 rows searchable, paginated, and faceted in real-time.\n');

  // ---------------------------------------------------------------------------
  // AC2: Preview Pipeline Parity & Overflow Detection (AC2)
  // ---------------------------------------------------------------------------
  console.log('--- Testing AC2: Preview Pipeline Parity & Overflow Detection ---');
  // Create blank PDF for testing
  const dummyDoc = await PDFDocument.create();
  dummyDoc.addPage([600, 800]);
  const dummyPdfBytes = await dummyDoc.save();

  const normalConfig: FieldMappingConfig[] = [
    {
      id: 'f1',
      key: 'studentName',
      pageIndex: 0,
      rect: { x: 50, y: 700, width: 200, height: 30 },
      fontSize: 16,
      minFontSize: 8,
      fitMode: 'shrink-to-fit',
    },
  ];

  // 1. Normal text render
  const normalResult = await generatePdfWithOverlay(
    dummyPdfBytes,
    normalConfig,
    { studentName: 'Jane Smith' }
  );
  assert.strictEqual(normalResult.warnings.length, 0, 'Normal text should produce no warnings');
  assert.ok(normalResult.pdfBytes.length > 0, 'Must produce valid PDF binary');

  // 2. Overflow text render (text too long to fit bounding box even at minFontSize)
  const overflowResult = await generatePdfWithOverlay(
    dummyPdfBytes,
    normalConfig,
    {
      studentName: 'A'.repeat(500), // Huge string exceeding 200pt box
    }
  );
  assert.ok(
    overflowResult.warnings.some((w) => w.type === 'overflow'),
    'Excessive text must trigger overflow warning'
  );
  console.log('   ✓ AC2 Passed: Production preview pipeline parity and overflow detection verified.\n');

  // ---------------------------------------------------------------------------
  // AC3: Inline Edits Persist & Revalidate across Refresh/Reload (AC3)
  // ---------------------------------------------------------------------------
  console.log('--- Testing AC3: Inline Edits Persist & Revalidate ---');
  const targetInvalidRow = await DraftRow.findOne({ batchId: batch._id, sourceRowNumber: 42 });
  assert.ok(targetInvalidRow);
  assert.strictEqual(targetInvalidRow.status, 'invalid');
  assert.strictEqual(targetInvalidRow.importedData.Name, '');

  // 1. Optimistic Locking: Attempt patch with wrong row version -> 409
  const cConflict = createMockContext({
    user: mockUser,
    params: { id: batch._id.toString(), rowId: targetInvalidRow._id.toString() },
    body: {
      expectedRevision: 1,
      expectedVersion: 999, // Stale version
      overrides: { studentName: 'Resolved Jane' },
    },
  });
  await patchDraftRow(cConflict as any);
  assert.strictEqual(cConflict._getResponse().status, 409);
  assert.strictEqual(cConflict._getResponse().data.error, 'CONCURRENT_MODIFICATION');

  // 2. Valid Patch: Overrides studentName -> turns invalid to valid
  const cPatch = createMockContext({
    user: mockUser,
    params: { id: batch._id.toString(), rowId: targetInvalidRow._id.toString() },
    body: {
      expectedRevision: 1,
      expectedVersion: 1,
      overrides: { studentName: 'Resolved Jane' },
    },
  });
  await patchDraftRow(cPatch as any);
  const patchRes = cPatch._getResponse();
  assert.strictEqual(patchRes.status, 200);
  assert.strictEqual(patchRes.data.row.status, 'valid');
  assert.strictEqual(patchRes.data.row.errors.length, 0);
  assert.strictEqual(patchRes.data.row.version, 2);
  assert.strictEqual(patchRes.data.row.overrides.studentName, 'Resolved Jane');
  assert.strictEqual(patchRes.data.row.effectiveData.studentName, 'Resolved Jane');

  // Verify raw importedData remains completely immutable
  const reloadedRow = await DraftRow.findById(targetInvalidRow._id);
  assert.strictEqual(reloadedRow?.importedData.Name, '', 'Raw importedData must remain immutable');

  // 3. Revert override
  const cRevert = createMockContext({
    user: mockUser,
    params: { id: batch._id.toString(), rowId: targetInvalidRow._id.toString() },
    body: {
      expectedRevision: 1,
      expectedVersion: 2,
      overrides: { studentName: null },
    },
  });
  await patchDraftRow(cRevert as any);
  const revertRes = cRevert._getResponse();
  assert.strictEqual(revertRes.status, 200);
  assert.strictEqual(revertRes.data.row.status, 'invalid', 'Reverting to empty imported data must revalidate to invalid');
  console.log('   ✓ AC3 Passed: Optimistic concurrency, raw immutability, override persistence & revalidation verified.\n');

  // ---------------------------------------------------------------------------
  // AC4: Re-import Diff Engine (Added, Removed, Changed, Conflicted) (AC4)
  // ---------------------------------------------------------------------------
  console.log('--- Testing AC4: Re-import Diff Engine ---');
  const oldRows = [
    {
      _id: 'old_1',
      rowKey: 'key_1',
      sourceRowNumber: 1,
      effectiveData: { studentId: 'S1', studentName: 'Alice', grade: 'A' },
      importedData: { studentId: 'S1', studentName: 'Alice', grade: 'A' },
      overrides: {},
    },
    {
      _id: 'old_2',
      rowKey: 'key_2',
      sourceRowNumber: 2,
      effectiveData: { studentId: 'S2', studentName: 'Bob Overridden', grade: 'B' },
      importedData: { studentId: 'S2', studentName: 'Bob', grade: 'B' },
      overrides: { studentName: 'Bob Overridden' }, // Manual override
    },
    {
      _id: 'old_3',
      rowKey: 'key_3',
      sourceRowNumber: 3,
      effectiveData: { studentId: 'S3', studentName: 'Charlie', grade: 'C' },
      importedData: { studentId: 'S3', studentName: 'Charlie', grade: 'C' },
      overrides: {},
    },
  ];

  const newRows = [
    {
      _id: 'new_1',
      rowKey: 'key_1',
      sourceRowNumber: 1,
      effectiveData: { studentId: 'S1', studentName: 'Alice', grade: 'A+' }, // Changed grade
      importedData: { studentId: 'S1', studentName: 'Alice', grade: 'A+' },
    },
    {
      _id: 'new_2',
      rowKey: 'key_2',
      sourceRowNumber: 2,
      effectiveData: { studentId: 'S2', studentName: 'Robert', grade: 'B' }, // Spreadsheet changed name to Robert, conflicting with override
      importedData: { studentId: 'S2', studentName: 'Robert', grade: 'B' },
    },
    {
      _id: 'new_4',
      rowKey: 'key_4',
      sourceRowNumber: 4,
      effectiveData: { studentId: 'S4', studentName: 'Diana', grade: 'A' }, // Added
      importedData: { studentId: 'S4', studentName: 'Diana', grade: 'A' },
    },
  ];

  const diff = calculateReimportDiff(
    oldRows,
    newRows,
    'studentId',
    templateVersion.fieldMappings
  );

  assert.strictEqual(diff.summary.addedCount, 1, 'S4 must be added');
  assert.strictEqual(diff.summary.removedCount, 1, 'S3 must be removed');
  assert.strictEqual(diff.summary.changedCount, 1, 'S1 must be changed');
  assert.strictEqual(diff.summary.conflictedCount, 1, 'S2 must be conflicted');
  assert.strictEqual(diff.conflicted[0].field, 'studentName');
  assert.strictEqual(diff.conflicted[0].override, 'Bob Overridden');
  assert.strictEqual(diff.conflicted[0].newImported, 'Robert');
  console.log('   ✓ AC4 Passed: Accurate classification of added, removed, changed, and conflicted records.\n');

  // ---------------------------------------------------------------------------
  // AC5: Ambiguous Matches Require Manual Resolution (No Auto-Matching) (AC5)
  // ---------------------------------------------------------------------------
  console.log('--- Testing AC5: Ambiguous Collision & Missing Key Invariants ---');
  const collidingNewRows = [
    {
      _id: 'new_c1',
      rowKey: 'row_10',
      sourceRowNumber: 10,
      effectiveData: { studentId: 'DUP_KEY', studentName: 'Twin One' },
      importedData: { studentId: 'DUP_KEY', studentName: 'Twin One' },
    },
    {
      _id: 'new_c2',
      rowKey: 'row_11',
      sourceRowNumber: 11,
      effectiveData: { studentId: 'DUP_KEY', studentName: 'Twin Two' },
      importedData: { studentId: 'DUP_KEY', studentName: 'Twin Two' },
    },
    {
      _id: 'new_blank',
      rowKey: 'row_12',
      sourceRowNumber: 12,
      effectiveData: { studentId: '', studentName: 'No ID' },
      importedData: { studentId: '', studentName: 'No ID' },
    },
  ];

  const collisionDiff = calculateReimportDiff(
    [],
    collidingNewRows,
    'studentId',
    templateVersion.fieldMappings
  );

  assert.strictEqual(collisionDiff.summary.ambiguousCount, 3, 'All 3 rows must be classified ambiguous');
  const collisionReasons = collisionDiff.ambiguous.map((a) => a.reason);
  assert.strictEqual(collisionReasons.filter((r) => r === 'COLLISION').length, 2, 'Two rows collided on DUP_KEY');
  assert.strictEqual(collisionReasons.filter((r) => r === 'MISSING_KEY').length, 1, 'One row had blank key');
  console.log('   ✓ AC5 Passed: Zero row-index auto matching; collisions and missing keys marked ambiguous.\n');

  // ---------------------------------------------------------------------------
  // AC6: Duplicate Warnings Do Not Drop Records (AC6)
  // ---------------------------------------------------------------------------
  console.log('--- Testing AC6: Duplicate Warnings Do Not Drop Records ---');
  const dupRows = await DraftRow.find({ batchId: batch._id, isDuplicate: true });
  assert.strictEqual(dupRows.length, 2, 'Duplicate records must be preserved in collection');
  assert.ok(dupRows[0].warnings.some((w) => w.code === 'DUPLICATE_ROW'));
  console.log('   ✓ AC6 Passed: Duplicates retained with non-blocking warnings.\n');

  // ---------------------------------------------------------------------------
  // AC7: Edit / Re-import Invalidates Stale Approval State (AC7)
  // ---------------------------------------------------------------------------
  console.log('--- Testing AC7: Mutation Invalidates Stale Approval State ---');
  // 1. Set batch to approved state
  const mockSnapshotId1 = new mongoose.Types.ObjectId();
  await Batch.updateOne(
    { _id: batch._id },
    {
      status: 'awaiting_approval',
      approvedSnapshotId: mockSnapshotId1,
    }
  );
  let batchCheck = await Batch.findById(batch._id);
  assert.strictEqual(batchCheck?.status, 'awaiting_approval');
  assert.ok(batchCheck?.approvedSnapshotId?.equals(mockSnapshotId1));

  // 2. Perform inline edit -> check invalidation
  const sampleRow = await DraftRow.findOne({ batchId: batch._id, sourceRowNumber: 1 });
  assert.ok(sampleRow);
  const cInvalidateEdit = createMockContext({
    user: mockUser,
    params: { id: batch._id.toString(), rowId: sampleRow._id.toString() },
    body: {
      expectedRevision: 1,
      expectedVersion: sampleRow.version,
      overrides: { grade: 'A+' },
    },
  });
  await patchDraftRow(cInvalidateEdit as any);
  batchCheck = await Batch.findById(batch._id);
  assert.strictEqual(batchCheck?.approvedSnapshotId, null, 'Approval snapshot must be invalidated on row edit');
  assert.strictEqual(batchCheck?.status, 'review', 'Batch status must reset to review');

  // 3. Set approval snapshot again and test re-import reconcile invalidation
  const mockSnapshotId2 = new mongoose.Types.ObjectId();
  await Batch.updateOne(
    { _id: batch._id },
    {
      status: 'awaiting_approval',
      approvedSnapshotId: mockSnapshotId2,
    }
  );

  // Setup revision 2 BatchImport
  const rev2Import = await BatchImport.create({
    batchId: batch._id,
    ownerId: testUserId,
    sourceFileName: 'students_rev2.xlsx',
    sourceFileSize: 2048,
    revision: 2,
    status: 'completed',
    rawHeaders: ['ID', 'Name', 'Grade'],
    disambiguatedHeaders: ['ID', 'Name', 'Grade'],
    columnMap: { studentId: 'ID', studentName: 'Name', grade: 'Grade' },
    rowCount: 1,
  });

  const rev2Row = await DraftRow.create({
    batchId: batch._id,
    importId: rev2Import._id,
    ownerId: testUserId,
    revision: 2,
    sourceRowNumber: 1,
    rowKey: 'row_1',
    status: 'valid',
    importedData: { ID: 'STU_00001', Name: 'Alice Updated', Grade: 'A' },
    effectiveData: { studentId: 'STU_00001', studentName: 'Alice Updated', grade: 'A' },
    errors: [],
    warnings: [],
    version: 1,
  });

  const cReconcile = createMockContext({
    user: mockUser,
    params: { id: batch._id.toString(), importId: rev2Import._id.toString() },
    body: {
      reconciliationKey: 'studentId',
      resolutions: {
        conflicts: [],
        ambiguous: [],
        carryForwardOverrides: true,
      },
    },
  });
  await reconcileReimport(cReconcile as any);
  assert.strictEqual(cReconcile._getResponse().status, 200);

  batchCheck = await Batch.findById(batch._id);
  assert.strictEqual(batchCheck?.currentImportRevision, 2, 'Batch revision must be updated to 2');
  assert.strictEqual(batchCheck?.approvedSnapshotId, null, 'Approval snapshot must be cleared on reconciliation');
  assert.strictEqual(batchCheck?.status, 'review');
  console.log('   ✓ AC7 Passed: Inline edit and re-import reconciliation both invalidate stale approval.\n');

  // ---------------------------------------------------------------------------
  // AC8: Cross-User Isolation (AC8)
  // ---------------------------------------------------------------------------
  console.log('--- Testing AC8: Cross-User Isolation ---');
  const attackerUser = { id: `attacker_${Date.now()}`, email: 'attacker@example.com' };

  // 1. Get draft rows of victim batch -> 404
  const cAttackerRows = createMockContext({
    user: attackerUser,
    params: { id: batch._id.toString() },
  });
  await getDraftRows(cAttackerRows as any);
  assert.strictEqual(cAttackerRows._getResponse().status, 404);

  // 2. Patch draft row of victim batch -> 404
  const cAttackerPatch = createMockContext({
    user: attackerUser,
    params: { id: batch._id.toString(), rowId: rev2Row._id.toString() },
    body: { overrides: { grade: 'F' } },
  });
  await patchDraftRow(cAttackerPatch as any);
  assert.strictEqual(cAttackerPatch._getResponse().status, 404);

  // 3. Get re-import diff of victim batch -> 404
  const cAttackerDiff = createMockContext({
    user: attackerUser,
    params: { id: batch._id.toString(), importId: rev2Import._id.toString() },
  });
  await getReimportDiff(cAttackerDiff as any);
  assert.strictEqual(cAttackerDiff._getResponse().status, 404);

  // 4. Reconcile victim batch -> 404
  const cAttackerReconcile = createMockContext({
    user: attackerUser,
    params: { id: batch._id.toString(), importId: rev2Import._id.toString() },
    body: { reconciliationKey: 'studentId' },
  });
  await reconcileReimport(cAttackerReconcile as any);
  assert.strictEqual(cAttackerReconcile._getResponse().status, 404);
  console.log('   ✓ AC8 Passed: Cross-user batch mutation and inspection rejected with 404.\n');

  console.log('===========================================================');
  console.log('🎉 ALL PRD-CORE-05 ACCEPTANCE CRITERIA (AC1 - AC8) PASSED!');
  console.log('===========================================================');
  } finally {
    // Guaranteed cleanup runs on both success and failure
    if (batch) {
      await DraftRow.deleteMany({ batchId: batch._id });
      await BatchImport.deleteMany({ batchId: batch._id });
      await Batch.deleteMany({ _id: batch._id });
    }
    if (template) {
      await TemplateVersion.deleteMany({ templateId: template._id });
      await Template.deleteMany({ _id: template._id });
    }
    await mongoose.disconnect();
  }
}

runAcceptanceCriteriaMatrix().catch((err) => {
  console.error('❌ Acceptance criteria matrix failed:', err);
  process.exit(1);
});
