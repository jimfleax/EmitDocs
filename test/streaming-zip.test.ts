/**
 * @file streaming-zip.test.ts
 * @description TDD test suite for streaming ZIP packaging using client-zip with STORE mode verification (PRD-CORE-08).
 */

import assert from "node:assert";
import { createStreamingZip, type ZipInputFile } from "../web/src/lib/pdf-engine/streaming-zip.js";

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

  console.log("🎉 All Streaming ZIP Tests Passed Successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
