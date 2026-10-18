/**
 * @file keyed-verifier.ts
 * @description Cryptographic utilities and strength evaluation for PRD-CORE-11 Shared Claim Portal.
 * @architecture Provides secure CSPRNG token generation, length-prefixed canonicalization,
 *               keyed HMAC-SHA-256 verifier computation, timing-safe string comparison,
 *               and entropy/collision checks for single-field imported credentials.
 * @agent_note Raw secret tokens or credentials must never be persisted, logged, or returned in plain text.
 */

import crypto from "node:crypto";

/**
 * Result of evaluating imported credential strength and uniqueness.
 */
export interface CredentialStrengthResult {
  strong: boolean;
  reason?: string;
  collisions: string[];
}

/**
 * Generates an array of cryptographically secure pseudo-random tokens.
 * Uses 32 random bytes encoded in base64url format (~43 characters, 256 bits of entropy).
 *
 * @param {number} count - Number of tokens to generate.
 * @returns {string[]} Array of secure URL-safe base64 tokens.
 */
export function generateSecureTokens(count: number): string[] {
  if (count <= 0) return [];
  const tokens: string[] = [];
  for (let i = 0; i < count; i++) {
    tokens.push(crypto.randomBytes(32).toString("base64url"));
  }
  return tokens;
}

/**
 * Canonicalizes a raw credential string by trimming outer whitespace
 * while strictly preserving leading zeros and case sensitivity.
 *
 * @param {string} val - Raw input credential.
 * @returns {string} Trimmed, case-preserved canonical string.
 */
export function canonicalizeCredential(val: string): string {
  return String(val ?? "").trim();
}

/**
 * Combines primary and secondary credentials into a length-prefixed, unambiguous canonical string:
 * `${primary.length}:${primary}:${secondary.length}:${secondary}`.
 * This guarantees no boundary collision or delimiter injection between fields.
 *
 * @param {string} primary - Primary credential field value.
 * @param {string} secondary - Secondary credential field value.
 * @returns {string} Unambiguous length-prefixed canonical pair string.
 */
export function canonicalizePair(primary: string, secondary: string): string {
  const p = canonicalizeCredential(primary);
  const s = canonicalizeCredential(secondary);
  return `${p.length}:${p}:${s.length}:${s}`;
}

/**
 * Computes a keyed HMAC-SHA-256 verifier for a canonical credential string.
 * Formats payload as `${portalId}:${setRevision}:${canonicalCredential}`.
 * Raw credentials are never stored in databases; only this deterministic HMAC verifier is saved.
 *
 * @param {string} secretKey - Server-side secret key (CLAIM_PORTAL_HMAC_SECRET).
 * @param {string} portalId - ID of the claim portal.
 * @param {number} setRevision - Active revision number of the credential set.
 * @param {string} canonicalCredential - Canonicalized single or paired credential.
 * @returns {string} 64-character lowercase hex digest of the HMAC.
 */
export function computeCredentialVerifier(
  secretKey: string,
  portalId: string,
  setRevision: number,
  canonicalCredential: string
): string {
  const payload = `${portalId}:${setRevision}:${canonicalCredential}`;
  return crypto.createHmac("sha256", secretKey).update(payload).digest("hex");
}

/**
 * Performs a constant-time comparison between two strings to mitigate timing attack side-channels.
 *
 * @param {string} a - First string.
 * @param {string} b - Second string.
 * @returns {boolean} True if strings are identical, false otherwise.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Internal helper to check whether a string forms an ascending or descending sequential sequence.
 */
function isSequential(str: string): boolean {
  if (str.length < 3) return false;
  let inc = 0;
  let dec = 0;
  for (let i = 1; i < str.length; i++) {
    const diff = str.charCodeAt(i) - str.charCodeAt(i - 1);
    if (diff === 1) inc++;
    else if (diff === -1) dec++;
  }
  return inc === str.length - 1 || dec === str.length - 1;
}

/**
 * Evaluates the cryptographic strength and uniqueness of imported credentials.
 * Requirements:
 * - Minimum length >= 12 characters.
 * - Rejects pure numeric sequences (requires secondary factor).
 * - Rejects repeated character patterns.
 * - Rejects sequential character sequences.
 * - Detects duplicate collisions across records (blocks portal activation).
 *
 * @param {string[]} values - Array of raw or canonical imported credential values.
 * @returns {CredentialStrengthResult} Strength status, explanation if weak, and detected collision list.
 */
export function evaluateImportedCredentialStrength(values: string[]): CredentialStrengthResult {
  if (!values || values.length === 0) {
    return { strong: false, reason: "No credential values provided", collisions: [] };
  }

  const seen = new Set<string>();
  const collisionSet = new Set<string>();

  for (const raw of values) {
    const canonical = canonicalizeCredential(raw);
    if (seen.has(canonical)) {
      collisionSet.add(canonical);
    }
    seen.add(canonical);
  }

  const collisions = Array.from(collisionSet);
  if (collisions.length > 0) {
    return {
      strong: false,
      reason: `Duplicate credential collisions detected (${collisions.length} collision${collisions.length === 1 ? "" : "s"})`,
      collisions,
    };
  }

  for (let i = 0; i < values.length; i++) {
    const raw = values[i];
    const val = canonicalizeCredential(raw);
    if (val.length < 12) {
      return {
        strong: false,
        reason: `Credential at row ${i + 1} is shorter than minimum required 12 characters (${val.length} chars)`,
        collisions: [],
      };
    }
    if (/^\d+$/.test(val)) {
      return {
        strong: false,
        reason: `Credential at row ${i + 1} is purely numeric; secondary factor is required`,
        collisions: [],
      };
    }
    if (/^(.)\1+$/.test(val) || new Set(val).size <= 2) {
      return {
        strong: false,
        reason: `Credential at row ${i + 1} contains repeated characters`,
        collisions: [],
      };
    }
    if (isSequential(val)) {
      return {
        strong: false,
        reason: `Credential at row ${i + 1} contains a sequential character pattern`,
        collisions: [],
      };
    }
  }

  return { strong: true, collisions: [] };
}
