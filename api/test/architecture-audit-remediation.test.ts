import 'dotenv/config';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { Template } from '../src/models/Template.js';
import { TemplateVersion, IFieldMapping } from '../src/models/TemplateVersion.js';
import { Batch } from '../src/models/Batch.js';
import { BatchImport } from '../src/models/BatchImport.js';
import { DraftRow } from '../src/models/DraftRow.js';
import {
  TemplateLifecycle,
  TemplateCascadeConfirmationRequiredError,
  TemplateValidationError,
  computeMappingHash,
} from '../src/services/template-lifecycle.js';
import { BatchIntake } from '../src/services/batch-intake.js';
import { deleteTemplate as deleteTemplateController } from '../src/controllers/templates.controller.js';
import {
  deleteBatch as deleteBatchController,
  isTransactionUnsupportedError,
} from '../src/controllers/batches.controller.js';

function createMockContext({ user, params = {}, query = {}, body = null, headers = {} }: any) {
  let responseData: any = null;
  let responseStatus = 200;
  return {
    get: (key: string) => (key === 'user' ? user : undefined),
    req: {
      param: (key?: string) => (key ? params[key] : params),
      query: (key?: string) => (key ? query[key] : query),
      header: (name: string) => headers[name.toLowerCase()] || headers[name] || '',
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
  console.log('🧪 Starting Architecture Audit Remediation Test Suite...\n');

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { dbName: 'emitdocs_test' });
  console.log('   ✓ Connected to test database\n');

  const testOwner = `remediation_owner_${Date.now()}`;
  const mockUser = { id: testOwner, email: 'remediation@example.com' };

  try {
    const sampleFieldMappings: IFieldMapping[] = [
    {
      id: 'f1',
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
    },
    {
      id: 'f2',
      key: 'email',
      type: 'text',
      pageIndex: 0,
      rect: { x: 50, y: 150, width: 200, height: 30 },
      alignment: 'left',
      fontFamily: 'Helvetica',
      fontSize: 12,
      minFontSize: 8,
      maxFontSize: 16,
      color: '#000000',
      fitMode: 'shrink-to-fit',
      maskMode: 'none',
    },
  ];

  // =========================================================================
  // Requirement 1: Permanent template deletion removes Template and Version
  // =========================================================================
  console.log('1. Testing permanent template deletion removes Template and TemplateVersion docs...');
  const t1 = await Template.create({ ownerId: testOwner, name: 'Perm Delete Test' });
  const v1 = await TemplateVersion.create({
    templateId: t1._id,
    ownerId: testOwner,
    version: 1,
    sourceObjectKey: `templates/${testOwner}/doc1.pdf`,
    bytes: 1024,
    pageCount: 1,
    status: 'active',
    fieldMappings: sampleFieldMappings,
    mappingHash: computeMappingHash(sampleFieldMappings),
  });
  t1.currentVersionId = v1._id as any;
  await t1.save();

  const delRes1 = await TemplateLifecycle.deleteTemplate({ templateId: t1._id, ownerId: testOwner });
  assert.strictEqual(delRes1.success, true);

  const t1Doc = await Template.findById(t1._id);
  assert.strictEqual(t1Doc, null, 'Template must be permanently removed from MongoDB');

  const v1Docs = await TemplateVersion.find({ templateId: t1._id });
  assert.strictEqual(v1Docs.length, 0, 'Associated TemplateVersions must be permanently removed');
  console.log('   ✓ Permanent template & version deletion verified\n');

  // =========================================================================
  // Requirement 2: Deleting template with dependent batches returns 409
  // =========================================================================
  console.log('2. Testing delete template with dependent batches requires cascade confirmation (409)...');
  const t2 = await Template.create({ ownerId: testOwner, name: 'Template With Batch' });
  const v2 = await TemplateVersion.create({
    templateId: t2._id,
    ownerId: testOwner,
    version: 1,
    sourceObjectKey: `templates/${testOwner}/doc2.pdf`,
    bytes: 2048,
    pageCount: 1,
    status: 'active',
    fieldMappings: sampleFieldMappings,
    mappingHash: computeMappingHash(sampleFieldMappings),
  });
  t2.currentVersionId = v2._id as any;
  await t2.save();

  const b2 = await Batch.create({
    ownerId: testOwner,
    templateId: t2._id,
    templateVersionId: v2._id,
    name: 'Dependent Batch 1',
    status: 'draft',
    currentImportRevision: 0,
    totalRows: 5,
  });

  // 2a. Domain service throws TemplateCascadeConfirmationRequiredError
  await assert.rejects(
    async () => TemplateLifecycle.deleteTemplate({ templateId: t2._id, ownerId: testOwner }),
    (err: any) => {
      assert.strictEqual(err instanceof TemplateCascadeConfirmationRequiredError, true);
      assert.strictEqual(err.code, 'CASCADE_CONFIRMATION_REQUIRED');
      assert.strictEqual(err.dependentBatchesCount, 1);
      assert.strictEqual(err.dependentBatches[0]._id.toString(), b2._id.toString());
      return true;
    }
  );

  // 2b. Controller returns HTTP 409 with structured payload
  const ctrlCtx409 = createMockContext({
    user: mockUser,
    params: { id: t2._id.toString() },
  });
  await deleteTemplateController(ctrlCtx409 as any);
  const resp409 = ctrlCtx409._getResponse();
  assert.strictEqual(resp409.status, 409);
  assert.strictEqual(resp409.data.error, 'CASCADE_CONFIRMATION_REQUIRED');
  assert.strictEqual(resp409.data.requiresConfirmation, true);
  assert.strictEqual(resp409.data.dependentBatchesCount, 1);
  assert.strictEqual(resp409.data.dependentBatches[0].name, 'Dependent Batch 1');
  console.log('   ✓ 409 CASCADE_CONFIRMATION_REQUIRED error payload verified\n');

  // 2c. Deleting template when dependent batch is in 'generating' status throws TemplateValidationError (HTTP 400)
  b2.status = 'generating';
  await b2.save();

  await assert.rejects(
    async () => TemplateLifecycle.deleteTemplate({ templateId: t2._id, ownerId: testOwner }),
    (err: any) => {
      assert.strictEqual(err instanceof TemplateValidationError, true);
      assert.strictEqual(err.code, 'BATCH_GENERATING');
      assert.ok(err.message.includes('generating'));
      return true;
    }
  );

  await assert.rejects(
    async () => TemplateLifecycle.deleteTemplate({ templateId: t2._id, ownerId: testOwner, confirmCascade: true }),
    (err: any) => {
      assert.strictEqual(err instanceof TemplateValidationError, true);
      assert.strictEqual(err.code, 'BATCH_GENERATING');
      return true;
    }
  );

  const ctrlCtxGen = createMockContext({
    user: mockUser,
    params: { id: t2._id.toString() },
    query: { confirmCascade: 'true' },
  });
  await deleteTemplateController(ctrlCtxGen as any);
  const respGen = ctrlCtxGen._getResponse();
  assert.strictEqual(respGen.status, 400);
  assert.ok(respGen.data.error.includes('generating'));
  assert.ok((await Template.findById(t2._id)) !== null, 'Template must not be deleted');

  // Reset b2 status to draft for cascade deletion test
  b2.status = 'draft';
  await b2.save();

  // =========================================================================
  // Requirement 3: Deleting template with confirmCascade=true cascades cleanup
  // =========================================================================
  console.log('3. Testing delete template with confirmCascade=true permanently deletes template, batches, imports, rows in transaction...');
  const imp2 = await BatchImport.create({
    batchId: b2._id,
    ownerId: testOwner,
    revision: 1,
    sourceFileName: 'data.csv',
    sourceFileSize: 500,
    status: 'completed',
  });

  await DraftRow.create({
    batchId: b2._id,
    importId: imp2._id,
    ownerId: testOwner,
    revision: 1,
    rowKey: 'row_1',
    sourceRowNumber: 1,
    importedData: { Name: 'Alice', Email: 'alice@example.com' },
    effectiveData: { studentName: 'Alice', email: 'alice@example.com' },
    status: 'valid',
  });

  const delCascadeRes = await TemplateLifecycle.deleteTemplate({
    templateId: t2._id,
    ownerId: testOwner,
    confirmCascade: true,
  });
  assert.strictEqual(delCascadeRes.success, true);
  assert.strictEqual(delCascadeRes.deletedBatchesCount, 1);

  // Verify all entities permanently gone
  assert.strictEqual(await Template.findById(t2._id), null);
  assert.strictEqual((await TemplateVersion.find({ templateId: t2._id })).length, 0);
  assert.strictEqual(await Batch.findById(b2._id), null);
  assert.strictEqual((await BatchImport.find({ batchId: b2._id })).length, 0);
  assert.strictEqual((await DraftRow.find({ batchId: b2._id })).length, 0);

  // 3b. Verify transaction rollback prevents partial commit if an operation fails
  const tRollback = await Template.create({ ownerId: testOwner, name: 'Rollback Template' });
  const vRollback = await TemplateVersion.create({
    templateId: tRollback._id,
    ownerId: testOwner,
    version: 1,
    sourceObjectKey: `templates/${testOwner}/doc_rb.pdf`,
    bytes: 1024,
    pageCount: 1,
    status: 'active',
    fieldMappings: sampleFieldMappings,
    mappingHash: computeMappingHash(sampleFieldMappings),
  });
  tRollback.currentVersionId = vRollback._id as any;
  await tRollback.save();

  const bRollback = await Batch.create({
    ownerId: testOwner,
    templateId: tRollback._id,
    templateVersionId: vRollback._id,
    name: 'Rollback Batch',
    status: 'draft',
    currentImportRevision: 0,
    totalRows: 1,
  });

  const impRollback = await BatchImport.create({
    batchId: bRollback._id,
    ownerId: testOwner,
    revision: 1,
    sourceFileName: 'data.csv',
    sourceFileSize: 100,
    status: 'completed',
  });

  await DraftRow.create({
    batchId: bRollback._id,
    importId: impRollback._id,
    ownerId: testOwner,
    revision: 1,
    rowKey: 'row_rb',
    sourceRowNumber: 1,
    importedData: { Name: 'Alice' },
    status: 'valid',
  });

  const originalDeleteOne = Template.deleteOne;
  Template.deleteOne = (async (..._args: any[]) => {
    throw new Error('SIMULATED_TRANSACTION_FAILURE');
  }) as any;

  try {
    await assert.rejects(
      async () =>
        TemplateLifecycle.deleteTemplate({
          templateId: tRollback._id,
          ownerId: testOwner,
          confirmCascade: true,
        }),
      (err: any) => err.message === 'SIMULATED_TRANSACTION_FAILURE'
    );

    // Verify nothing partially committed (all records intact)
    assert.ok(await Template.findById(tRollback._id));
    assert.ok(await TemplateVersion.findById(vRollback._id));
    assert.ok(await Batch.findById(bRollback._id));
    assert.ok(await BatchImport.findById(impRollback._id));
    assert.strictEqual((await DraftRow.find({ batchId: bRollback._id })).length, 1);
  } finally {
    Template.deleteOne = originalDeleteOne;
    // Clean up rollback fixtures
    await DraftRow.deleteMany({ batchId: bRollback._id });
    await BatchImport.deleteMany({ batchId: bRollback._id });
    await Batch.deleteOne({ _id: bRollback._id });
    await TemplateVersion.deleteMany({ templateId: tRollback._id });
    await Template.deleteOne({ _id: tRollback._id });
  }

  console.log('   ✓ Full cascade permanent deletion and transactional rollback verified\n');

  // =========================================================================
  // Requirement 4: Deleting batch in 'generating' status returns 400
  // =========================================================================
  console.log('4. Testing deleteBatch in generating status returns HTTP 400...');
  const t3 = await Template.create({ ownerId: testOwner, name: 'Template 3' });
  const v3 = await TemplateVersion.create({
    templateId: t3._id,
    ownerId: testOwner,
    version: 1,
    sourceObjectKey: `templates/${testOwner}/doc3.pdf`,
    bytes: 1024,
    pageCount: 1,
    status: 'active',
    fieldMappings: sampleFieldMappings,
    mappingHash: computeMappingHash(sampleFieldMappings),
  });
  t3.currentVersionId = v3._id as any;
  await t3.save();

  const bGenerating = await Batch.create({
    ownerId: testOwner,
    templateId: t3._id,
    templateVersionId: v3._id,
    name: 'Generating Batch',
    status: 'generating',
    currentImportRevision: 0,
    totalRows: 10,
  });

  const delGenCtx = createMockContext({
    user: mockUser,
    params: { id: bGenerating._id.toString() },
  });
  await deleteBatchController(delGenCtx as any);
  const delGenResp = delGenCtx._getResponse();
  assert.strictEqual(delGenResp.status, 400);
  assert.ok(delGenResp.data.error.includes('generating'));
  assert.ok((await Batch.findById(bGenerating._id)) !== null, 'Batch must not be deleted');
  console.log('   ✓ Generating batch deletion blocked with 400\n');

  // =========================================================================
  // Requirement 5: Deleting batch permanently removes Batch, BatchImport, DraftRow
  // =========================================================================
  console.log('5. Testing deleteBatch permanently deletes Batch, BatchImport, and DraftRow...');
  bGenerating.status = 'draft';
  await bGenerating.save();

  const bImp = await BatchImport.create({
    batchId: bGenerating._id,
    ownerId: testOwner,
    revision: 1,
    sourceFileName: 'test.csv',
    sourceFileSize: 256,
  });

  await DraftRow.create({
    batchId: bGenerating._id,
    importId: bImp._id,
    ownerId: testOwner,
    revision: 1,
    rowKey: 'row_1',
    sourceRowNumber: 1,
    importedData: { Name: 'Bob' },
  });

  const delBatchCtx = createMockContext({
    user: mockUser,
    params: { id: bGenerating._id.toString() },
  });
  await deleteBatchController(delBatchCtx as any);
  const delBatchResp = delBatchCtx._getResponse();
  assert.strictEqual(delBatchResp.status, 200);

  assert.strictEqual(await Batch.findById(bGenerating._id), null);
  assert.strictEqual((await BatchImport.find({ batchId: bGenerating._id })).length, 0);
  assert.strictEqual((await DraftRow.find({ batchId: bGenerating._id })).length, 0);
  console.log('   ✓ Permanent batch and child records deletion verified\n');

  // =========================================================================
  // Requirement 5b: isTransactionUnsupportedError helper classification
  // =========================================================================
  console.log('5b. Testing isTransactionUnsupportedError classification...');
  assert.strictEqual(isTransactionUnsupportedError({ code: 20 }), true);
  assert.strictEqual(isTransactionUnsupportedError({ codeName: 'IllegalOperation' }), true);
  assert.strictEqual(isTransactionUnsupportedError({ code: 263 }), true);
  assert.strictEqual(isTransactionUnsupportedError({ code: 148 }), true);
  assert.strictEqual(isTransactionUnsupportedError({ codeName: 'CommandNotSupported' }), true);
  assert.strictEqual(isTransactionUnsupportedError({ message: 'Transaction numbers are only allowed on a replica set member or mongos' }), true);
  assert.strictEqual(isTransactionUnsupportedError({ message: 'This MongoDB deployment does not support transactions' }), true);
  assert.strictEqual(isTransactionUnsupportedError({ message: 'sessions are not supported' }), true);
  assert.strictEqual(isTransactionUnsupportedError({ message: 'Standalone' }), true);
  assert.strictEqual(isTransactionUnsupportedError(new Error('WriteConflict')), false);
  assert.strictEqual(isTransactionUnsupportedError(new Error('Network timeout')), false);
  assert.strictEqual(isTransactionUnsupportedError(null), false);
  console.log('   ✓ isTransactionUnsupportedError classification verified\n');

  // =========================================================================
  // Requirement 5c: deleteBatch recovery path & atomic claiming
  // =========================================================================
  console.log('5c. Testing deleteBatch recovery path, atomic claiming, and fallback safety...');
  // 5c.1 Batch already claimed in 'deleting' (recovery path after partial child deletion)
  const bRecover = await Batch.create({
    ownerId: testOwner,
    templateId: t3._id,
    templateVersionId: v3._id,
    name: 'Recover Batch',
    status: 'deleting',
    currentImportRevision: 0,
    totalRows: 0,
  });
  const delRecoverCtx = createMockContext({
    user: mockUser,
    params: { id: bRecover._id.toString() },
  });
  await deleteBatchController(delRecoverCtx as any);
  assert.strictEqual(delRecoverCtx._getResponse().status, 200);
  assert.strictEqual(await Batch.findById(bRecover._id), null, 'Recovered batch deleted');

  // 5c.2 Unsupported transaction error triggers fallback, but child failure preserves batch
  const bFallback = await Batch.create({
    ownerId: testOwner,
    templateId: t3._id,
    templateVersionId: v3._id,
    name: 'Fallback Batch',
    status: 'draft',
    currentImportRevision: 0,
    totalRows: 0,
  });
  const impFallback = await BatchImport.create({
    batchId: bFallback._id,
    ownerId: testOwner,
    revision: 1,
    sourceFileName: 'fallback.csv',
    sourceFileSize: 128,
  });
  await DraftRow.create({
    batchId: bFallback._id,
    importId: impFallback._id,
    ownerId: testOwner,
    revision: 1,
    rowKey: 'row_fb',
    sourceRowNumber: 1,
    importedData: { Name: 'Carol' },
  });

  // Mock mongoose.startSession to throw code 20 (unsupported transaction)
  const originalStartSession = mongoose.startSession;
  mongoose.startSession = (async () => {
    const err: any = new Error('Transaction numbers are only allowed on a replica set member or mongos');
    err.code = 20;
    err.codeName = 'IllegalOperation';
    throw err;
  }) as any;

  // Simulate child deletion failure in fallback to verify recovery path preservation
  const originalDraftRowDeleteMany = DraftRow.deleteMany;
  DraftRow.deleteMany = (async (query: any, opts: any) => {
    if (!opts?.session) {
      throw new Error('SIMULATED_CHILD_CLEANUP_FAILURE');
    }
    return originalDraftRowDeleteMany.call(DraftRow, query, opts);
  }) as any;

  try {
    const delFailCtx = createMockContext({
      user: mockUser,
      params: { id: bFallback._id.toString() },
    });
    await deleteBatchController(delFailCtx as any);
    assert.strictEqual(delFailCtx._getResponse().status, 500);

    // Verify batch was NOT removed, preserving the recovery path!
    const batchStillExists = await Batch.findById(bFallback._id);
    assert.ok(batchStillExists !== null, 'Batch must remain in DB when child deletion fails');
  } finally {
    DraftRow.deleteMany = originalDraftRowDeleteMany;
  }

  // Now retry deletion with normal child cleanup (still on unsupported transaction mock)
  const delRetryCtx = createMockContext({
    user: mockUser,
    params: { id: bFallback._id.toString() },
  });
  await deleteBatchController(delRetryCtx as any);
  assert.strictEqual(delRetryCtx._getResponse().status, 200);
  assert.strictEqual(await Batch.findById(bFallback._id), null, 'Batch deleted after retry');
  assert.strictEqual((await BatchImport.find({ batchId: bFallback._id })).length, 0);
  assert.strictEqual((await DraftRow.find({ batchId: bFallback._id })).length, 0);

  // 5c.3 Non-unsupported transaction error does NOT execute fallback
  const bTxnError = await Batch.create({
    ownerId: testOwner,
    templateId: t3._id,
    templateVersionId: v3._id,
    name: 'Txn Error Batch',
    status: 'draft',
    currentImportRevision: 0,
    totalRows: 0,
  });
  mongoose.startSession = (async () => {
    throw new Error('TRANSACTION_WRITE_CONFLICT');
  }) as any;

  const delTxnErrorCtx = createMockContext({
    user: mockUser,
    params: { id: bTxnError._id.toString() },
  });
  await deleteBatchController(delTxnErrorCtx as any);
  assert.strictEqual(delTxnErrorCtx._getResponse().status, 500);
  assert.strictEqual(delTxnErrorCtx._getResponse().data.error, 'TRANSACTION_WRITE_CONFLICT');
  // Batch was not deleted by fallback
  assert.ok((await Batch.findById(bTxnError._id)) !== null);

  // Restore startSession and clean up bTxnError
  mongoose.startSession = originalStartSession;
  await Batch.deleteOne({ _id: bTxnError._id });

  console.log('   ✓ Fallback safety, recovery path, and error restriction verified\n');

  // =========================================================================
  // Requirement 6: finalizeImport executes single consolidated DraftRow.bulkWrite
  // =========================================================================
  console.log('6. Testing finalizeImport executes single consolidated DraftRow.bulkWrite...');
  const tIntake = await Template.create({ ownerId: testOwner, name: 'Intake Template' });
  const vIntake = await TemplateVersion.create({
    templateId: tIntake._id,
    ownerId: testOwner,
    version: 1,
    sourceObjectKey: `templates/${testOwner}/doc_intake.pdf`,
    bytes: 1024,
    pageCount: 1,
    status: 'active',
    fieldMappings: sampleFieldMappings,
    mappingHash: computeMappingHash(sampleFieldMappings),
  });
  tIntake.currentVersionId = vIntake._id as any;
  await tIntake.save();

  const bIntake = await Batch.create({
    ownerId: testOwner,
    templateId: tIntake._id,
    templateVersionId: vIntake._id,
    name: 'Intake Batch',
    status: 'draft',
    currentImportRevision: 0,
  });

  const impIntake = await BatchImport.create({
    batchId: bIntake._id,
    ownerId: testOwner,
    revision: 1,
    sourceFileName: 'names.csv',
    sourceFileSize: 100,
    columnMap: { studentName: 'Name', email: 'Email' },
    receivedChunkIds: ['chunk_1'],
    totalExpectedChunks: 1,
  });

  await DraftRow.create([
    {
      batchId: bIntake._id,
      importId: impIntake._id,
      ownerId: testOwner,
      revision: 1,
      rowKey: 'row_1',
      sourceRowNumber: 1,
      importedData: { Name: 'Charlie', Email: 'charlie@example.com' },
      effectiveData: {},
      status: 'valid',
    },
    {
      batchId: bIntake._id,
      importId: impIntake._id,
      ownerId: testOwner,
      revision: 1,
      rowKey: 'row_2',
      sourceRowNumber: 2,
      importedData: { Name: 'Charlie', Email: 'charlie@example.com' }, // duplicate
      effectiveData: {},
      status: 'valid',
    },
  ]);

  let bulkWriteCallCount = 0;
  const originalBulkWrite = DraftRow.bulkWrite;
  (DraftRow as any).bulkWrite = async function (...args: any[]) {
    bulkWriteCallCount++;
    return originalBulkWrite.apply(this, args as any);
  };

  try {
    const finRes = await BatchIntake.finalizeImport({
      batchId: bIntake._id,
      importId: impIntake._id,
      ownerId: testOwner,
      totalExpectedChunks: 1,
      totalExpectedRows: 2,
      promote: true,
    });

    assert.strictEqual(
      bulkWriteCallCount,
      1,
      `finalizeImport must call bulkWrite exactly once, but called ${bulkWriteCallCount} times`
    );
    assert.strictEqual(finRes.summary.totalRows, 2);
    assert.strictEqual(finRes.summary.duplicateRows, 1);

    const finalizedRows = await DraftRow.find({ batchId: bIntake._id, revision: 1 }).sort({
      sourceRowNumber: 1,
    });
    assert.strictEqual(finalizedRows[0].effectiveData.studentName, 'Charlie');
    assert.strictEqual(finalizedRows[0].isDuplicate, false);
    assert.strictEqual(finalizedRows[1].isDuplicate, true);
  } finally {
    DraftRow.bulkWrite = originalBulkWrite;
  }
  console.log('   ✓ Single consolidated bulkWrite in finalizeImport verified\n');

  // =========================================================================
  // Requirement 7: patchRowOverride executes selective duplicate bulkWrite
  // =========================================================================
  console.log('7. Testing patchRowOverride executes selective duplicate bulkWrite...');
  let selectiveBulkOpsRecorded: any[] = [];
  (DraftRow as any).bulkWrite = async function (ops: any[], ...rest: any[]) {
    selectiveBulkOpsRecorded = ops;
    return originalBulkWrite.apply(this, [ops, ...rest] as any);
  };

  try {
    const rows = await DraftRow.find({ batchId: bIntake._id, revision: 1 }).sort({
      sourceRowNumber: 1,
    });
    const rowToEdit = rows[1];

    // Change row 2 to 'Dave' (breaks duplicate relationship)
    await BatchIntake.patchRowOverride({
      batchId: bIntake._id,
      rowId: rowToEdit._id,
      ownerId: testOwner,
      overrides: { studentName: 'Dave' },
    });

    // Rows 1 and 2 duplicate status changed from true to false
    assert.ok(selectiveBulkOpsRecorded.length > 0);
    assert.ok(
      selectiveBulkOpsRecorded.length <= 2,
      'Only rows with modified warnings/duplicates should be written'
    );

    // Edit row 2 again to 'David' (neither row 1 nor row 2 changes duplicate status)
    selectiveBulkOpsRecorded = [];
    await BatchIntake.patchRowOverride({
      batchId: bIntake._id,
      rowId: rowToEdit._id,
      ownerId: testOwner,
      overrides: { studentName: 'David' },
    });

    // Since no row's isDuplicate, duplicateReferences, or warnings changed, selectiveBulkOps must be empty (0 bulkWrite calls)
    assert.strictEqual(
      selectiveBulkOpsRecorded.length,
      0,
      'No bulkWrite operations should execute when duplicates and warnings are unchanged'
    );
  } finally {
    DraftRow.bulkWrite = originalBulkWrite;
  }
  console.log('   ✓ Selective duplicate bulkWrite in patchRowOverride verified\n');

  // =========================================================================
  // Requirement 8: reconcileImportRevision executes batched bulkWrite updates
  // =========================================================================
  console.log(
    '8. Testing reconcileImportRevision executes batched updates instead of serial individual saves...'
  );
  const impNew = await BatchImport.create({
    batchId: bIntake._id,
    ownerId: testOwner,
    revision: 2,
    sourceFileName: 'names_v2.csv',
    sourceFileSize: 120,
    columnMap: { studentName: 'Name', email: 'Email' },
    receivedChunkIds: ['chunk_v2'],
    totalExpectedChunks: 1,
    status: 'completed',
  });

  await DraftRow.create([
    {
      batchId: bIntake._id,
      importId: impNew._id,
      ownerId: testOwner,
      revision: 2,
      rowKey: 'row_1',
      sourceRowNumber: 1,
      importedData: { Name: 'Charlie New', Email: 'charlie@example.com' },
      effectiveData: { studentName: 'Charlie New', email: 'charlie@example.com' },
      status: 'valid',
      version: 1,
    },
    {
      batchId: bIntake._id,
      importId: impNew._id,
      ownerId: testOwner,
      revision: 2,
      rowKey: 'row_2',
      sourceRowNumber: 2,
      importedData: { Name: 'David', Email: 'david@example.com' },
      effectiveData: { studentName: 'David', email: 'david@example.com' },
      status: 'valid',
      version: 1,
    },
  ]);

  let draftRowSaveCallCount = 0;
  const originalSave = DraftRow.prototype.save;
  (DraftRow.prototype as any).save = async function (...args: any[]) {
    draftRowSaveCallCount++;
    return originalSave.apply(this, args as any);
  };

  try {
    const recRes = await BatchIntake.reconcileImportRevision({
      batchId: bIntake._id,
      importId: impNew._id,
      ownerId: testOwner,
      reconciliationKey: 'studentName',
      resolutions: { carryForwardOverrides: true },
    });

    assert.strictEqual(
      draftRowSaveCallCount,
      0,
      `reconcileImportRevision must not call DraftRow.prototype.save in a loop (called ${draftRowSaveCallCount} times)`
    );
    assert.strictEqual(recRes.batch.currentImportRevision, 2);
  } finally {
    DraftRow.prototype.save = originalSave;
  }
  console.log('   ✓ Batched updates in reconcileImportRevision verified\n');
  console.log('🎉 ALL ARCHITECTURE AUDIT REMEDIATION TESTS PASSED CLEANLY!\n');
  } finally {
    // Cleanup fixtures
    await Template.deleteMany({ ownerId: testOwner });
    await TemplateVersion.deleteMany({ ownerId: testOwner });
    await Batch.deleteMany({ ownerId: testOwner });
    await BatchImport.deleteMany({ ownerId: testOwner });
    await DraftRow.deleteMany({ ownerId: testOwner });
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
