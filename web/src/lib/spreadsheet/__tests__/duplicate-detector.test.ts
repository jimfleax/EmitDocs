/**
 * @file duplicate-detector.test.ts
 * @description Unit tests for in-memory duplicate row detection and preservation invariants.
 * @architecture Verifies row fingerprint calculation, warning annotations, and row preservation without dropping duplicates.
 * @agent_note Executes as a standalone Node test suite using node:assert.
 */

import assert from "node:assert";
import { detectDuplicatesAcrossRows } from "../duplicate-detector.js";

/**
 * @desc Executes test cases ensuring duplicate rows are detected, referenced, and never pruned.
 * @returns {Promise<void>}
 */
async function runTests() {
  console.log("🧪 Starting duplicate-detector unit test suite...");

  // Test 1: Duplicate preservation and reference tracking (AC4)
  {
    console.log(
      "Test 1: Detects duplicates and preserves them with referenceRowNumbers",
    );
    const rows = [
      {
        sourceRowNumber: 2,
        effectiveData: { studentName: "Alice", gradDate: "2026-06-15" },
      },
      {
        sourceRowNumber: 3,
        effectiveData: { studentName: "Bob", gradDate: "2026-06-15" },
      },
      {
        sourceRowNumber: 4,
        effectiveData: { studentName: "Alice", gradDate: "2026-06-15" },
      }, // duplicate of row 2
      {
        sourceRowNumber: 5,
        effectiveData: { studentName: "Charlie", gradDate: "2026-06-15" },
      },
      {
        sourceRowNumber: 6,
        effectiveData: { studentName: "Alice", gradDate: "2026-06-15" },
      }, // duplicate of rows 2 & 4
    ];

    const results = detectDuplicatesAcrossRows(rows);

    assert.strictEqual(
      results.length,
      5,
      "Must preserve all rows, never drop duplicates (AC4)",
    );
    assert.strictEqual(results[0].isDuplicate, false);
    assert.strictEqual(results[1].isDuplicate, false);

    // Row 4 is duplicate of row 2
    assert.strictEqual(results[2].isDuplicate, true);
    assert.deepStrictEqual(results[2].duplicateReferences, [2]);
    assert.ok(results[2].warnings.some((w) => w.code === "DUPLICATE_ROW"));

    // Row 6 is duplicate of rows 2 and 4
    assert.strictEqual(results[4].isDuplicate, true);
    assert.deepStrictEqual(results[4].duplicateReferences, [2, 4]);

    console.log(
      "  ✓ Duplicate rows tagged with warnings and references, strictly preserved",
    );
  }

  console.log("\n🎉 ALL duplicate-detector TESTS PASSED!");
}

runTests().catch((err) => {
  console.error("❌ Duplicate detector test failed:", err);
  process.exit(1);
});
