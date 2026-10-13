import assert from "node:assert";
import { validateDraftRow } from "../row-validator.js";

async function runTests() {
  console.log("🧪 Starting row-validator unit test suite...");

  const fieldMappings = [
    { key: "studentName", label: "Student Name", type: "text", required: true },
    { key: "gradDate", label: "Graduation Date", type: "date", required: true },
    { key: "gpa", label: "GPA", type: "number", required: false },
  ];

  const columnMap = {
    studentName: "Full Name",
    gradDate: "Grad Date",
    gpa: "Grade Point",
  };

  // Test 1: Completely valid row
  {
    console.log("Test 1: Valid row validation");
    const rowData = {
      "Full Name": "Alice Smith",
      "Grad Date": "2026-06-15",
      "Grade Point": "3.85",
    };

    const result = validateDraftRow({
      rowData,
      sourceRowNumber: 2,
      fieldMappings,
      columnMap,
    });

    assert.strictEqual(result.status, "valid");
    assert.strictEqual(result.errors.length, 0);
    assert.deepStrictEqual(result.effectiveData, {
      studentName: "Alice Smith",
      gradDate: "2026-06-15",
      gpa: 3.85,
    });
    console.log("  ✓ Valid row produces valid status and effective data");
  }

  // Test 2: Missing required field (AC3)
  {
    console.log("Test 2: Missing required field");
    const rowData = {
      "Full Name": "",
      "Grad Date": "2026-06-15",
    };

    const result = validateDraftRow({
      rowData,
      sourceRowNumber: 3,
      fieldMappings,
      columnMap,
    });

    assert.strictEqual(result.status, "invalid");
    assert.ok(
      result.errors.some(
        (e) => e.field === "studentName" && e.code === "REQUIRED_FIELD_MISSING",
      ),
    );
    console.log(
      "  ✓ Missing required field flagged with REQUIRED_FIELD_MISSING",
    );
  }

  // Test 3: Unmapped field error
  {
    console.log("Test 3: Unmapped field error");
    const incompleteColumnMap = {
      studentName: "Full Name",
    };

    const rowData = {
      "Full Name": "Bob Jones",
    };

    const result = validateDraftRow({
      rowData,
      sourceRowNumber: 4,
      fieldMappings,
      columnMap: incompleteColumnMap,
    });

    assert.strictEqual(result.status, "invalid");
    assert.ok(
      result.errors.some(
        (e) => e.field === "gradDate" && e.code === "UNMAPPED_FIELD",
      ),
    );
    console.log("  ✓ Unmapped required field flagged");
  }

  // Test 4: Format error on field (e.g. invalid date or ambiguous date) (AC3, AC5)
  {
    console.log("Test 4: Format error flagged with actionable code");
    const rowData = {
      "Full Name": "Charlie Brown",
      "Grad Date": "05/06/2026", // ambiguous
      "Grade Point": "xyz",
    };

    const result = validateDraftRow({
      rowData,
      sourceRowNumber: 5,
      fieldMappings,
      columnMap,
    });

    assert.strictEqual(result.status, "invalid");
    assert.ok(
      result.errors.some(
        (e) => e.field === "gradDate" && e.code === "AMBIGUOUS_DATE",
      ),
    );
    assert.ok(
      result.errors.some(
        (e) => e.field === "gpa" && e.code === "INVALID_NUMBER",
      ),
    );
    console.log("  ✓ Format errors flagged with specific codes");
  }

  console.log("\n🎉 ALL row-validator TESTS PASSED!");
}

runTests().catch((err) => {
  console.error("❌ Row validator test failed:", err);
  process.exit(1);
});
