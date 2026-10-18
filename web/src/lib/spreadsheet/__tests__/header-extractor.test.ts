/**
 * @file header-extractor.test.ts
 * @description Unit tests for spreadsheet header row identification, empty row skipping, and column disambiguation.
 * @architecture Validates automatic blank header naming (Column_A, Column_B), duplicate header preservation (_2, _3), and whitespace trimming.
 * @agent_note Ensures 1-to-1 parity with spreadsheet column counts across diverse grid layouts.
 */

import assert from "node:assert";
import { extractHeadersAndRows } from "../header-extractor.js";

/**
 * @desc Executes test cases verifying grid header extraction, blank column naming, and duplicate disambiguation.
 * @returns {Promise<void>}
 */
async function runTests() {
  console.log("🧪 Starting header-extractor unit test suite...");

  // Test 1: Skips leading empty rows and identifies first non-empty row as header (AC1)
  {
    console.log("Test 1: Skips leading empty rows");
    const grid = [
      [],
      [null, "", undefined, "   "],
      ["Full Name", "Graduation Date", "Degree"],
      ["Alice Smith", "2026-05-20", "B.Sc"],
      ["Bob Jones", "2026-05-20", "M.Sc"],
    ];

    const result = extractHeadersAndRows(grid);
    assert.strictEqual(
      result.dataStartRowIndex,
      3,
      "dataStartRowIndex should be 3 (after 2 blank rows + 1 header row)",
    );
    assert.deepStrictEqual(result.rawHeaders, [
      "Full Name",
      "Graduation Date",
      "Degree",
    ]);
    assert.deepStrictEqual(result.disambiguatedHeaders, [
      "Full Name",
      "Graduation Date",
      "Degree",
    ]);
    assert.strictEqual(result.rows.length, 2);
    assert.deepStrictEqual(result.rows[0], [
      "Alice Smith",
      "2026-05-20",
      "B.Sc",
    ]);
    console.log("  ✓ Leading empty rows correctly skipped");
  }

  // Test 2: Blank headers disambiguation (e.g., Column_B, Column_D) (AC1)
  {
    console.log("Test 2: Blank headers disambiguation");
    const grid = [
      ["Student ID", "", "Score", "   "],
      ["S001", "Active", "95", "Passed"],
    ];

    const result = extractHeadersAndRows(grid);
    assert.deepStrictEqual(result.rawHeaders, ["Student ID", "", "Score", ""]);
    assert.deepStrictEqual(result.disambiguatedHeaders, [
      "Student ID",
      "Column_B",
      "Score",
      "Column_D",
    ]);
    console.log("  ✓ Blank headers disambiguated as Column_<letter>");
  }

  // Test 3: Duplicate headers disambiguation without merging (AC1)
  {
    console.log("Test 3: Duplicate headers disambiguation");
    const grid = [
      ["Date", "Score", "Date", "Date", "Score"],
      ["2026-01-01", "10", "2026-01-02", "2026-01-03", "20"],
    ];

    const result = extractHeadersAndRows(grid);
    assert.deepStrictEqual(result.rawHeaders, [
      "Date",
      "Score",
      "Date",
      "Date",
      "Score",
    ]);
    assert.deepStrictEqual(result.disambiguatedHeaders, [
      "Date",
      "Score",
      "Date_2",
      "Date_3",
      "Score_2",
    ]);
    console.log(
      "  ✓ Duplicate headers preserved and disambiguated without merging",
    );
  }

  // Test 4: Trims whitespace from headers and values
  {
    console.log("Test 4: Trims whitespace");
    const grid = [
      ["  First Name  ", "  Email Address "],
      ["  John  ", " john@example.com  "],
    ];

    const result = extractHeadersAndRows(grid);
    assert.deepStrictEqual(result.disambiguatedHeaders, [
      "First Name",
      "Email Address",
    ]);
    console.log("  ✓ Whitespace trimmed");
  }

  // Test 5: Empty grid or grid with only empty rows
  {
    console.log("Test 5: Completely empty grid");
    const grid = [[], ["", "   "]];
    const result = extractHeadersAndRows(grid);
    assert.deepStrictEqual(result.rawHeaders, []);
    assert.deepStrictEqual(result.disambiguatedHeaders, []);
    assert.deepStrictEqual(result.rows, []);
    console.log("  ✓ Empty grid returns empty structure");
  }

  console.log("\n🎉 ALL header-extractor TESTS PASSED!");
}

runTests().catch((err) => {
  console.error("❌ Header extractor test failed:", err);
  process.exit(1);
});
