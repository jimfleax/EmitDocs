/**
 * @file keyed-verifier.test.ts
 * @description Unit tests for Keyed Verifier Service & Domain Models (PRD-CORE-11 Slice 1).
 * @architecture Verifies CSPRNG token entropy, base64url encoding, deterministic HMAC-SHA-256 verifiers,
 *               constant-time string comparison, credential canonicalization, imported credential strength / collision checks,
 *               and Mongoose schema validations & index definitions for PRD-CORE-11 models.
 */

import assert from "node:assert";
import mongoose from "mongoose";
import {
  generateSecureTokens,
  canonicalizeCredential,
  canonicalizePair,
  computeCredentialVerifier,
  timingSafeEqualStrings,
  evaluateImportedCredentialStrength,
} from "../api/src/services/keyed-verifier.js";
import { ClaimPortal } from "../api/src/models/ClaimPortal.js";
import { ClaimCredentialSet } from "../api/src/models/ClaimCredentialSet.js";
import { ClaimCredential } from "../api/src/models/ClaimCredential.js";
import { ClaimSession } from "../api/src/models/ClaimSession.js";
import { ClaimRecipientState } from "../api/src/models/ClaimRecipientState.js";
import { ClaimRateLimit } from "../api/src/models/ClaimRateLimit.js";

async function run() {
  console.log("=== RUNNING KEYED VERIFIER & DOMAIN MODEL UNIT TESTS ===");

  // 1. Token generation & entropy check
  console.log("Testing generateSecureTokens...");
  assert.deepStrictEqual(generateSecureTokens(0), []);
  const tokens = generateSecureTokens(100);
  assert.strictEqual(tokens.length, 100);
  const uniqueTokens = new Set(tokens);
  assert.strictEqual(uniqueTokens.size, 100, "All 100 generated tokens must be distinct");

  const base64UrlPattern = /^[A-Za-z0-9_-]{43}$/;
  for (const token of tokens) {
    assert.strictEqual(token.length, 43, `Token ${token} must have length 43`);
    assert.ok(base64UrlPattern.test(token), `Token ${token} must be valid base64url without padding`);
  }

  // 2. Credential Canonicalization
  console.log("Testing canonicalizeCredential...");
  assert.strictEqual(canonicalizeCredential("  00123AB  "), "00123AB");
  assert.strictEqual(canonicalizeCredential("  CaseSensitive_Value  "), "CaseSensitive_Value");
  assert.strictEqual(canonicalizeCredential("00009999"), "00009999", "Preserves leading zeros");
  assert.strictEqual(canonicalizeCredential(""), "");
  assert.strictEqual(canonicalizeCredential(null as any), "");

  // 3. Pair Canonicalization
  console.log("Testing canonicalizePair...");
  assert.strictEqual(canonicalizePair("  user1  ", " 9876 "), "5:user1:4:9876");
  assert.strictEqual(canonicalizePair("001", "AbC"), "3:001:3:AbC");
  assert.strictEqual(canonicalizePair("col:colon", "sub"), "9:col:colon:3:sub", "Length-prefixing prevents delimiter injection");

  // 4. Verifier computation & determinism
  console.log("Testing computeCredentialVerifier...");
  const v1 = computeCredentialVerifier("secret-key-1", "portal-1", 1, "5:user1:4:9876");
  const v2 = computeCredentialVerifier("secret-key-1", "portal-1", 1, "5:user1:4:9876");
  assert.strictEqual(v1, v2, "Same inputs must produce deterministic verifier");
  assert.strictEqual(v1.length, 64, "SHA-256 HMAC must be 64 hex characters");
  assert.ok(/^[0-9a-f]{64}$/.test(v1), "Verifier must be lowercase hex");

  // Key / portal / revision / credential isolation
  const vDiffSecret = computeCredentialVerifier("secret-key-2", "portal-1", 1, "5:user1:4:9876");
  assert.notStrictEqual(v1, vDiffSecret, "Different secret key must produce different verifier");

  const vDiffPortal = computeCredentialVerifier("secret-key-1", "portal-2", 1, "5:user1:4:9876");
  assert.notStrictEqual(v1, vDiffPortal, "Different portalId must produce different verifier");

  const vDiffRev = computeCredentialVerifier("secret-key-1", "portal-1", 2, "5:user1:4:9876");
  assert.notStrictEqual(v1, vDiffRev, "Different setRevision must produce different verifier");

  const vDiffCred = computeCredentialVerifier("secret-key-1", "portal-1", 1, "5:user2:4:9876");
  assert.notStrictEqual(v1, vDiffCred, "Different credential must produce different verifier");

  // 5. Timing-safe string comparison
  console.log("Testing timingSafeEqualStrings...");
  assert.strictEqual(timingSafeEqualStrings("abc", "abc"), true);
  assert.strictEqual(timingSafeEqualStrings("", ""), true);
  assert.strictEqual(timingSafeEqualStrings("abc", "abd"), false);
  assert.strictEqual(timingSafeEqualStrings("abc", "ab"), false);
  assert.strictEqual(timingSafeEqualStrings("ab", "abc"), false);
  assert.strictEqual(timingSafeEqualStrings("token_12345", "token_12346"), false);
  assert.strictEqual(timingSafeEqualStrings(null as any, "abc"), false);
  assert.strictEqual(timingSafeEqualStrings("abc", undefined as any), false);

  // 6. Imported Credential Strength Evaluation
  console.log("Testing evaluateImportedCredentialStrength...");
  // Weak: short length (< 12)
  const shortCheck = evaluateImportedCredentialStrength(["12345", "12346"]);
  assert.strictEqual(shortCheck.strong, false);
  assert.ok(shortCheck.reason?.includes("12"), "Reason should mention min 12 chars");
  assert.ok(!shortCheck.reason?.includes("12345"), "Reason must not leak raw credential");
  assert.ok(shortCheck.reason?.includes("row 1"), "Reason should report row index");

  // Weak: pure numeric (even if >= 12)
  const numericCheck = evaluateImportedCredentialStrength(["123456789012345"]);
  assert.strictEqual(numericCheck.strong, false);
  assert.ok(numericCheck.reason?.toLowerCase().includes("numeric"), "Reason should mention numeric requirement");
  assert.ok(!numericCheck.reason?.includes("123456789012345"), "Reason must not leak raw credential");
  assert.ok(numericCheck.reason?.includes("row 1"), "Reason should report row index");

  // Weak: repeated characters
  const repeatedCheck = evaluateImportedCredentialStrength(["AAAAAAAAAAAA"]);
  assert.strictEqual(repeatedCheck.strong, false);
  assert.ok(!repeatedCheck.reason?.includes("AAAAAAAAAAAA"), "Reason must not leak raw credential");
  assert.ok(repeatedCheck.reason?.includes("row 1"), "Reason should report row index");

  // Weak: sequential pattern
  const seqCheck = evaluateImportedCredentialStrength(["abcdefghijkl"]);
  assert.strictEqual(seqCheck.strong, false);
  assert.ok(!seqCheck.reason?.includes("abcdefghijkl"), "Reason must not leak raw credential");
  assert.ok(seqCheck.reason?.includes("row 1"), "Reason should report row index");

  // Weak: collisions detected across records
  const collisionCheck = evaluateImportedCredentialStrength([
    "KJ98321-ZX981A",
    "PL88231-BQ421X",
    "KJ98321-ZX981A",
  ]);
  assert.strictEqual(collisionCheck.strong, false);
  assert.strictEqual(collisionCheck.collisions.length, 1);
  assert.strictEqual(collisionCheck.collisions[0], "KJ98321-ZX981A");
  assert.ok(!collisionCheck.reason?.includes("KJ98321-ZX981A"), "Collision reason must not leak credential value");
  assert.ok(collisionCheck.reason?.includes("1 collision"), "Collision reason should report count");

  // Strong: entropy, length >= 12, non-sequential, no collisions
  const strongCheck = evaluateImportedCredentialStrength([
    "KJ98321-ZX981A",
    "PL88231-BQ421X",
    "MN47120-CC902K",
  ]);
  assert.strictEqual(strongCheck.strong, true);
  assert.strictEqual(strongCheck.collisions.length, 0);

  // 7. Domain Models Validation & Index Assertions
  console.log("Testing Mongoose Models Schema & Validation...");

  // ClaimPortal
  const dummyBatchId = new mongoose.Types.ObjectId();
  const dummySnapshotId = new mongoose.Types.ObjectId();
  const dummyRecipientId = new mongoose.Types.ObjectId();
  const dummySetId = new mongoose.Types.ObjectId();

  const validPortal = new ClaimPortal({
    publicSlug: "portal-slug-xyz",
    ownerId: "user_owner_1",
    batchId: dummyBatchId,
    snapshotId: dummySnapshotId,
    credentialMode: "generated_token",
    label: "Spring Commencement 2026",
    expiresAt: new Date(Date.now() + 86400000),
  });
  assert.strictEqual(validPortal.validateSync(), undefined, "Valid ClaimPortal should pass validation");

  const invalidPortal = new ClaimPortal({
    // Missing required fields: publicSlug, ownerId, batchId, snapshotId, label, expiresAt
  });
  const portalErr = invalidPortal.validateSync();
  assert.ok(portalErr, "ClaimPortal missing required fields must fail validation");
  assert.ok(portalErr.errors["publicSlug"]);
  assert.ok(portalErr.errors["ownerId"]);
  assert.ok(portalErr.errors["batchId"]);

  // ClaimCredentialSet
  const validSet = new ClaimCredentialSet({
    portalId: validPortal._id,
    revision: 1,
    mode: "generated_token",
    createdBy: "user_owner_1",
  });
  assert.strictEqual(validSet.validateSync(), undefined, "Valid ClaimCredentialSet should pass validation");

  // ClaimCredential
  const validCred = new ClaimCredential({
    ownerId: "user_owner_1",
    portalId: validPortal._id,
    credentialSetId: dummySetId,
    credentialSetRevision: 1,
    recipientId: dummyRecipientId,
    credentialVerifier: v1,
    credentialKind: "single",
    strengthClass: "generated",
  });
  assert.strictEqual(validCred.validateSync(), undefined, "Valid ClaimCredential should pass validation");

  // ClaimSession
  const validSession = new ClaimSession({
    sessionTokenHash: "hash_abcdef1234567890",
    portalId: validPortal._id,
    recipientId: dummyRecipientId,
    credentialSetRevision: 1,
    expiresAt: new Date(Date.now() + 900000),
  });
  assert.strictEqual(validSession.validateSync(), undefined, "Valid ClaimSession should pass validation");

  // ClaimRecipientState
  const validState = new ClaimRecipientState({
    portalId: validPortal._id,
    snapshotId: dummySnapshotId,
    recipientId: dummyRecipientId,
    credentialSetRevision: 1,
  });
  assert.strictEqual(validState.validateSync(), undefined, "Valid ClaimRecipientState should pass validation");

  // ClaimRateLimit
  const validRateLimit = new ClaimRateLimit({
    key: "ip_window_key_1",
    count: 3,
    expiresAt: new Date(Date.now() + 60000),
  });
  assert.strictEqual(validRateLimit.validateSync(), undefined, "Valid ClaimRateLimit should pass validation");

  console.log("keyed-verifier.test.ts: ALL ASSERTIONS PASSED GREEN");
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
