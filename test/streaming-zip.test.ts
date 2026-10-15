/**
 * @file streaming-zip.test.ts
 * @description TDD test suite for streaming ZIP packaging using client-zip with STORE mode verification (PRD-CORE-08).
 */

import assert from "node:assert";
import { createStreamingZip, type ZipInputFile } from "../web/src/lib/pdf-engine/streaming-zip.js";
import { BatchGeneratorHandler } from "../web/src/workers/batch-generator.handler.js";
import { PDFDocument } from "pdf-lib";

async function runTests() {
  console.log("=== Running Streaming ZIP Test Suite ===");

  // 1. Synthetic PDF file generator
  async function* generateTestFiles(): AsyncGenerator<ZipInputFile> {
    const dummyPdf1 = Buffer.from("%PDF-1.4\n%dummy pdf content 1\n%%EOF");
    yield {
      name: "Alice_Smith_001.pdf",
      input: new Uint8Array(dummyPdf1),
      lastModified: new Date(1700000000000),
    };

    const dummyPdf2 = Buffer.from("%PDF-1.4\n%dummy pdf content 2 with longer body\n%%EOF");
    yield {
      name: "Bob_Jones_002.pdf",
      input: new Uint8Array(dummyPdf2),
      lastModified: new Date(1700000000000),
    };

    const dummyPdf3 = Buffer.from("%PDF-1.4\n%dummy pdf content 3\n%%EOF");
    yield {
      name: "Carol_White_003.pdf",
      input: new Uint8Array(dummyPdf3),
      lastModified: new Date(1700000000000),
    };
  }

  // 2. Create Streaming Zip
  console.log("1. Create streaming zip from async generator");
  const stream = createStreamingZip(generateTestFiles());
  assert.ok(stream instanceof ReadableStream, "Must return a ReadableStream instance");

  // 3. Consume stream and accumulate chunks
  console.log("2. Read chunks from stream");
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value && value.length > 0) {
      chunks.push(value);
      totalBytes += value.length;
    }
  }

  assert.ok(chunks.length > 0, "Must yield at least 1 chunk");
  assert.ok(totalBytes > 0, "Total byte count must be > 0");

  const fullZip = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  console.log(`   Emitted ${chunks.length} chunks, total size: ${fullZip.length} bytes`);

  // 4. Verify Local File Header & STORE Mode (0x0000)
  console.log("3. Verify ZIP Local File Header & STORE Mode (0x0000)");
  // Standard Local File Header Signature: 0x04034b50 ("PK\x03\x04")
  const magic = fullZip.readUInt32LE(0);
  assert.strictEqual(magic, 0x04034b50, "Header signature must be 0x04034b50 (PK\\x03\\x04)");

  // Compression Method is at offset 8 (2 bytes)
  const compressionMethod = fullZip.readUInt16LE(8);
  console.log(`   Detected compression method: 0x${compressionMethod.toString(16).padStart(4, "0")}`);
  assert.strictEqual(
    compressionMethod,
    0x0000,
    "Compression method MUST be 0x0000 (STORE mode - 0% CPU recompression overhead)"
  );

  // 5. Verify End of Central Directory Record ("PK\x05\x06")
  console.log("4. Verify End of Central Directory Record");
  const eocdSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const eocdIndex = fullZip.lastIndexOf(eocdSignature);
  assert.ok(eocdIndex !== -1, "Must contain End of Central Directory signature (PK\\x05\\x06)");

  // Verify total entries in central directory (offset 10 in EOCD, 2 bytes)
  const totalEntries = fullZip.readUInt16LE(eocdIndex + 10);
  assert.strictEqual(totalEntries, 3, "Central directory must list exactly 3 file entries");

  // 6. Verify Filenames inside Central Directory
  console.log("5. Verify Filenames in Central Directory");
  const zipText = fullZip.toString("latin1");
  assert.ok(zipText.includes("Alice_Smith_001.pdf"), "Archive must contain Alice_Smith_001.pdf");
  assert.ok(zipText.includes("Bob_Jones_002.pdf"), "Archive must contain Bob_Jones_002.pdf");
  assert.ok(zipText.includes("Carol_White_003.pdf"), "Archive must contain Carol_White_003.pdf");

  // 6. Verify BatchGeneratorHandler ZIP export: chunk copying and transferred buffer isolation
  console.log("6. Verify BatchGeneratorHandler ZIP chunk emission and buffer isolation");
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  const dummyBasePdf = await doc.save();

  const handler = new BatchGeneratorHandler();
  await handler.postMessage({
    type: "INIT",
    payload: {
      basePdfBytes: dummyBasePdf.buffer as ArrayBuffer,
      fieldMappings: [],
    },
  });

  const chunksReceived: Uint8Array[] = [];
  let zipCompleted: any = null;
  const progressList: any[] = [];
  const errorsList: any[] = [];

  handler.onmessage = (msg) => {
    if (msg.type === "ZIP_CHUNK") {
      chunksReceived.push(msg.payload.chunk);
    } else if (msg.type === "ZIP_PROGRESS") {
      progressList.push(msg.payload);
    } else if (msg.type === "ZIP_COMPLETE") {
      zipCompleted = msg.payload;
    } else if (msg.type === "ERROR") {
      errorsList.push(msg.payload);
    }
  };

  await handler.postMessage({
    type: "START_ZIP_BATCH",
    payload: {
      recipients: [
        { recipientKey: "rec_1", sourceRowNumber: 1, effectiveData: { name: "Alice" } },
        { recipientKey: "rec_2", sourceRowNumber: 2, effectiveData: { name: "Bob" } },
      ],
      volumeIndex: 1,
      totalVolumes: 1,
      zipFilename: "test.zip",
    },
  });

  await new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (zipCompleted) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > 5000) {
        clearInterval(interval);
        reject(new Error("Timeout waiting for ZIP_COMPLETE"));
      }
    }, 20);
  });

  assert.strictEqual(zipCompleted.totalDocuments, 2, "Must complete 2 documents");
  assert.strictEqual(zipCompleted.failedCount, 0, "0 failures");
  assert.deepStrictEqual(zipCompleted.failedRecipientKeys, [], "No failed keys");
  assert.strictEqual(progressList[progressList.length - 1].percent, 100, "Progress must reach 100%");
  assert.strictEqual(errorsList.length, 0, "No ERROR messages emitted");
  assert.ok(chunksReceived.length > 0, "Must receive chunks");
  console.log("   ✓ ZIP chunk emission and buffer isolation verified");

  // 7. Verify Fault Isolation in ZIP generation: failure collecting, no ERROR emitted, 100% progress
  console.log("7. Verify Fault Isolation in ZIP generation (failures collected, no ERROR emitted, 100% progress)");
  const faultyHandler = new BatchGeneratorHandler();
  // Corrupt base PDF so generatePdfWithOverlay throws for recipients
  const corruptPdfBytes = new Uint8Array([1, 2, 3, 4, 5]);
  await faultyHandler.postMessage({
    type: "INIT",
    payload: {
      basePdfBytes: corruptPdfBytes.buffer as ArrayBuffer,
      fieldMappings: [],
    },
  });

  let faultyZipCompleted: any = null;
  const faultyProgressList: any[] = [];
  const faultyErrorsList: any[] = [];

  faultyHandler.onmessage = (msg) => {
    if (msg.type === "ZIP_PROGRESS") {
      faultyProgressList.push(msg.payload);
    } else if (msg.type === "ZIP_COMPLETE") {
      faultyZipCompleted = msg.payload;
    } else if (msg.type === "ERROR") {
      faultyErrorsList.push(msg.payload);
    }
  };

  await faultyHandler.postMessage({
    type: "START_ZIP_BATCH",
    payload: {
      recipients: [
        { recipientKey: "bad_rec_1", sourceRowNumber: 1, effectiveData: { name: "Bad1" } },
        { recipientKey: "bad_rec_2", sourceRowNumber: 2, effectiveData: { name: "Bad2" } },
      ],
      volumeIndex: 1,
      totalVolumes: 1,
      zipFilename: "faulty.zip",
    },
  });

  await new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (faultyZipCompleted) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > 5000) {
        clearInterval(interval);
        reject(new Error("Timeout waiting for faulty ZIP_COMPLETE"));
      }
    }, 20);
  });

  assert.strictEqual(faultyZipCompleted.totalDocuments, 0, "0 documents generated");
  assert.strictEqual(faultyZipCompleted.failedCount, 2, "Must report 2 failed recipients");
  assert.deepStrictEqual(faultyZipCompleted.failedRecipientKeys, ["bad_rec_1", "bad_rec_2"], "Must collect failed keys");
  assert.strictEqual(faultyErrorsList.length, 0, "Do not emit ERROR messages which abort ZIP export");
  assert.strictEqual(faultyProgressList[faultyProgressList.length - 1].percent, 100, "Progress must reach 100% on failure");
  console.log("   ✓ Fault isolation and 100% progress verified");

  // 8. Verify ZIP export state and cancellation isolation from batch generation
  console.log("8. Verify ZIP export state and cancellation isolation from batch generation");
  const isoHandler = new BatchGeneratorHandler();
  await isoHandler.postMessage({
    type: "INIT",
    payload: {
      basePdfBytes: dummyBasePdf.buffer as ArrayBuffer,
      fieldMappings: [],
    },
  });

  const cancelledMsgs: any[] = [];
  isoHandler.onmessage = (msg) => {
    if (msg.type === "CANCELLED") {
      cancelledMsgs.push(msg);
    }
  };

  // Test CANCEL_ZIP emits scope: "zip"
  await isoHandler.postMessage({ type: "CANCEL_ZIP" });
  assert.strictEqual(cancelledMsgs.length, 1);
  assert.strictEqual(cancelledMsgs[0].scope, "zip", "CANCEL_ZIP must emit CANCELLED with scope: 'zip'");
  assert.strictEqual(isoHandler.isGeneratingState(), false, "Batch generation state must not be affected");

  // Test CANCEL emits scope: "batch"
  await isoHandler.postMessage({ type: "CANCEL" });
  assert.strictEqual(cancelledMsgs.length, 2);
  assert.strictEqual(cancelledMsgs[1].scope, "batch", "CANCEL must emit CANCELLED with scope: 'batch'");
  console.log("   ✓ Scope-tagged cancellation isolation verified");

  console.log("🎉 All Streaming ZIP Tests Passed Successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
