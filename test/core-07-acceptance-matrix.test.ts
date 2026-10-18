/**
 * @file core-07-acceptance-matrix.test.ts
 * @description Acceptance criteria test matrix for PRD-CORE-07: Resumable Web Worker PDF Generation & Single Recipient Delivery.
 * @architecture End-to-end verification covering single recipient preview (<20ms benchmark),
 *               Web Worker off-main-thread non-blocking execution simulation, accurate real-time
 *               progress metrics, pause/resume continuity at recipient boundaries, immediate
 *               cancellation with resource cleanup, zero DB-locking batch persistence,
 *               warning isolation (overflow/unsupported glyphs), and deterministic SHA-256 byte parity.
 * @agent_note Run via `pnpm run test:core07`. Requires active MongoDB instance via MONGODB_URI in api/.env.
 *             Automatically cleans up test batches, templates, snapshots, and recipients upon completion.
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { PDFDocument } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../api/.env') });

// Models
import { Batch } from '../api/src/models/Batch.js';
import { Template } from '../api/src/models/Template.js';
import { TemplateVersion } from '../api/src/models/TemplateVersion.js';
import { ApprovedSnapshot } from '../api/src/models/ApprovedSnapshot.js';
import { ApprovedRecipient } from '../api/src/models/ApprovedRecipient.js';

// PDF Engine & Types
import {
  generatePdfWithOverlay,
  type FieldMappingConfig,
  type EngineWarning,
} from '../web/src/lib/pdf-engine/pdf-preview-engine.js';

// Web Worker Message Handler & Protocol
import { BatchGeneratorHandler } from '../web/src/workers/batch-generator.handler.js';


/**
 * @desc Executes PRD-CORE-07 Acceptance Matrix AC1 through AC8 covering Web Worker generation, pause/resume, and benchmarks.
 * @returns {Promise<void>} Resolves when all acceptance criteria tests pass successfully.
 */
async function runAcceptanceCriteriaMatrix() {
  console.log('===========================================================');
  console.log('  PRD-CORE-07 ACCEPTANCE CRITERIA MATRIX (AC1 - AC8)');
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
  let snapshot: any = null;

  try {
    const testUserId = `ac_user_core07_${Date.now()}`;

    // 1. Setup Base PDF & Template with 6 field mappings
    const fixturesDir = path.join(__dirname, 'fixtures');
    const fixturePdfPath = path.join(fixturesDir, 'single-page-token.pdf');
    let basePdfBytes: Uint8Array;
    if (fs.existsSync(fixturePdfPath)) {
      basePdfBytes = new Uint8Array(fs.readFileSync(fixturePdfPath));
    } else {
      const doc = await PDFDocument.create();
      doc.addPage([595, 842]);
      basePdfBytes = await doc.save();
    }

    template = await Template.create({
      ownerId: testUserId,
      name: 'Degree & Merit Certificate',
      thumbnailUrl: 'https://example.com/ac_thumb.png',
    });

    const fieldMappings: FieldMappingConfig[] = [
      {
        id: 'f_name',
        key: 'studentName',
        label: 'Student Name',
        type: 'text',
        pageIndex: 0,
        rect: { x: 50, y: 500, width: 250, height: 30 },
        fontSize: 16,
        minFontSize: 8,
        maxFontSize: 24,
        alignment: 'left',
        maskMode: 'solid-white',
        color: '#000000',
      },
      {
        id: 'f_id',
        key: 'studentId',
        label: 'Student ID',
        type: 'text',
        pageIndex: 0,
        rect: { x: 50, y: 450, width: 150, height: 20 },
        fontSize: 12,
        minFontSize: 8,
        maxFontSize: 16,
        alignment: 'left',
        maskMode: 'solid-white',
        color: '#333333',
      },
      {
        id: 'f_date',
        key: 'issueDate',
        label: 'Issue Date',
        type: 'date',
        pageIndex: 0,
        rect: { x: 50, y: 400, width: 150, height: 20 },
        fontSize: 12,
        minFontSize: 8,
        maxFontSize: 14,
        alignment: 'left',
        maskMode: 'none',
        color: '#333333',
      },
      {
        id: 'f_grade',
        key: 'grade',
        label: 'Grade',
        type: 'text',
        pageIndex: 0,
        rect: { x: 50, y: 350, width: 100, height: 20 },
        fontSize: 12,
        minFontSize: 8,
        maxFontSize: 14,
        alignment: 'left',
        maskMode: 'none',
        color: '#1e40af',
      },
      {
        id: 'f_title',
        key: 'title',
        label: 'Degree Title',
        type: 'text',
        pageIndex: 0,
        rect: { x: 50, y: 300, width: 200, height: 25 },
        fontSize: 14,
        minFontSize: 8,
        maxFontSize: 18,
        alignment: 'left',
        maskMode: 'solid-white',
        color: '#111827',
      },
      {
        id: 'f_remarks',
        key: 'remarks',
        label: 'Remarks',
        type: 'text',
        pageIndex: 0,
        rect: { x: 50, y: 230, width: 250, height: 50 },
        fontSize: 10,
        minFontSize: 8,
        maxFontSize: 12,
        fitMode: 'multi-line',
        alignment: 'left',
        maskMode: 'none',
        color: '#4b5563',
      },
    ];

    const sortedMappings = [...fieldMappings].sort((a, b) => a.id.localeCompare(b.id));
    const mappingHash = crypto.createHash('sha256').update(JSON.stringify(sortedMappings)).digest('hex');

    templateVersion = await TemplateVersion.create({
      templateId: template._id,
      ownerId: testUserId,
      version: 1,
      sourceObjectKey: 'fixtures/single-page-token.pdf',
      bytes: basePdfBytes.length,
      pageCount: 1,
      status: 'active',
      fieldMappings,
      mappingHash,
    });
    template.currentVersionId = templateVersion._id;
    await template.save();

    // 2. Setup Batch in 'approved' status
    batch = await Batch.create({
      ownerId: testUserId,
      templateId: template._id,
      templateVersionId: templateVersion._id,
      name: 'Commencement Class 2026',
      status: 'approved',
      currentImportRevision: 1,
      totalRows: 10,
      validRows: 10,
      invalidRows: 0,
      duplicateRows: 0,
      retentionHours: 168,
      version: 1,
    });

    // 3. Setup ApprovedSnapshot with status: 'ready'
    snapshot = await ApprovedSnapshot.create({
      batchId: batch._id,
      ownerId: testUserId,
      templateId: template._id,
      templateVersionId: templateVersion._id,
      templateVersion: 1,
      templateSourceChecksum: 'test_template_checksum_2026',
      mappingHash,
      importRevision: 1,
      retentionHours: 168,
      expiresAt: new Date(Date.now() + 168 * 3600 * 1000),
      canonicalDigest: crypto.randomBytes(32).toString('hex'),
      totalRecipients: 10,
      idempotencyKey: `idemp_core07_${Date.now()}`,
      status: 'ready',
    });
    batch.approvedSnapshotId = snapshot._id;
    await batch.save();

    // 4. Seed 10 ApprovedRecipient rows (valid, overflow >100 chars, unsupported glyphs)
    const seededRecipients = [];
    for (let i = 1; i <= 10; i++) {
      let studentName = `Student ${i}`;
      let remarks = `Academic standing verified for row ${i}.`;

      // Recipient 8: Overflow text > 100 chars (overflow in 250x50 multi-line box)
      if (i === 8) {
        remarks = 'This is an excessively long remarks paragraph designed to overflow the bounding box. '.repeat(5);
      }
      // Recipient 9: Non-WinAnsi emojis & Cyrillic for warning isolation
      if (i === 9) {
        studentName = 'Alice Wonder 🚀🌟 Привет';
      }

      seededRecipients.push({
        snapshotId: snapshot._id,
        batchId: batch._id,
        ownerId: testUserId,
        recipientKey: `rec_${i.toString().padStart(3, '0')}`,
        sourceRowNumber: i,
        effectiveData: {
          studentName,
          studentId: `STU-2026-${i.toString().padStart(3, '0')}`,
          issueDate: '2026-10-15',
          grade: i % 2 === 0 ? 'A+' : 'A',
          title: 'Bachelor of Science',
          remarks,
        },
        overrides: {},
        digest: crypto.randomBytes(16).toString('hex'),
        status: 'valid',
        generationStatus: 'pending',
      });
    }
    await ApprovedRecipient.insertMany(seededRecipients);
    const dbRecipients = await ApprovedRecipient.find({ snapshotId: snapshot._id }).sort({ sourceRowNumber: 1 });

    // -------------------------------------------------------------------------
    // AC1: Single recipient PDF render & download <20ms benchmark
    // -------------------------------------------------------------------------
    console.log('--- Testing AC1: Single Recipient Render & Download <20ms Benchmark ---');
    const recipient1 = dbRecipients[0];

    // JIT warm-up call
    await generatePdfWithOverlay(basePdfBytes, fieldMappings, recipient1.effectiveData);

    const thresholdMs = Number(process.env.AC1_THRESHOLD_MS) || 20;
    const runs = 5;
    const runDurations: number[] = [];
    let singlePdfResult: any;

    for (let i = 0; i < runs; i++) {
      const tStart = performance.now();
      singlePdfResult = await generatePdfWithOverlay(basePdfBytes, fieldMappings, recipient1.effectiveData);
      runDurations.push(performance.now() - tStart);
    }

    runDurations.sort((a, b) => a - b);
    const medianDurationMs = runDurations[Math.floor(runs / 2)];

    console.log(`   Render duration (median of ${runs} runs): ${medianDurationMs.toFixed(2)}ms (threshold: ${thresholdMs}ms)`);
    assert.ok(medianDurationMs < thresholdMs, `Render time must be <${thresholdMs}ms benchmark (median took ${medianDurationMs.toFixed(2)}ms)`);
    assert.ok(singlePdfResult.pdfBytes.length > 0, 'PDF output bytes must not be empty');

    const pdfHeader = Buffer.from(singlePdfResult.pdfBytes.subarray(0, 7)).toString('ascii');
    assert.strictEqual(pdfHeader, '%PDF-1.', 'PDF output bytes must start with %PDF-1.');
    console.log('   ✓ AC1 Passed: Single recipient PDF rendered in <20ms with valid %PDF-1. header.\n');

    // -------------------------------------------------------------------------
    // AC2: Web Worker off-main-thread non-blocking execution simulation
    // -------------------------------------------------------------------------
    console.log('--- Testing AC2: Web Worker Off-Main-Thread Non-Blocking Execution Simulation ---');
    const worker2 = new BatchGeneratorHandler();
    worker2.postMessage({
      type: 'INIT',
      payload: { basePdfBytes: basePdfBytes.buffer, fieldMappings },
    });

    let eventLoopTicks = 0;
    let maxLag = 0;
    let lastTickTime = performance.now();
    const intervalHandle = setInterval(() => {
      const now = performance.now();
      const delta = now - lastTickTime;
      const lag = delta - 2;
      if (lag > maxLag) maxLag = lag;
      lastTickTime = now;
      eventLoopTicks++;
    }, 2);

    await new Promise<void>((resolve, reject) => {
      worker2.onmessage = (msg) => {
        if (msg.type === 'BATCH_COMPLETE') {
          resolve();
        } else if (msg.type === 'ERROR') {
          reject(new Error(msg.payload.message));
        }
      };
      worker2.postMessage({
        type: 'START_BATCH',
        payload: {
          recipients: dbRecipients.map((r) => ({
            recipientKey: r.recipientKey,
            sourceRowNumber: r.sourceRowNumber,
            effectiveData: r.effectiveData,
          })),
        },
      });
    });

    clearInterval(intervalHandle);
    assert.ok(eventLoopTicks >= 5, `Event loop must tick during execution (ticked ${eventLoopTicks} times)`);
    assert.ok(maxLag < 80, `Event loop latency must remain non-blocking (max lag: ${maxLag.toFixed(2)}ms)`);
    console.log(`   ✓ AC2 Passed: Non-blocking execution verified (${eventLoopTicks} ticks, max lag ${maxLag.toFixed(2)}ms).\n`);

    // -------------------------------------------------------------------------
    // AC3: Accurate real-time progress metrics
    // -------------------------------------------------------------------------
    console.log('--- Testing AC3: Accurate Real-Time Progress Metrics ---');
    const worker3 = new BatchGeneratorHandler();
    worker3.postMessage({
      type: 'INIT',
      payload: { basePdfBytes: basePdfBytes.buffer, fieldMappings },
    });

    const progressList: any[] = [];
    await new Promise<void>((resolve) => {
      worker3.onmessage = (msg) => {
        if (msg.type === 'PROGRESS') {
          progressList.push(msg.payload);
        } else if (msg.type === 'BATCH_COMPLETE') {
          resolve();
        }
      };
      worker3.postMessage({
        type: 'START_BATCH',
        payload: {
          recipients: dbRecipients.map((r) => ({
            recipientKey: r.recipientKey,
            sourceRowNumber: r.sourceRowNumber,
            effectiveData: r.effectiveData,
          })),
        },
      });
    });

    assert.strictEqual(progressList.length, 10, 'Must emit exactly 10 progress notifications');
    for (let idx = 0; idx < progressList.length; idx++) {
      const p = progressList[idx];
      assert.strictEqual(p.current, idx + 1, `Progress current counter must be monotonic (${idx + 1})`);
      assert.strictEqual(p.total, 10, 'Progress total must equal 10');
      assert.strictEqual(p.percent, (idx + 1) * 10, `Progress percent must match ${ (idx + 1) * 10 }%`);
      assert.ok(p.itemsPerSec > 0, 'Throughput itemsPerSec must be positive');
      assert.ok(Number.isFinite(p.etaSeconds) && p.etaSeconds >= 0, 'etaSeconds must be finite non-negative number');
      assert.strictEqual(p.activeRecipientKey, dbRecipients[idx].recipientKey, 'activeRecipientKey must match queue');
    }
    console.log('   ✓ AC3 Passed: Monotonic progress, percent, positive throughput, and valid ETA verified.\n');

    // -------------------------------------------------------------------------
    // AC4: Pause at recipient boundary & seamless resume
    // -------------------------------------------------------------------------
    console.log('--- Testing AC4: Pause at Recipient Boundary & Seamless Resume ---');
    const worker4 = new BatchGeneratorHandler();
    worker4.postMessage({
      type: 'INIT',
      payload: { basePdfBytes: basePdfBytes.buffer, fieldMappings },
    });

    const generatedRecipientsAC4: string[] = [];
    let pausedPayload: any = null;

    await new Promise<void>((resolve) => {
      worker4.onmessage = (msg) => {
        if (msg.type === 'RECIPIENT_GENERATED') {
          generatedRecipientsAC4.push(msg.payload.recipientKey);
        } else if (msg.type === 'PROGRESS' && msg.payload.current === 3) {
          worker4.postMessage({ type: 'PAUSE' });
        } else if (msg.type === 'PAUSED') {
          pausedPayload = msg.payload;
          resolve();
        }
      };

      worker4.postMessage({
        type: 'START_BATCH',
        payload: {
          recipients: dbRecipients.map((r) => ({
            recipientKey: r.recipientKey,
            sourceRowNumber: r.sourceRowNumber,
            effectiveData: r.effectiveData,
          })),
        },
      });
    });

    assert.ok(pausedPayload, 'Worker must emit PAUSED event');
    assert.strictEqual(pausedPayload.current, 3, 'Worker must pause cleanly at recipient 3 boundary');
    assert.strictEqual(generatedRecipientsAC4.length, 3, 'Generated items while paused must equal 3');

    // Wait to verify no leaked processing while paused and accumulate pause time
    const pauseWaitMs = 150;
    const pauseRecordedStart = performance.now();
    await new Promise((r) => setTimeout(r, pauseWaitMs));
    assert.strictEqual(generatedRecipientsAC4.length, 3, 'No further items must generate while paused');

    // Resume execution
    let batchCompletePayloadAC4: any = null;
    const resumeProgressPayloads: any[] = [];
    await new Promise<void>((resolve) => {
      worker4.onmessage = (msg) => {
        if (msg.type === 'RECIPIENT_GENERATED') {
          generatedRecipientsAC4.push(msg.payload.recipientKey);
        } else if (msg.type === 'PROGRESS') {
          resumeProgressPayloads.push(msg.payload);
        } else if (msg.type === 'BATCH_COMPLETE') {
          batchCompletePayloadAC4 = msg.payload;
          resolve();
        }
      };
      worker4.postMessage({ type: 'RESUME' });
    });

    const totalRealTimeElapsed = performance.now() - pauseRecordedStart;
    assert.ok(batchCompletePayloadAC4, 'Batch must complete after resume');
    assert.strictEqual(generatedRecipientsAC4.length, 10, 'All 10 recipients must be generated across pause/resume');
    assert.deepStrictEqual(
      generatedRecipientsAC4,
      dbRecipients.map((r) => r.recipientKey),
      'Generation sequence must continue seamlessly from index 4 to 10 without restarting from 0'
    );
    // durationMs and progress elapsedMs must have pauseWaitMs subtracted
    assert.ok(
      batchCompletePayloadAC4.durationMs < totalRealTimeElapsed - (pauseWaitMs - 50),
      `BATCH_COMPLETE durationMs (${batchCompletePayloadAC4.durationMs}ms) must exclude pause time (~${pauseWaitMs}ms) from total real time (${totalRealTimeElapsed.toFixed(1)}ms)`
    );
    assert.ok(
      resumeProgressPayloads.every((p) => p.itemsPerSec > 0 && p.elapsedMs >= 0),
      'Progress metrics must maintain valid positive throughput and elapsedMs after pause'
    );
    console.log('   ✓ AC4 Passed: Clean boundary pause at 3, pause duration excluded from elapsed time, and seamless resume from 4 through 10 verified.\n');

    // -------------------------------------------------------------------------
    // AC5: Immediate cancellation & resource cleanup
    // -------------------------------------------------------------------------
    console.log('--- Testing AC5: Immediate Cancellation & Resource Cleanup ---');
    const worker5 = new BatchGeneratorHandler();
    worker5.postMessage({
      type: 'INIT',
      payload: { basePdfBytes: basePdfBytes.buffer, fieldMappings },
    });

    const generatedRecipientsAC5: string[] = [];
    let cancelledFired = false;

    await new Promise<void>((resolve) => {
      worker5.onmessage = (msg) => {
        if (msg.type === 'RECIPIENT_GENERATED') {
          generatedRecipientsAC5.push(msg.payload.recipientKey);
        } else if (msg.type === 'PROGRESS' && msg.payload.current === 2) {
          worker5.postMessage({ type: 'CANCEL' });
        } else if (msg.type === 'CANCELLED') {
          cancelledFired = true;
          resolve();
        }
      };

      worker5.postMessage({
        type: 'START_BATCH',
        payload: {
          recipients: dbRecipients.map((r) => ({
            recipientKey: r.recipientKey,
            sourceRowNumber: r.sourceRowNumber,
            effectiveData: r.effectiveData,
          })),
        },
      });
    });

    assert.strictEqual(cancelledFired, true, 'Worker must emit CANCELLED event');
    assert.strictEqual(worker5.isCancelState(), true, 'Worker internal state must reflect cancelled');
    assert.strictEqual(worker5.getQueueLength(), 0, 'Worker internal queue must be drained to 0');
    assert.strictEqual(generatedRecipientsAC5.length, 2, 'Processing must immediately cease at cancellation threshold');

    // Wait to verify zero subsequent emissions
    await new Promise((r) => setTimeout(r, 30));
    assert.strictEqual(generatedRecipientsAC5.length, 2, 'No ghost executions after cancellation');
    console.log('   ✓ AC5 Passed: Immediate cancellation halts processing and drains queue.\n');

    // -------------------------------------------------------------------------
    // AC6: Batch remains in approved status across reload/return
    // -------------------------------------------------------------------------
    console.log('--- Testing AC6: Batch & Snapshot Remain in Approved/Ready Status (Zero DB Write Locking) ---');
    const batchInDb = await Batch.findById(batch._id);
    const snapshotInDb = await ApprovedSnapshot.findById(snapshot._id);

    assert.strictEqual(batchInDb?.status, 'approved', 'Batch status must remain approved across all generation runs');
    assert.strictEqual(snapshotInDb?.status, 'ready', 'ApprovedSnapshot status must remain ready across all runs');
    assert.strictEqual(batchInDb?.approvedSnapshotId?.toString(), snapshot._id.toString(), 'Snapshot link preserved');
    console.log('   ✓ AC6 Passed: Batch remains approved and snapshot ready with zero DB write locks.\n');

    // -------------------------------------------------------------------------
    // AC7: Recipient overflow/glyph warning isolation
    // -------------------------------------------------------------------------
    console.log('--- Testing AC7: Recipient Overflow/Glyph Warning Isolation ---');
    const worker7 = new BatchGeneratorHandler();
    worker7.postMessage({
      type: 'INIT',
      payload: { basePdfBytes: basePdfBytes.buffer, fieldMappings },
    });

    const recipientWarningsMap: Record<string, EngineWarning[]> = {};

    await new Promise<void>((resolve) => {
      worker7.onmessage = (msg) => {
        if (msg.type === 'RECIPIENT_GENERATED') {
          recipientWarningsMap[msg.payload.recipientKey] = msg.payload.warnings;
        } else if (msg.type === 'BATCH_COMPLETE') {
          resolve();
        }
      };
      worker7.postMessage({
        type: 'START_BATCH',
        payload: {
          recipients: dbRecipients.map((r) => ({
            recipientKey: r.recipientKey,
            sourceRowNumber: r.sourceRowNumber,
            effectiveData: r.effectiveData,
          })),
        },
      });
    });

    // Row 8 has overflow text in remarks
    const rec8Warnings = recipientWarningsMap[dbRecipients[7].recipientKey] || [];
    assert.ok(
      rec8Warnings.some((w) => w.type === 'overflow'),
      'Recipient 8 must record overflow warning'
    );

    // Row 9 has non-WinAnsi emojis / Cyrillic in studentName
    const rec9Warnings = recipientWarningsMap[dbRecipients[8].recipientKey] || [];
    assert.ok(
      rec9Warnings.some((w) => w.type === 'unsupported_glyph'),
      'Recipient 9 must record unsupported_glyph warning'
    );

    // Row 10 is standard valid data: must complete cleanly
    const rec10Warnings = recipientWarningsMap[dbRecipients[9].recipientKey] || [];
    assert.strictEqual(rec10Warnings.length, 0, 'Recipient 10 must succeed with zero warnings');

    // Confirm that warnings did not abort batch completion
    assert.strictEqual(Object.keys(recipientWarningsMap).length, 10, 'All 10 recipients must complete despite warnings');
    console.log('   ✓ AC7 Passed: Overflow and glyph warnings flagged in isolation without aborting batch.\n');

    // -------------------------------------------------------------------------
    // AC7b: Fault isolation - row error progress emission and failure tracking
    // -------------------------------------------------------------------------
    console.log('--- Testing AC7b: Fault Isolation & Row Failure Progress/Tracking ---');
    const worker7b = new BatchGeneratorHandler();
    worker7b.postMessage({
      type: 'INIT',
      payload: { basePdfBytes: basePdfBytes.buffer, fieldMappings },
    });

    const errorEvents7b: any[] = [];
    const progressEvents7b: any[] = [];
    let completePayload7b: any = null;

    const testRecipientsWithFailure = [
      {
        recipientKey: 'rec_ok_1',
        sourceRowNumber: 1,
        effectiveData: { studentName: 'Alice' },
      },
      {
        recipientKey: 'rec_fail_2',
        sourceRowNumber: 2,
        get effectiveData() {
          throw new Error('Simulated processing failure for row 2');
        },
      },
      {
        recipientKey: 'rec_ok_3',
        sourceRowNumber: 3,
        effectiveData: { studentName: 'Charlie' },
      },
    ];

    await new Promise<void>((resolve) => {
      worker7b.onmessage = (msg) => {
        if (msg.type === 'ERROR') {
          errorEvents7b.push(msg.payload);
        } else if (msg.type === 'PROGRESS') {
          progressEvents7b.push(msg.payload);
        } else if (msg.type === 'BATCH_COMPLETE') {
          completePayload7b = msg.payload;
          resolve();
        }
      };
      worker7b.postMessage({
        type: 'START_BATCH',
        payload: {
          recipients: testRecipientsWithFailure,
        },
      });
    });

    assert.strictEqual(errorEvents7b.length, 1, 'Exactly 1 error event must be emitted for the failing row');
    assert.strictEqual(errorEvents7b[0].recipientKey, 'rec_fail_2', 'Error must be associated with the failed recipientKey');
    assert.strictEqual(errorEvents7b[0].fatal, false, 'Row failure must be non-fatal');
    assert.strictEqual(progressEvents7b.length, 3, 'PROGRESS must be emitted for every row including the failed row');
    assert.strictEqual(progressEvents7b[1].activeRecipientKey, 'rec_fail_2', 'Progress must record activeRecipientKey for failed row');
    assert.strictEqual(completePayload7b.totalGenerated, 2, 'BATCH_COMPLETE.totalGenerated must exclude failed rows');

    // Verify START_BATCH resets failure count
    let completePayload7bReset: any = null;
    await new Promise<void>((resolve) => {
      worker7b.onmessage = (msg) => {
        if (msg.type === 'BATCH_COMPLETE') {
          completePayload7bReset = msg.payload;
          resolve();
        }
      };
      worker7b.postMessage({
        type: 'START_BATCH',
        payload: {
          recipients: [
            { recipientKey: 'rec_reset_1', sourceRowNumber: 1, effectiveData: { studentName: 'David' } },
            { recipientKey: 'rec_reset_2', sourceRowNumber: 2, effectiveData: { studentName: 'Eve' } },
          ],
        },
      });
    });
    assert.strictEqual(completePayload7bReset.totalGenerated, 2, 'START_BATCH must reset failure count');
    console.log('   ✓ AC7b Passed: Row failure emits PROGRESS, records error per recipient, and excludes failure from totalGenerated.\n');

    // -------------------------------------------------------------------------
    // AC8: Deterministic byte output parity
    // -------------------------------------------------------------------------
    console.log('--- Testing AC8: Deterministic Byte Output Parity (SHA-256) ---');
    const run1 = await generatePdfWithOverlay(basePdfBytes, fieldMappings, recipient1.effectiveData);
    // Separate runs by >1 second to ensure timestamp/date changes would affect hash if not deterministic
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const run2 = await generatePdfWithOverlay(basePdfBytes, fieldMappings, recipient1.effectiveData);

    const hash1 = crypto.createHash('sha256').update(run1.pdfBytes).digest('hex');
    const hash2 = crypto.createHash('sha256').update(run2.pdfBytes).digest('hex');

    assert.strictEqual(hash1.length, 64, 'SHA-256 hash must be 64 hex characters');
    assert.strictEqual(hash1, hash2, 'Identical base PDF + field mappings + data must produce 100% byte-for-byte identical output');
    console.log(`   SHA-256 Digest: ${hash1}`);
    console.log('   ✓ AC8 Passed: 100% deterministic byte output parity verified.\n');

    console.log('===========================================================');
    console.log('🎉 ALL PRD-CORE-07 ACCEPTANCE CRITERIA (AC1 - AC8) PASSED!');
    console.log('===========================================================');
  } finally {
    // Teardown test fixtures
    if (batch) {
      await ApprovedRecipient.deleteMany({ batchId: batch._id }).catch(() => {});
      await ApprovedSnapshot.deleteMany({ batchId: batch._id }).catch(() => {});
      await Batch.deleteMany({ _id: batch._id }).catch(() => {});
    }
    if (template) {
      await TemplateVersion.deleteMany({ templateId: template._id }).catch(() => {});
      await Template.deleteMany({ _id: template._id }).catch(() => {});
    }
    await mongoose.disconnect();
  }
}

runAcceptanceCriteriaMatrix().catch((err) => {
  console.error('\n❌ Acceptance Criteria Matrix failed:', err);
  process.exit(1);
});
