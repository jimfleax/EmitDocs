import assert from "node:assert";
import {
  normalizeDateValue,
  normalizeNumberValue,
  normalizeTextValue,
} from "../data-normalizer.js";

async function runTests() {
  console.log("🧪 Starting data-normalizer unit test suite...");

  // Test 1: Date Normalization - ISO and unambiguous formats
  {
    console.log("Test 1: ISO and unambiguous dates");
    const isoRes = normalizeDateValue("2026-05-18");
    assert.strictEqual(isoRes.value, "2026-05-18");
    assert.strictEqual(isoRes.error, undefined);

    const isoTimeRes = normalizeDateValue("2026-05-18T14:30:00Z");
    assert.strictEqual(isoTimeRes.value, "2026-05-18");

    // Unambiguous DD/MM because day is 25 (> 12)
    const ddmmRes = normalizeDateValue("25/05/2026");
    assert.strictEqual(ddmmRes.value, "2026-05-25");

    // Unambiguous MM/DD because month is 05 and day is 25 (> 12)
    const mmddRes = normalizeDateValue("05/25/2026");
    assert.strictEqual(mmddRes.value, "2026-05-25");

    console.log("  ✓ Unambiguous dates correctly normalized to ISO");
  }

  // Test 2: Ambiguous Dates (AC5 - never silently guessed)
  {
    console.log("Test 2: Ambiguous date detection");
    // Both 04 and 05 <= 12: Ambiguous!
    const ambigRes = normalizeDateValue("04/05/2026");
    assert.ok(ambigRes.error, "Ambiguous date must return error");
    assert.strictEqual(ambigRes.error.code, "AMBIGUOUS_DATE");

    // With explicit format hint:
    const hintRes = normalizeDateValue("04/05/2026", "DD/MM/YYYY");
    assert.strictEqual(hintRes.value, "2026-05-04");
    assert.strictEqual(hintRes.error, undefined);

    const hintRes2 = normalizeDateValue("04/05/2026", "MM/DD/YYYY");
    assert.strictEqual(hintRes2.value, "2026-04-05");
    assert.strictEqual(hintRes2.error, undefined);

    // Completely invalid date
    const invRes = normalizeDateValue("hello-world");
    assert.strictEqual(invRes.error?.code, "INVALID_DATE");

    console.log("  ✓ Ambiguous dates flagged without silent guessing");
  }

  // Test 3: Number Normalization - currency, commas, EU notation
  {
    console.log("Test 3: Number normalization");
    const num1 = normalizeNumberValue("$1,250.50");
    assert.strictEqual(num1.value, 1250.5);

    const num2 = normalizeNumberValue("€ 1.250,50");
    assert.strictEqual(num2.value, 1250.5);

    const num3 = normalizeNumberValue("₹ 99,999.00");
    assert.strictEqual(num3.value, 99999);

    const num4 = normalizeNumberValue(42.5);
    assert.strictEqual(num4.value, 42.5);

    // Invalid number
    const invNum = normalizeNumberValue("not-a-number");
    assert.strictEqual(invNum.error?.code, "INVALID_NUMBER");

    // Ambiguous number with multiple contradictory dots/commas
    const ambigNum = normalizeNumberValue("1.250.50");
    assert.strictEqual(ambigNum.error?.code, "AMBIGUOUS_NUMBER");

    console.log("  ✓ Number normalization and currency cleaning verified");
  }

  // Test 4: Formula cache missing token (AC5)
  {
    console.log("Test 4: Formula cache missing token");
    const fRes = normalizeTextValue("__FORMULA_CACHE_MISSING__");
    assert.strictEqual(fRes.error?.code, "FORMULA_CACHE_MISSING");

    const fResDate = normalizeDateValue("__FORMULA_CACHE_MISSING__");
    assert.strictEqual(fResDate.error?.code, "FORMULA_CACHE_MISSING");

    const fResNum = normalizeNumberValue("__FORMULA_CACHE_MISSING__");
    assert.strictEqual(fResNum.error?.code, "FORMULA_CACHE_MISSING");
    console.log("  ✓ FORMULA_CACHE_MISSING token flagged across all types");
  }

  console.log("\n🎉 ALL data-normalizer TESTS PASSED!");
}

runTests().catch((err) => {
  console.error("❌ Data normalizer test failed:", err);
  process.exit(1);
});
