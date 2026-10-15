/**
 * @file filename-sanitizer.test.ts
 * @description TDD test suite for filename sanitization and Zip Slip prevention (PRD-CORE-08).
 */

import assert from "node:assert";
import {
  sanitizeRecipientFilename,
  sanitizeFilenameBase,
} from "../web/src/lib/pdf-engine/filename-sanitizer.js";

function runTests() {
  console.log("=== Running Filename Sanitizer Test Suite ===");

  // 1. Basic Name Detection
  console.log("1. Basic Name Detection");
  assert.strictEqual(
    sanitizeRecipientFilename({ name: "Alice Smith" }, "rec_123"),
    "Alice_Smith_rec_123.pdf"
  );
  assert.strictEqual(
    sanitizeRecipientFilename({ student_name: "Bob Jones" }, "rec_456"),
    "Bob_Jones_rec_456.pdf"
  );
  assert.strictEqual(
    sanitizeRecipientFilename({ fullName: "Carol White" }, "rec_789"),
    "Carol_White_rec_789.pdf"
  );
  assert.strictEqual(
    sanitizeRecipientFilename({}, "rec_000"),
    "document_rec_000.pdf"
  );
  assert.strictEqual(
    sanitizeRecipientFilename({}, "rec_000", "certificate"),
    "certificate_rec_000.pdf"
  );

  // 2. Zip Slip & Path Traversal Prevention
  console.log("2. Zip Slip & Traversal Prevention");
  const slip1 = sanitizeRecipientFilename({ name: "../../etc/passwd" }, "key1");
  assert.ok(!slip1.includes(".."), "Must not contain directory traversal ..");
  assert.ok(!slip1.includes("/"), "Must not contain forward slash");
  assert.ok(!slip1.includes("\\"), "Must not contain backslash");
  assert.strictEqual(slip1, "etc_passwd_key1.pdf");

  const slip2 = sanitizeRecipientFilename({ name: "..\\..\\windows\\system32" }, "key2");
  assert.ok(!slip2.includes(".."), "Must not contain ..");
  assert.ok(!slip2.includes("\\"), "Must not contain backslash");
  assert.strictEqual(slip2, "windows_system32_key2.pdf");

  const slip3 = sanitizeRecipientFilename({ name: "....//secret.txt" }, "key3");
  assert.ok(!slip3.includes(".."), "Must not contain ..");
  assert.strictEqual(slip3, "secret.txt_key3.pdf");

  // 3. Illegal OS Characters & Control Codes
  console.log("3. Illegal OS Characters");
  const illegal = sanitizeRecipientFilename(
    { name: 'John: *The "Master"? <Award> | #1\x00\x1f' },
    "key_x"
  );
  // eslint-disable-next-line no-control-regex
  assert.ok(!/[<>:"/\\|?*\x00-\x1f]/.test(illegal), "Must scrub illegal OS characters");
  assert.strictEqual(illegal, "John_The_Master_Award_#1_key_x.pdf");

  // 4. Windows Reserved Device Names
  console.log("4. Windows Reserved Device Names");
  assert.strictEqual(
    sanitizeRecipientFilename({ name: "CON" }, "key_con"),
    "doc_CON_key_con.pdf"
  );
  assert.strictEqual(
    sanitizeRecipientFilename({ name: "con.txt" }, "key_con2"),
    "doc_con.txt_key_con2.pdf"
  );
  assert.strictEqual(
    sanitizeRecipientFilename({ name: "PRN" }, "key_prn"),
    "doc_PRN_key_prn.pdf"
  );
  assert.strictEqual(
    sanitizeRecipientFilename({ name: "AUX" }, "key_aux"),
    "doc_AUX_key_aux.pdf"
  );
  assert.strictEqual(
    sanitizeRecipientFilename({ name: "NUL" }, "key_nul"),
    "doc_NUL_key_nul.pdf"
  );
  assert.strictEqual(
    sanitizeRecipientFilename({ name: "COM1" }, "key_com"),
    "doc_COM1_key_com.pdf"
  );
  assert.strictEqual(
    sanitizeRecipientFilename({ name: "LPT9" }, "key_lpt"),
    "doc_LPT9_key_lpt.pdf"
  );

  // 5. Length Clamping (120 chars)
  console.log("5. Length Clamping");
  const longName = "A".repeat(200);
  const clamped = sanitizeRecipientFilename({ name: longName }, "key_long");
  const baseName = clamped.replace("_key_long.pdf", "");
  assert.ok(baseName.length <= 120, `Base name length (${baseName.length}) must be <= 120`);
  assert.strictEqual(baseName.length, 120);

  // 6. Collision Prevention via Unique Suffix
  console.log("6. Collision Prevention");
  const outA = sanitizeRecipientFilename({ name: "John Doe" }, "row_001");
  const outB = sanitizeRecipientFilename({ name: "John Doe" }, "row_002");
  assert.notStrictEqual(outA, outB, "Identical recipient names must yield distinct filenames");
  assert.strictEqual(outA, "John_Doe_row_001.pdf");
  assert.strictEqual(outB, "John_Doe_row_002.pdf");

  // 7. Unicode & Emoji Handling
  console.log("7. Unicode & Emoji Handling");
  const unicodeName = sanitizeRecipientFilename({ name: "Renée Müller 🎓" }, "rec_uni");
  assert.strictEqual(unicodeName, "Renée_Müller_🎓_rec_uni.pdf");

  // 8. sanitizeFilenameBase direct utility
  console.log("8. sanitizeFilenameBase Utility");
  assert.strictEqual(sanitizeFilenameBase("  my / cool * batch name?  "), "my_cool_batch_name");
  assert.strictEqual(sanitizeFilenameBase("..."), "document");
  assert.strictEqual(sanitizeFilenameBase(""), "document");

  console.log("🎉 All Filename Sanitizer Tests Passed Successfully!");
}

runTests();
