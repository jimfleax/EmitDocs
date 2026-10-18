/**
 * @file format-engine.test.ts
 * @description Unit tests for field value formatting including dates, currencies, decimals, and case transforms.
 * @architecture Validates text transform pipeline, ISO date conversion patterns, and Intl.NumberFormat localized variations.
 * @agent_note Node.js assert based test runner; verifies edge cases such as token placeholders and invalid date inputs.
 */

import assert from "assert";
import {
  formatFieldValue,
  formatDate,
  formatNumber,
  applyTextTransform,
} from "../format-engine";

/**
 * @desc Executes unit tests validating text transformations, date patterns, and numeric/currency formatting.
 * @returns {void}
 */
function runFormatEngineTests() {
  console.log("=== RUNNING FORMAT ENGINE UNIT TESTS ===\n");

  console.log("1. Testing Text Case Transforms...");
  assert.strictEqual(applyTextTransform("john doe", "uppercase"), "JOHN DOE");
  assert.strictEqual(applyTextTransform("JOHN DOE", "lowercase"), "john doe");
  assert.strictEqual(applyTextTransform("john doe", "capitalize"), "John Doe");
  assert.strictEqual(applyTextTransform("john doe", "none"), "john doe");
  assert.strictEqual(
    applyTextTransform("john-doe invoice", "capitalize"),
    "John-Doe Invoice",
  );
  console.log("   ✓ Text transforms passed");

  console.log("2. Testing Date Formatting...");
  const testIso = "2026-10-12T10:30:00Z";
  assert.strictEqual(formatDate(testIso, "YYYY-MM-DD"), "2026-10-12");
  assert.strictEqual(formatDate(testIso, "MM/DD/YYYY"), "10/12/2026");
  assert.strictEqual(formatDate(testIso, "DD/MM/YYYY"), "12/10/2026");
  assert.strictEqual(formatDate(testIso, "MMMM D, YYYY"), "October 12, 2026");
  assert.strictEqual(formatDate(testIso, "MMM D, YYYY"), "Oct 12, 2026");
  assert.strictEqual(formatDate("invalid-date", "YYYY-MM-DD"), "invalid-date");
  console.log("   ✓ Date formatting passed");

  console.log("3. Testing Number & Currency Formatting...");
  assert.strictEqual(formatNumber("1234.56", "currency:USD"), "$1,234.56");
  assert.strictEqual(formatNumber(1234.56, "currency:GBP"), "£1,234.56");
  assert.strictEqual(formatNumber("1235", "currency:JPY"), "¥1,235");
  assert.strictEqual(formatNumber("1234.567", "decimal:2"), "1,234.57");
  assert.strictEqual(formatNumber("1234.567", "decimal:0"), "1,235");
  assert.strictEqual(formatNumber("12.5", "percent:0"), "13%");
  assert.strictEqual(formatNumber("0.1234", "percent:2"), "12.34%");
  assert.strictEqual(
    formatNumber("not-a-number", "currency:USD"),
    "not-a-number",
  );
  console.log("   ✓ Number and currency formatting passed");

  console.log("4. Testing Combined formatFieldValue Pipeline...");
  assert.strictEqual(
    formatFieldValue("2026-10-12", "date", "MMM D, YYYY", "uppercase"),
    "OCT 12, 2026",
  );
  assert.strictEqual(
    formatFieldValue("{{invoiceNumber}}", "text", undefined, "uppercase"),
    "{{INVOICENUMBER}}",
  );
  assert.strictEqual(formatFieldValue(null, "text"), "");
  console.log("   ✓ Combined pipeline passed");

  console.log("\n=== ALL FORMAT ENGINE TESTS PASSED! ===\n");
}

runFormatEngineTests();
