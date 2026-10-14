/**
 * @file core-06-acceptance-matrix.test.ts
 * @description Acceptance criteria test matrix for PRD-CORE-06: Batch Approval & Immutable Snapshot.
 * @architecture End-to-end verification covering preflight summaries, immutable snapshot creation,
 *               canonical SHA-256 digest computation, post-approval invalidation and immutability,
 *               interrupted build recovery, optimistic concurrency & idempotency, invalid row exclusion,
 *               and cross-tenant isolation.
 * @agent_note Run via `pnpm run test:core06`. Requires active MongoDB instance via MONGODB_URI in api/.env.
 *             Automatically cleans up test batches, templates, and snapshots upon completion.
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import mongoose from 'mongoose';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../api/.env') });

// Models
import { Batch } from '../api/src/models/Batch.js';
import { BatchImport } from '../api/src/models/BatchImport.js';
import { DraftRow } from '../api/src/models/DraftRow.js';
import { Template } from '../api/src/models/Template.js';
import { TemplateVersion } from '../api/src/models/TemplateVersion.js';
import { ApprovedSnapshot } from '../api/src/models/ApprovedSnapshot.js';
import { ApprovedRecipient } from '../api/src/models/ApprovedRecipient.js';

// Controller Handlers
import {
  getApprovalPreflight,
  approveBatch,
  patchDraftRow,
} from '../api/src/controllers/batches.controller.js';

// Canonical Hasher & Service
import {
  computeCanonicalSnapshotDigest,
} from '../api/src/services/batch-approval.js';

/**
 * Creates a mock Hono/Express-style context object for invoking batch controller handlers in tests.
 * @param {Object} options - Mock context options
 * @param {Object} options.user - Authenticated user object returned by ctx.get('user')
 * @param {Object} [options.params] - URL path parameters for req.param()
 * @param {Object} [options.query] - Query string parameters for req.query()
 * @param {any}    [options.body] - Request JSON payload returned by req.json()
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
 * Executes the comprehensive PRD-CORE-06 acceptance criteria matrix (AC1 through AC8).
 * @returns {Promise<void>}
 */
async function runAcceptanceCriteriaMatrix() {
  console.log('===========================================================');
  console.log('  PRD-CORE-06 ACCEPTANCE CRITERIA MATRIX (AC1 - AC8)');
  console.log('===========================================================\n');

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { dbName: 'emitdocs_ac_test' });
  console.log('✓ Connected to MongoDB test database\n');

  let template: any = null;
  let templateVersion: any = null;
  let batch: any = null;
  let batchImport: any = null;

  try {
    const testUserId = `ac_user_core06_${Date.now()}`;
    const mockUser = { id: testUserId, email: 'approver@example.com' };

    // Setup base template
    template = await Template.create({
      ownerId: testUserId,
      name: 'Degree Certificate',
      cloudinaryPublicId: 'ac_degree_fixture',
      sourceUrl: 'https://example.com/ac_degree.pdf',
      status: 'active',
    });

    const fieldMappings = [
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
        id: 'f_major',
        key: 'major',
        label: 'Major',
        type: 'text',
        pageIndex: 0,
        rect: { x: 50, y: 400, width: 150, height: 20 },
        required: false,
      },
    ];

    const sortedMappings = [...fieldMappings].sort((a, b) => a.id.localeCompare(b.id));
    const mappingHash = crypto.createHash('sha256').update(JSON.stringify(sortedMappings)).digest('hex');

    templateVersion = await TemplateVersion.create({
      templateId: template._id,
      ownerId: testUserId,
      version: 1,
      sourceObjectKey: 'ac_degree.pdf',
      bytes: 4096,
      pageCount: 1,
      status: 'active',
      fieldMappings,
      mappingHash,
    });

    template.currentVersionId = templateVersion._id;
    await template.save();

    // Setup initial Batch in 'review' status
    batch = await Batch.create({
      ownerId: testUserId,
      name: 'Commencement 2026 Batch',
      templateId: template._id,
      templateVersionId: templateVersion._id,
      status: 'review',
      currentImportRevision: 1,
      totalRows: 10,
      validRows: 7,
      invalidRows: 3,
      duplicateRows: 2,
      version: 1,
      retentionHours: 168,
    });

    batchImport = await BatchImport.create({
      batchId: batch._id,
      ownerId: testUserId,
      sourceFileName: 'graduates.xlsx',
      sourceFileSize: 2048,
      revision: 1,
      status: 'completed',
      rawHeaders: ['ID', 'Name', 'Major'],
      disambiguatedHeaders: ['ID', 'Name', 'Major'],
      columnMap: {
        studentId: 'ID',
        studentName: 'Name',
        major: 'Major',
      },
      rowCount: 10,
    });

    // Seed 10 draft rows (7 valid, 3 invalid, 2 duplicate warnings)
    const draftRows = [];
    for (let i = 1; i <= 10; i++) {
      const isInvalid = i === 4 || i === 8 || i === 9; // 3 invalid rows
      const isDuplicate = i === 2 || i === 3;          // 2 duplicates of row 1
      draftRows.push({
        batchId: batch._id,
        importId: batchImport._id,
        ownerId: testUserId,
        revision: 1,
        sourceRowNumber: i,
        rowKey: `row_${i}`,
        status: isInvalid ? 'invalid' : 'valid',
        importedData: {
          ID: isDuplicate ? 'STU_001' : `STU_${i.toString().padStart(3, '0')}`,
          Name: isInvalid ? '' : isDuplicate ? 'Alice Smith' : `Student_${i}`,
          Major: 'Computer Science',
        },
        effectiveData: {
          studentId: isDuplicate ? 'STU_001' : `STU_${i.toString().padStart(3, '0')}`,
          studentName: isInvalid ? '' : isDuplicate ? 'Alice Smith' : `Student_${i}`,
          major: 'Computer Science',
        },
        overrides: {},
        isDuplicate,
        duplicateReferences: isDuplicate ? [1] : [],
        errors: isInvalid
          ? [{ field: 'studentName', code: 'REQUIRED_FIELD_EMPTY', message: 'Student Name is required' }]
          : [],
        warnings: isDuplicate
          ? [{ field: 'studentId', code: 'DUPLICATE_ROW', message: 'Duplicate record matches row 1' }]
          : [],
        version: 1,
      });
    }
    await DraftRow.insertMany(draftRows);

    // -------------------------------------------------------------------------
    // AC1: Approval Summary & Preflight Endpoint
    // -------------------------------------------------------------------------
    console.log('--- Testing AC1: Approval Summary & Preflight Endpoint ---');
    const cPreflight = createMockContext({
      user: mockUser,
      params: { id: batch._id.toString() },
    });
    await getApprovalPreflight(cPreflight as any);
    const preflightRes = cPreflight._getResponse();

    assert.strictEqual(preflightRes.status, 200, 'Preflight must return 200 OK');
    assert.strictEqual(preflightRes.data.summary.totalRows, 10, 'Preflight totalRows must equal 10');
    assert.strictEqual(preflightRes.data.summary.validRows, 7, 'Preflight validRows must equal 7');
    assert.strictEqual(preflightRes.data.summary.invalidRows, 3, 'Preflight invalidRows must equal 3');
    assert.strictEqual(preflightRes.data.summary.duplicateRows, 2, 'Preflight duplicateRows must equal 2');
    assert.strictEqual(preflightRes.data.canApprove, true, 'canApprove must be true when valid rows exist');
    assert.strictEqual(preflightRes.data.templateVersion.version, 1, 'Preflight must report active template version 1');
    assert.strictEqual(preflightRes.data.templateVersion.mappingHash, mappingHash, 'Preflight mapping hash must match');
    assert.strictEqual(preflightRes.data.importRevision, 1, 'Preflight import revision must be 1');
    assert.ok(Array.isArray(preflightRes.data.retentionPresets), 'Preflight must return retention presets array');
    console.log('   ✓ AC1 Passed: Approval summary accurately returns row metrics, template metadata, and retention options.\n');

    // -------------------------------------------------------------------------
    // AC2: Immutable Snapshot Metadata & Retention Storage
    // -------------------------------------------------------------------------
    console.log('--- Testing AC2: Snapshot Metadata & Retention Storage ---');
    const cApprove = createMockContext({
      user: mockUser,
      params: { id: batch._id.toString() },
      body: {
        expectedBatchVersion: 1,
        expectedTemplateVersion: 1,
        expectedImportRevision: 1,
        retentionHours: 168,
        idempotencyKey: 'idemp_key_ac2_test',
      },
    });
    await approveBatch(cApprove as any);
    const approveRes = cApprove._getResponse();

    assert.strictEqual(approveRes.status, 200, 'Approval must succeed with 200 OK');
    assert.ok(approveRes.data.snapshot, 'Approval response must contain snapshot object');
    assert.ok(approveRes.data.snapshot._id, 'Snapshot must have a generated ObjectId');

    const snapshot = await ApprovedSnapshot.findById(approveRes.data.snapshot._id);
    assert.ok(snapshot, 'ApprovedSnapshot must be persisted in database');
    assert.strictEqual(snapshot.batchId.toString(), batch._id.toString());
    assert.strictEqual(snapshot.templateId.toString(), template._id.toString());
    assert.strictEqual(snapshot.templateVersionId.toString(), templateVersion._id.toString());
    assert.strictEqual(snapshot.templateVersion, 1);
    assert.ok(snapshot.templateSourceChecksum, 'Snapshot must store template source checksum');
    assert.strictEqual(snapshot.mappingHash, mappingHash, 'Snapshot must store field mapping hash');
    assert.strictEqual(snapshot.importRevision, 1, 'Snapshot must record active import revision');
    assert.strictEqual(snapshot.retentionHours, 168, 'Snapshot must persist retentionHours');
    assert.ok(snapshot.expiresAt instanceof Date, 'Snapshot must compute expiresAt date');
    assert.ok(snapshot.expiresAt.getTime() > Date.now(), 'expiresAt must be in the future');
    assert.strictEqual(snapshot.status, 'ready', 'Snapshot status must be ready');
    assert.ok(snapshot.canonicalDigest && snapshot.canonicalDigest.length === 64, 'Snapshot must store 64-char SHA-256 digest');

    // Verify batch linkage
    const updatedBatch = await Batch.findById(batch._id);
    assert.strictEqual(updatedBatch?.status, 'approved', 'Batch status must transition to approved');
    assert.strictEqual(updatedBatch?.approvedSnapshotId?.toString(), snapshot._id.toString(), 'Batch must link to approvedSnapshotId');
    console.log('   ✓ AC2 Passed: Immutable snapshot captures template version, checksum, mapping hash, and retention.\n');

    // -------------------------------------------------------------------------
    // AC3: Deterministic Canonical SHA-256 Digest Calculation
    // -------------------------------------------------------------------------
    console.log('--- Testing AC3: Deterministic Canonical SHA-256 Digest ---');
    const recipientSetA = [
      {
        sourceRowNumber: 1,
        studentId: 'STU_001',
        studentName: 'Alice Smith',
        metadata: { honors: true, gpa: 3.9 },
      },
      {
        sourceRowNumber: 2,
        studentId: 'STU_002',
        studentName: 'Bob Jones',
        metadata: { gpa: 3.5, honors: false },
      },
    ];

    // Permute top-level and nested key ordering
    const recipientSetB = [
      {
        studentName: 'Alice Smith',
        metadata: { gpa: 3.9, honors: true },
        sourceRowNumber: 1,
        studentId: 'STU_001',
      },
      {
        studentId: 'STU_002',
        metadata: { honors: false, gpa: 3.5 },
        studentName: 'Bob Jones',
        sourceRowNumber: 2,
      },
    ];

    const digestA = computeCanonicalSnapshotDigest(recipientSetA);
    const digestB = computeCanonicalSnapshotDigest(recipientSetB);

    assert.strictEqual(digestA.length, 64, 'Digest must be 64-char SHA-256 hex string');
    assert.strictEqual(digestA, digestB, 'Permuted key orderings must generate identical canonical digest');

    // A single character difference must produce a distinct digest
    const recipientSetModified = [
      {
        ...recipientSetA[0],
        studentName: 'Alice Smyth', // altered char
      },
      recipientSetA[1],
    ];
    const digestModified = computeCanonicalSnapshotDigest(recipientSetModified);
    assert.notStrictEqual(digestA, digestModified, 'Content change must produce different canonical digest');
    console.log('   ✓ AC3 Passed: Deterministic canonical SHA-256 calculation invariant verified.\n');

    // -------------------------------------------------------------------------
    // AC4: Post-Approval Invalidation & Immutability Under Generation
    // -------------------------------------------------------------------------
    console.log('--- Testing AC4: Post-Approval Invalidation & Immutability ---');
    const validDraftRow = await DraftRow.findOne({ batchId: batch._id, status: 'valid' });
    assert.ok(validDraftRow);

    // 1. Row edit prior to generation invalidates snapshot and sets status to review
    const cEdit = createMockContext({
      user: mockUser,
      params: { id: batch._id.toString(), rowId: validDraftRow._id.toString() },
      body: {
        expectedRevision: 1,
        expectedVersion: validDraftRow.version,
        overrides: { major: 'Mathematics' },
      },
    });
    await patchDraftRow(cEdit as any);
    assert.strictEqual(cEdit._getResponse().status, 200);

    const postEditBatch = await Batch.findById(batch._id);
    assert.strictEqual(postEditBatch?.approvedSnapshotId, null, 'Row edit must clear approvedSnapshotId');
    assert.strictEqual(postEditBatch?.status, 'review', 'Row edit must revert batch status to review');

    const supersededSnapshot = await ApprovedSnapshot.findById(snapshot._id);
    assert.strictEqual(supersededSnapshot?.status, 'superseded', 'Prior approved snapshot must be marked superseded');

    // 2. Immutability: When batch is generating, patchDraftRow must reject with 409 CONFLICT
    await Batch.updateOne({ _id: batch._id }, { status: 'generating' });
    const cGeneratingEdit = createMockContext({
      user: mockUser,
      params: { id: batch._id.toString(), rowId: validDraftRow._id.toString() },
      body: {
        expectedRevision: 1,
        expectedVersion: validDraftRow.version + 1,
        overrides: { major: 'Physics' },
      },
    });
    await patchDraftRow(cGeneratingEdit as any);
    const generatingEditRes = cGeneratingEdit._getResponse();
    assert.strictEqual(generatingEditRes.status, 409, 'Editing row while batch is generating must return 409 Conflict');
    assert.strictEqual(
      generatingEditRes.data.error || generatingEditRes.data.code,
      'BATCH_GENERATION_IN_PROGRESS',
      'Must return BATCH_GENERATION_IN_PROGRESS error code'
    );

    // Reset batch status to review for subsequent tests
    await Batch.updateOne({ _id: batch._id }, { status: 'review' });
    console.log('   ✓ AC4 Passed: Post-approval row edit supersedes snapshot; generating batch rejects mutations with 409.\n');

    // -------------------------------------------------------------------------
    // AC5: Interrupted Snapshot Build Recovers Without Duplicate Recipients
    // -------------------------------------------------------------------------
    console.log('--- Testing AC5: Interrupted Snapshot Build Idempotent Recovery ---');
    const interruptedSnapshot = await ApprovedSnapshot.create({
      batchId: batch._id,
      ownerId: testUserId,
      templateId: template._id,
      templateVersionId: templateVersion._id,
      templateVersion: 1,
      templateSourceChecksum: 'test_checksum',
      mappingHash,
      importRevision: 1,
      retentionHours: 168,
      expiresAt: new Date(Date.now() + 168 * 3600 * 1000),
      canonicalDigest: 'partial_digest',
      totalRecipients: 7,
      idempotencyKey: 'idemp_key_interrupted_test',
      status: 'building',
    });

    // Simulate crash after partial recipient ingestion: insert 2 recipients
    await ApprovedRecipient.create([
      {
        snapshotId: interruptedSnapshot._id,
        batchId: batch._id,
        ownerId: testUserId,
        recipientKey: 'rec_1',
        sourceRowNumber: 1,
        effectiveData: { studentId: 'STU_001', studentName: 'Alice Smith', major: 'Computer Science' },
        overrides: {},
        digest: 'row_1_digest',
        status: 'valid',
      },
      {
        snapshotId: interruptedSnapshot._id,
        batchId: batch._id,
        ownerId: testUserId,
        recipientKey: 'rec_2',
        sourceRowNumber: 2,
        effectiveData: { studentId: 'STU_001', studentName: 'Alice Smith', major: 'Computer Science' },
        overrides: {},
        digest: 'row_2_digest',
        status: 'valid',
      },
    ]);

    // Re-trigger approval with same idempotency key to test recovery
    const cRecover = createMockContext({
      user: mockUser,
      params: { id: batch._id.toString() },
      body: {
        expectedBatchVersion: postEditBatch?.version,
        expectedTemplateVersion: 1,
        expectedImportRevision: 1,
        retentionHours: 168,
        idempotencyKey: 'idemp_key_interrupted_test',
      },
    });
    await approveBatch(cRecover as any);
    const recoverRes = cRecover._getResponse();
    assert.strictEqual(recoverRes.status, 200, 'Build recovery must return 200 OK');

    const recoveredSnapshot = await ApprovedSnapshot.findById(interruptedSnapshot._id);
    assert.strictEqual(recoveredSnapshot?.status, 'ready', 'Recovered snapshot must reach ready status');

    const totalRecipients = await ApprovedRecipient.countDocuments({ snapshotId: interruptedSnapshot._id });
    assert.strictEqual(totalRecipients, 7, 'Recovery must produce exactly 7 recipients with zero duplicates');
    console.log('   ✓ AC5 Passed: Interrupted snapshot build recovers cleanly without duplicate recipient records.\n');

    // -------------------------------------------------------------------------
    // AC6: Optimistic Concurrency & Idempotency Key
    // -------------------------------------------------------------------------
    console.log('--- Testing AC6: Optimistic Concurrency & Idempotency ---');
    // 1. Duplicate approval with same idempotencyKey returns same snapshot
    const cIdemp1 = createMockContext({
      user: mockUser,
      params: { id: batch._id.toString() },
      body: {
        expectedBatchVersion: (await Batch.findById(batch._id))?.version,
        expectedTemplateVersion: 1,
        expectedImportRevision: 1,
        retentionHours: 168,
        idempotencyKey: 'idemp_key_ac6_repeat',
      },
    });
    await approveBatch(cIdemp1 as any);
    const idemp1Res = cIdemp1._getResponse();
    assert.strictEqual(idemp1Res.status, 200);

    const cIdemp2 = createMockContext({
      user: mockUser,
      params: { id: batch._id.toString() },
      body: {
        expectedBatchVersion: (await Batch.findById(batch._id))?.version,
        expectedTemplateVersion: 1,
        expectedImportRevision: 1,
        retentionHours: 168,
        idempotencyKey: 'idemp_key_ac6_repeat',
      },
    });
    await approveBatch(cIdemp2 as any);
    const idemp2Res = cIdemp2._getResponse();
    assert.strictEqual(idemp2Res.status, 200);
    assert.strictEqual(
      idemp1Res.data.snapshot._id.toString(),
      idemp2Res.data.snapshot._id.toString(),
      'Identical idempotencyKey must return the existing snapshot'
    );

    // 2. Stale expectedBatchVersion returns 409
    const cStaleBatch = createMockContext({
      user: mockUser,
      params: { id: batch._id.toString() },
      body: {
        expectedBatchVersion: 99999, // Stale version
        expectedTemplateVersion: 1,
        expectedImportRevision: 1,
        retentionHours: 168,
        idempotencyKey: 'idemp_key_stale_batch',
      },
    });
    await approveBatch(cStaleBatch as any);
    assert.strictEqual(cStaleBatch._getResponse().status, 409, 'Stale expectedBatchVersion must return 409 Conflict');

    // 3. Stale expectedTemplateVersion returns 409
    const cStaleTemplate = createMockContext({
      user: mockUser,
      params: { id: batch._id.toString() },
      body: {
        expectedBatchVersion: (await Batch.findById(batch._id))?.version,
        expectedTemplateVersion: 99999, // Stale template version
        expectedImportRevision: 1,
        retentionHours: 168,
        idempotencyKey: 'idemp_key_stale_template',
      },
    });
    await approveBatch(cStaleTemplate as any);
    assert.strictEqual(cStaleTemplate._getResponse().status, 409, 'Stale expectedTemplateVersion must return 409 Conflict');
    console.log('   ✓ AC6 Passed: Idempotent re-approval confirmed; stale batch and template versions rejected with 409.\n');

    // -------------------------------------------------------------------------
    // AC7: Invalid Rows Excluded (Only Valid Rows Sealed)
    // -------------------------------------------------------------------------
    console.log('--- Testing AC7: Invalid Rows Excluded from Approved Recipients ---');
    const sealedRecipients = await ApprovedRecipient.find({ snapshotId: idemp1Res.data.snapshot._id });
    const sealedSourceRowNumbers = sealedRecipients.map((r) => r.sourceRowNumber);

    // Rows 4, 8, 9 were invalid and must be excluded
    assert.strictEqual(sealedRecipients.length, 7, 'Only the 7 valid rows must be sealed into ApprovedRecipient');
    assert.ok(!sealedSourceRowNumbers.includes(4), 'Invalid row 4 must NOT be in ApprovedRecipient');
    assert.ok(!sealedSourceRowNumbers.includes(8), 'Invalid row 8 must NOT be in ApprovedRecipient');
    assert.ok(!sealedSourceRowNumbers.includes(9), 'Invalid row 9 must NOT be in ApprovedRecipient');

    // Valid rows must be present
    assert.ok(sealedSourceRowNumbers.includes(1), 'Valid row 1 must be present');
    assert.ok(sealedSourceRowNumbers.includes(2), 'Valid row 2 must be present');
    assert.ok(sealedSourceRowNumbers.includes(3), 'Valid row 3 must be present');
    console.log('   ✓ AC7 Passed: Invalid rows are strictly excluded while valid rows proceed into snapshot.\n');

    // -------------------------------------------------------------------------
    // AC8: Cross-Tenant Isolation
    // -------------------------------------------------------------------------
    console.log('--- Testing AC8: Cross-Tenant Isolation ---');
    const attackerUser = { id: `attacker_${Date.now()}`, email: 'attacker@example.com' };

    // 1. Attacker preflight query on victim batch -> 404
    const cAttackerPreflight = createMockContext({
      user: attackerUser,
      params: { id: batch._id.toString() },
    });
    await getApprovalPreflight(cAttackerPreflight as any);
    assert.strictEqual(cAttackerPreflight._getResponse().status, 404, 'Attacker preflight request must return 404');

    // 2. Attacker approval call on victim batch -> 404
    const cAttackerApprove = createMockContext({
      user: attackerUser,
      params: { id: batch._id.toString() },
      body: {
        expectedBatchVersion: 1,
        expectedTemplateVersion: 1,
        expectedImportRevision: 1,
        retentionHours: 168,
        idempotencyKey: 'attacker_key',
      },
    });
    await approveBatch(cAttackerApprove as any);
    assert.strictEqual(cAttackerApprove._getResponse().status, 404, 'Attacker approval request must return 404');
    console.log('   ✓ AC8 Passed: Cross-tenant access strictly blocked with 404 Not Found.\n');

    console.log('===========================================================');
    console.log('🎉 ALL PRD-CORE-06 ACCEPTANCE CRITERIA (AC1 - AC8) PASSED!');
    console.log('===========================================================');
  } finally {
    // Teardown test fixtures
    if (batch) {
      await DraftRow.deleteMany({ batchId: batch._id });
      await BatchImport.deleteMany({ batchId: batch._id });
      await ApprovedSnapshot.deleteMany({ batchId: batch._id }).catch(() => {});
      await ApprovedRecipient.deleteMany({ batchId: batch._id }).catch(() => {});
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
