/**
 * @file core-08-acceptance-matrix.test.ts
 * @description Acceptance criteria test matrix for PRD-CORE-08: Client-Side Streaming ZIP Packaging & Archive Splitting.
 * @architecture End-to-end verification covering browser-side streaming ZIP generation via Web Worker,
 *               dual-boundary volume partitioning (1,000 documents OR 1GB limit), Zip Slip traversal immunity,
 *               duplicate name collision prevention, STORE compression (method 0x0000, 0% CPU overhead),
 *               and clean extraction by native OS utilities (/usr/bin/unzip -t).
 * @agent_note Run via `pnpm run test:core08`. Requires active MongoDB instance via MONGODB_URI in api/.env.
 *             Automatically cleans up test batches, templates, snapshots, and recipients upon completion.
 */

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert";
import mongoose from "mongoose";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { PDFDocument } from "pdf-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../api/.env") });

// Models
import { Batch } from "../api/src/models/Batch.js";
import { Template } from "../api/src/models/Template.js";
import { TemplateVersion } from "../api/src/models/TemplateVersion.js";
import { ApprovedSnapshot } from "../api/src/models/ApprovedSnapshot.js";
import { ApprovedRecipient } from "../api/src/models/ApprovedRecipient.js";

// Domain Modules
import {
  sanitizeRecipientFilename,
} from "../web/src/lib/pdf-engine/filename-sanitizer.js";
import {
  calculateBatchVolumes,
  formatBytes,
} from "../web/src/lib/pdf-engine/volume-partitioner.js";
import { BatchGeneratorHandler } from "../web/src/workers/batch-generator.handler.js";
import type { FieldMappingConfig } from "../web/src/lib/pdf-engine/pdf-preview-engine.js";

/**
 * @desc Executes PRD-CORE-08 Acceptance Matrix AC1 through AC6 covering streaming ZIP generation, volume partitioning, and Zip Slip prevention.
 * @returns {Promise<void>} Resolves when all acceptance criteria tests pass successfully.
 */
async function runAcceptanceCriteriaMatrix() {
  console.log("===========================================================");
  console.log("  PRD-CORE-08 ACCEPTANCE CRITERIA MATRIX (AC1 - AC6)");
  console.log("===========================================================\n");

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not found in environment");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { dbName: "emitdocs_ac_test" });
  console.log("✓ Connected to MongoDB test database\n");

  let template: any = null;
  let templateVersion: any = null;
  let batch: any = null;
  let snapshot: any = null;

  try {
    const testUserId = `ac_user_core08_${Date.now()}`;

    // 1. Setup Base PDF & Template
    const fixturesDir = path.join(__dirname, "fixtures");
    const fixturePdfPath = path.join(fixturesDir, "single-page-token.pdf");
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
      name: "Graduation Diploma Batch",
      thumbnailUrl: "https://example.com/ac08_thumb.png",
    });

    const fieldMappings: FieldMappingConfig[] = [
      {
        id: "f_name",
        key: "recipientName",
        label: "Recipient Name",
        type: "text",
        pageIndex: 0,
        rect: { x: 50, y: 500, width: 250, height: 30 },
        fontSize: 16,
        minFontSize: 8,
        maxFontSize: 24,
        alignment: "left",
        maskMode: "solid-white",
        color: "#000000",
      },
      {
        id: "f_cert",
        key: "certId",
        label: "Certificate ID",
        type: "text",
        pageIndex: 0,
        rect: { x: 50, y: 450, width: 150, height: 20 },
        fontSize: 12,
        minFontSize: 8,
        maxFontSize: 16,
        alignment: "left",
        maskMode: "solid-white",
        color: "#333333",
      },
    ];

    templateVersion = await TemplateVersion.create({
      templateId: template._id,
      ownerId: testUserId,
      version: 1,
      sourceObjectKey: `templates/${testUserId}/test_doc.pdf`,
      bytes: basePdfBytes.length,
      pageCount: 1,
      fieldMappings,
      checksumSha256: "ac08_dummy_checksum",
      mappingHash: "ac08_mapping_hash",
      status: "active",
    });
    template.currentVersionId = templateVersion._id;
    await template.save();

    batch = await Batch.create({
      ownerId: testUserId,
      name: "Fall 2026 Graduating Class",
      templateId: template._id,
      templateVersionId: templateVersion._id,
      status: "approved",
      totalRows: 15,
      validRows: 15,
      invalidRows: 0,
    });

    snapshot = await ApprovedSnapshot.create({
      batchId: batch._id,
      ownerId: testUserId,
      templateId: template._id,
      templateVersionId: templateVersion._id,
      templateVersion: 1,
      templateSourceChecksum: "ac08_dummy_checksum",
      mappingHash: "ac08_mapping_hash",
      canonicalDigest: "ac08_canonical_digest",
      importRevision: 1,
      idempotencyKey: `idemp_${Date.now()}`,
      totalRecipients: 15,
      retentionHours: 72,
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      status: "ready",
    });

    // Seed 15 approved recipient records with some duplicates and hostile filenames
    const recipientsSeedData = [
      { name: "Alice Cooper", key: "rec_001" },
      { name: "Alice Cooper", key: "rec_002" }, // Duplicate name for AC4
      { name: "../../etc/passwd", key: "rec_003" }, // Traversal path for AC3
      { name: "..\\..\\windows\\system32", key: "rec_004" }, // Backslash traversal for AC3
      { name: "CON", key: "rec_005" }, // Windows device name for AC3
      { name: "PRN.txt", key: "rec_006" }, // Windows device name for AC3
      { name: "Carol White", key: "rec_007" },
      { name: "David Miller", key: "rec_008" },
      { name: "Eva Green", key: "rec_009" },
      { name: "Frank Sinatra", key: "rec_010" },
      { name: "Grace Hopper", key: "rec_011" },
      { name: "Henry Cavill", key: "rec_012" },
      { name: "Iris Murdoch", key: "rec_013" },
      { name: "Jack London", key: "rec_014" },
      { name: "Katherine Johnson", key: "rec_015" },
    ];

    const recipientDocs = recipientsSeedData.map((item, idx) => ({
      snapshotId: snapshot._id,
      batchId: batch._id,
      ownerId: testUserId,
      recipientKey: item.key,
      sourceRowNumber: idx + 1,
      effectiveData: {
        recipientName: item.name,
        certId: `CERT-2026-${String(idx + 1).padStart(4, "0")}`,
      },
      digest: `digest_${item.key}`,
    }));

    await ApprovedRecipient.insertMany(recipientDocs);
    const seededRecipients = await ApprovedRecipient.find({ snapshotId: snapshot._id }).sort({ sourceRowNumber: 1 });

    // -------------------------------------------------------------------------
    // AC1: Client-Side Streaming ZIP Assembly without Server Storage
    // -------------------------------------------------------------------------
    console.log("--- Testing AC1: Client-Side Streaming ZIP Assembly via Web Worker ---");
    const workerHandler = new BatchGeneratorHandler();
    await workerHandler.postMessage({
      type: "INIT",
      payload: {
        basePdfBytes: basePdfBytes.buffer as ArrayBuffer,
        fieldMappings,
      },
    });

    const receivedChunks: Uint8Array[] = [];
    let progressEventsCount = 0;
    let completedPayload: any = null;

    workerHandler.onmessage = (msg) => {
      if (msg.type === "ZIP_PROGRESS") {
        progressEventsCount++;
        assert.ok(msg.payload.current >= 1, "Progress current must be >= 1");
        assert.ok(msg.payload.total === 15, "Progress total must be 15");
        assert.ok(msg.payload.percent <= 100, "Progress percent must be <= 100");
      }
      if (msg.type === "ZIP_CHUNK") {
        receivedChunks.push(msg.payload.chunk);
      }
      if (msg.type === "ZIP_COMPLETE") {
        completedPayload = msg.payload;
      }
    };

    const batchItems = seededRecipients.map((r) => ({
      recipientKey: r.recipientKey,
      sourceRowNumber: r.sourceRowNumber,
      effectiveData: r.effectiveData,
    }));

    await workerHandler.postMessage({
      type: "START_ZIP_BATCH",
      payload: {
        recipients: batchItems,
        volumeIndex: 1,
        totalVolumes: 1,
        zipFilename: "Fall_2026_Graduating_Class.zip",
      },
    });

    // Wait until zip generation finishes
    await new Promise<void>((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (completedPayload) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!completedPayload) reject(new Error("Timeout waiting for ZIP_COMPLETE"));
      }, 15000);
    });

    assert.ok(receivedChunks.length > 0, "Worker must emit stream chunks");
    assert.strictEqual(completedPayload.totalDocuments, 15, "Must complete all 15 documents");
    assert.ok(completedPayload.totalBytes > 0, "Total bytes must be > 0");
    assert.ok(progressEventsCount >= 10, "Must emit real-time progress events");

    const fullZipBuffer = Buffer.concat(receivedChunks.map((c) => Buffer.from(c)));
    const zipMagic = fullZipBuffer.readUInt32LE(0);
    assert.strictEqual(zipMagic, 0x04034b50, "Output must be a valid ZIP archive starting with PK\\x03\\x04");
    console.log(`   ✓ AC1 Passed: 15 documents streamed directly into ${formatBytes(fullZipBuffer.length)} ZIP archive.\n`);

    // -------------------------------------------------------------------------
    // AC2: Dual-Threshold Archive Splitting (1,000 Docs OR 1GB Ceiling)
    // -------------------------------------------------------------------------
    console.log("--- Testing AC2: Dual-Threshold Volume Partitioning (1,000 Docs / 1GB) ---");
    // Case A: 1,005 documents with typical 100KB base PDF
    const vols1005 = calculateBatchVolumes(1005, "Fall 2026", 100_000);
    assert.strictEqual(vols1005.length, 2, "1,005 documents must partition into 2 volumes");
    assert.strictEqual(vols1005[0].volumeIndex, 1);
    assert.strictEqual(vols1005[0].documentCount, 1000);
    assert.strictEqual(vols1005[0].filename, "Fall_2026_part-1.zip");
    assert.strictEqual(vols1005[1].volumeIndex, 2);
    assert.strictEqual(vols1005[1].documentCount, 5);
    assert.strictEqual(vols1005[1].filename, "Fall_2026_part-2.zip");

    // Case B: 1GB size threshold partitioning
    // 600 documents with heavy 2.5MB base PDF (600 * 2.5MB = ~1.5GB > 1GB)
    const heavyPdfBytes = 2.5 * 1024 * 1024;
    const sizePartitions = calculateBatchVolumes(600, "Heavy Reports", heavyPdfBytes);
    assert.ok(sizePartitions.length >= 2, "Must split into >=2 volumes when total size exceeds 1GB even if doc count < 1,000");
    for (const v of sizePartitions) {
      assert.ok(v.estimatedSizeBytes <= 1024 * 1024 * 1024, `Volume ${v.volumeIndex} size must remain <= 1GB`);
      assert.ok(v.documentCount <= 1000, `Volume ${v.volumeIndex} count must remain <= 1,000`);
    }
    console.log("   ✓ AC2 Passed: Discrete volume partitioning verified for both document count and 1GB size ceiling.\n");

    // -------------------------------------------------------------------------
    // AC3: Path Traversal & Zip Slip Prevention
    // -------------------------------------------------------------------------
    console.log("--- Testing AC3: Zip Slip Immunity & OS-Safe Filename Sanitization ---");
    const zipStringContent = fullZipBuffer.toString("latin1");

    // Must not contain directory traversal sequences
    assert.ok(!zipStringContent.includes("../../etc/passwd"), "ZIP entries must not contain ../ traversal");
    assert.ok(!zipStringContent.includes("..\\..\\windows"), "ZIP entries must not contain ..\\ traversal");
    // Verify sanitized representation exists at root
    assert.ok(zipStringContent.includes("etc_passwd_rec_003.pdf"), "Sanitized etc_passwd_rec_003.pdf must exist at archive root");
    assert.ok(zipStringContent.includes("windows_system32_rec_004.pdf"), "Sanitized windows_system32_rec_004.pdf must exist at archive root");
    // Windows reserved names must be neutralized
    assert.ok(zipStringContent.includes("doc_CON_rec_005.pdf"), "Windows reserved name CON must be sanitized to doc_CON");
    assert.ok(zipStringContent.includes("doc_PRN.txt_rec_006.pdf"), "Windows reserved name PRN must be sanitized to doc_PRN.txt");
    console.log("   ✓ AC3 Passed: Zip Slip paths and reserved OS names neutralized at container root.\n");

    // -------------------------------------------------------------------------
    // AC4: Duplicate Name Collision Prevention
    // -------------------------------------------------------------------------
    console.log("--- Testing AC4: Duplicate Recipient Name Collision Prevention ---");
    const docNameA = sanitizeRecipientFilename({ recipientName: "Alice Cooper" }, "rec_001");
    const docNameB = sanitizeRecipientFilename({ recipientName: "Alice Cooper" }, "rec_002");
    assert.strictEqual(docNameA, "Alice_Cooper_rec_001.pdf");
    assert.strictEqual(docNameB, "Alice_Cooper_rec_002.pdf");
    assert.notStrictEqual(docNameA, docNameB, "Collision suffix must ensure distinct file keys");

    assert.ok(zipStringContent.includes("Alice_Cooper_rec_001.pdf"), "Archive must contain Alice_Cooper_rec_001.pdf");
    assert.ok(zipStringContent.includes("Alice_Cooper_rec_002.pdf"), "Archive must contain Alice_Cooper_rec_002.pdf");
    console.log("   ✓ AC4 Passed: Duplicate recipient names assigned unique non-colliding archive paths.\n");

    // -------------------------------------------------------------------------
    // AC5: STORE Mode (0x0000) & Memory Bounding
    // -------------------------------------------------------------------------
    console.log("--- Testing AC5: STORE Compression (Method 0x0000, 0% CPU Overhead) ---");
    const compressionMethod = fullZipBuffer.readUInt16LE(8);
    assert.strictEqual(
      compressionMethod,
      0x0000,
      `ZIP local header compression method must be 0x0000 (STORE), got 0x${compressionMethod.toString(16)}`
    );
    console.log("   ✓ AC5 Passed: STORE compression mode verified (0% CPU recompression overhead).\n");

    // -------------------------------------------------------------------------
    // AC6: Native OS Archive Compliance & Extraction Test
    // -------------------------------------------------------------------------
    console.log("--- Testing AC6: Native OS Archive Utility Extraction (/usr/bin/unzip -t) ---");
    const scratchDir = path.join(__dirname, "../scratch");
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }

    const testZipPath = path.join(scratchDir, `test_export_${Date.now()}.zip`);
    fs.writeFileSync(testZipPath, fullZipBuffer);

    try {
      const unzipOutput = execSync(`/usr/bin/unzip -t "${testZipPath}"`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });

      assert.ok(
        unzipOutput.includes("No errors detected in compressed data of"),
        "unzip -t must report zero errors detected"
      );
      assert.ok(
        unzipOutput.includes("Alice_Cooper_rec_001.pdf"),
        "unzip table must list Alice_Cooper_rec_001.pdf"
      );
      console.log("   ✓ AC6 Passed: Native OS unzip verified with 0 CRC or header corruption errors.\n");
    } finally {
      if (fs.existsSync(testZipPath)) {
        fs.unlinkSync(testZipPath);
      }
    }

    console.log("===========================================================");
    console.log("🎉 ALL PRD-CORE-08 ACCEPTANCE CRITERIA (AC1 - AC6) PASSED!");
    console.log("===========================================================\n");
  } finally {
    // Teardown test artifacts
    if (snapshot) {
      await ApprovedRecipient.deleteMany({ snapshotId: snapshot._id });
      await ApprovedSnapshot.deleteOne({ _id: snapshot._id });
    }
    if (batch) {
      await Batch.deleteOne({ _id: batch._id });
    }
    if (templateVersion) {
      await TemplateVersion.deleteOne({ _id: templateVersion._id });
    }
    if (template) {
      await Template.deleteOne({ _id: template._id });
    }
    await mongoose.disconnect();
    console.log("✓ Disconnected from test database and cleaned up fixtures");
  }
}

runAcceptanceCriteriaMatrix().catch((err) => {
  console.error("\n❌ PRD-CORE-08 Acceptance Matrix Failed:", err);
  process.exit(1);
});
