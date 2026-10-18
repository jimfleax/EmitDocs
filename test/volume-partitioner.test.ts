/**
 * @file volume-partitioner.test.ts
 * @description TDD test suite for batch volume partitioning, slug generation, and ZIP archive boundary estimation.
 * @architecture Web client engine unit test suite validating dual-boundary volume splitting (1,000 files / 1GB thresholds) in web/src/lib/pdf-engine/volume-partitioner.js.
 * @agent_note Run via `npx tsx test/volume-partitioner.test.ts`. Offline unit tests validating volume partitioning and sizing math without I/O.
 */

import assert from "node:assert";
import {
  calculateBatchVolumes,
  slugifyBatchName,
  predictDocumentZipEntryBytes,
} from "../web/src/lib/pdf-engine/volume-partitioner.js";

/**
 * @desc Main test runner verifying batch volume partitioning, slug sanitization, and predictDocumentZipEntryBytes.
 * @returns {void}
 */
function runTests() {
  console.log("=== Running Volume Partitioner Test Suite ===");

  // 1. Slugify Batch Name
  console.log("1. Slugify Batch Name");
  assert.strictEqual(slugifyBatchName("Q4 Global Certifications"), "Q4_Global_Certifications");
  assert.strictEqual(slugifyBatchName("   My / Weird * Batch !!  "), "My_Weird_Batch");
  assert.strictEqual(slugifyBatchName(""), "batch");
  assert.strictEqual(slugifyBatchName("..."), "batch");

  // 2. Zero recipients
  console.log("2. Zero Recipients");
  const zeroVolumes = calculateBatchVolumes(0, "Empty Batch");
  assert.strictEqual(zeroVolumes.length, 0, "0 recipients must yield 0 volumes");

  // 3. Single volume (count <= 1000 and size <= 1GB)
  console.log("3. Single Volume (<1,000 docs)");
  const singleVol = calculateBatchVolumes(500, "Certificates 2026", 100_000);
  assert.strictEqual(singleVol.length, 1);
  assert.strictEqual(singleVol[0].volumeIndex, 1);
  assert.strictEqual(singleVol[0].totalVolumes, 1);
  assert.strictEqual(singleVol[0].startIndex, 0);
  assert.strictEqual(singleVol[0].endIndex, 500);
  assert.strictEqual(singleVol[0].documentCount, 500);
  assert.strictEqual(singleVol[0].filename, "Certificates_2026.zip");
  assert.ok(singleVol[0].label.includes("500 docs"));
  assert.ok(singleVol[0].estimatedSizeBytes > 0);

  // 4. Exact boundary (1,000 docs)
  console.log("4. Exact 1,000 docs boundary");
  const exact1000 = calculateBatchVolumes(1000, "Batch 1000", 100_000);
  assert.strictEqual(exact1000.length, 1);
  assert.strictEqual(exact1000[0].filename, "Batch_1000.zip");
  assert.strictEqual(exact1000[0].documentCount, 1000);

  // 5. Multi-volume by count (1,001 docs -> Part 1: 1000, Part 2: 1)
  console.log("5. 1,001 docs partition");
  const multiVol1 = calculateBatchVolumes(1001, "Graduation Batch", 100_000);
  assert.strictEqual(multiVol1.length, 2);
  assert.strictEqual(multiVol1[0].volumeIndex, 1);
  assert.strictEqual(multiVol1[0].totalVolumes, 2);
  assert.strictEqual(multiVol1[0].startIndex, 0);
  assert.strictEqual(multiVol1[0].endIndex, 1000);
  assert.strictEqual(multiVol1[0].documentCount, 1000);
  assert.strictEqual(multiVol1[0].filename, "Graduation_Batch_part-1.zip");

  assert.strictEqual(multiVol1[1].volumeIndex, 2);
  assert.strictEqual(multiVol1[1].totalVolumes, 2);
  assert.strictEqual(multiVol1[1].startIndex, 1000);
  assert.strictEqual(multiVol1[1].endIndex, 1001);
  assert.strictEqual(multiVol1[1].documentCount, 1);
  assert.strictEqual(multiVol1[1].filename, "Graduation_Batch_part-2.zip");

  // 6. 2,500 docs partition (Part 1: 1000, Part 2: 1000, Part 3: 500)
  console.log("6. 2,500 docs partition");
  const multiVol2 = calculateBatchVolumes(2500, "Enterprise Batch", 100_000);
  assert.strictEqual(multiVol2.length, 3);
  assert.strictEqual(multiVol2[0].documentCount, 1000);
  assert.strictEqual(multiVol2[1].documentCount, 1000);
  assert.strictEqual(multiVol2[2].documentCount, 500);

  // 7. Dual Boundary: 1GB Size Partitioning
  // Large 2.5MB base PDF template with 600 recipients
  // 600 * 2.5MB = ~1.5GB (> 1GB ceiling).
  // Even though count (600) < 1,000, size must force volume splitting!
  console.log("7. Dual Boundary 1GB Ceiling Splitting");
  const largeDocBytes = 2.5 * 1024 * 1024; // 2.5MB
  const sizeLimitedVols = calculateBatchVolumes(600, "HighRes Booklets", largeDocBytes);
  // 1GB / ~2.52MB ~= ~425 docs max per volume
  assert.ok(sizeLimitedVols.length >= 2, "Must split into >=2 volumes due to 1GB limit");
  for (const vol of sizeLimitedVols) {
    assert.ok(vol.estimatedSizeBytes <= 1024 * 1024 * 1024, "Every volume must stay <= 1GB");
    assert.ok(vol.documentCount <= 1000, "Every volume document count must stay <= 1000");
  }

  // 8. Custom options override
  console.log("8. Custom Options Override");
  const custom = calculateBatchVolumes(150, "Tiny Test", 100_000, {
    maxDocsPerVolume: 50,
  });
  assert.strictEqual(custom.length, 3);
  assert.strictEqual(custom[0].documentCount, 50);
  assert.strictEqual(custom[1].documentCount, 50);
  assert.strictEqual(custom[2].documentCount, 50);

  // 9. High-Accuracy Prediction: Analytical Model (Base PDF + Overlay Delta + ZIP STORE Framing)
  console.log("9. High-Accuracy Analytical Prediction");
  const analyticalPred = predictDocumentZipEntryBytes(50_000, {
    fieldCount: 5,
    avgFilenameLength: 32,
  });
  // PDF: 50,000 + 650 (xref/font) + 5 * 160 (operators) = 51,450
  assert.strictEqual(analyticalPred.perDocPdfBytes, 51_450);
  // ZIP Framing: 92 + 2 * 32 = 156
  assert.strictEqual(analyticalPred.perDocZipOverhead, 156);
  assert.strictEqual(analyticalPred.perDocTotalBytes, 51_606);

  const analyticalBatch = calculateBatchVolumes(10, "Analytical Batch", 50_000, {
    fieldCount: 5,
    avgFilenameLength: 32,
  });
  // Total = 10 * 51,606 + 22 (EOCD) = 516,082
  assert.strictEqual(analyticalBatch[0].estimatedSizeBytes, 516_082);

  // 10. High-Accuracy Prediction: Empirical Ground-Truth Samples
  console.log("10. High-Accuracy Empirical Ground-Truth Calibration");
  const empiricalSamples = [40_000, 42_000, 44_000]; // Mean: 42,000
  const empiricalPred = predictDocumentZipEntryBytes(100_000, {
    samplePdfSizes: empiricalSamples,
    avgFilenameLength: 32,
  });
  // Samples must override basePdfSizeBytes
  assert.strictEqual(empiricalPred.perDocPdfBytes, 42_000);
  assert.strictEqual(empiricalPred.perDocZipOverhead, 156);
  assert.strictEqual(empiricalPred.perDocTotalBytes, 42_156);

  const empiricalBatch = calculateBatchVolumes(100, "Empirical Batch", 100_000, {
    samplePdfSizes: empiricalSamples,
    avgFilenameLength: 32,
  });
  // Total = 100 * 42,156 + 22 (EOCD) = 4,215,622
  assert.strictEqual(empiricalBatch[0].estimatedSizeBytes, 4_215_622);

  console.log("🎉 All Volume Partitioner Tests Passed Successfully!");
}

runTests();
