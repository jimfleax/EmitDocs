/**
 * @file participant-claim.ts
 * @description Participant claim authentication and public portal metadata service (PRD-CORE-11).
 * @architecture Provides safe, unauthenticated portal metadata without exposing participant PII or IDs.
 *               Authenticates participant credentials using constant-time keyed HMAC verifiers.
 *               Enforces anti-enumeration defenses, atomic claim counters, and scoped 15-min sessions.
 */

import crypto from 'node:crypto';
import { ClaimPortal, IClaimPortal } from '../models/ClaimPortal.js';
import { ClaimCredentialSet, IClaimCredentialSet } from '../models/ClaimCredentialSet.js';
import { ClaimCredential } from '../models/ClaimCredential.js';
import { ClaimRecipientState } from '../models/ClaimRecipientState.js';
import { ClaimSession } from '../models/ClaimSession.js';
import { ApprovedRecipient } from '../models/ApprovedRecipient.js';
import {
  canonicalizeCredential,
  canonicalizePair,
  computeCredentialVerifier,
} from './keyed-verifier.js';
import {
  checkAndIncrementRateLimit,
  recordFailedAttempt,
  isTurnstileRequired,
} from './claim-rate-limiter.js';
import { verifyTurnstileToken } from './turnstile.js';

function getClaimPortalHmacSecret(): string {
  const secret = process.env.CLAIM_PORTAL_HMAC_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
      throw new Error(
        'CLAIM_PORTAL_HMAC_SECRET must be set and at least 32 bytes when NODE_ENV is production'
      );
    }
    return secret;
  }
  return secret || 'emitdocs_default_portal_hmac_secret_for_dev_test_mode_minimum_32_bytes_long';
}

export const CLAIM_PORTAL_HMAC_SECRET = getClaimPortalHmacSecret();

export const GENERIC_CLAIM_ERROR_MESSAGE =
  "We couldn't complete this claim. Check the details and try again, or contact the organizer.";

export class ClaimPortalNotFoundError extends Error {
  code = 'PORTAL_NOT_FOUND';
  status = 404;
  constructor(message = 'Claim portal not found') {
    super(message);
    this.name = 'ClaimPortalNotFoundError';
  }
}

export class ClaimRateLimitExceededError extends Error {
  code = 'RATE_LIMIT_EXCEEDED';
  status = 429;
  retryAfter?: number;
  constructor(message = 'Too many claim attempts. Please wait and try again.', retryAfter?: number) {
    super(message);
    this.name = 'ClaimRateLimitExceededError';
    this.retryAfter = retryAfter;
  }
}

export class ClaimTurnstileRequiredError extends Error {
  code = 'TURNSTILE_REQUIRED';
  status = 400;
  constructor(message = 'Bot verification challenge required. Please complete verification.') {
    super(message);
    this.name = 'ClaimTurnstileRequiredError';
  }
}

export class ClaimNotAvailableError extends Error {
  code = 'CLAIM_NOT_AVAILABLE';
  status = 400;
  constructor(message = GENERIC_CLAIM_ERROR_MESSAGE) {
    super(message);
    this.name = 'ClaimNotAvailableError';
  }
}

export interface PublicPortalMetadata {
  label: string;
  instructions?: string;
  status: string;
  credentialMode: string;
  primaryFieldLabel: string;
  secondaryFieldLabel?: string;
  expiresAt: Date;
}

export interface AuthenticateClaimInput {
  primaryCredential: string;
  secondaryCredential?: string;
  turnstileToken?: string;
}

export interface AuthenticateClaimResult {
  rawSessionToken: string;
  recipientName: string;
  snapshotId: string;
  recipientId: string;
  expiresAt: Date;
}

/**
 * Returns safe public portal metadata without exposing recipient lists, emails, or internal IDs (AC-010).
 *
 * @param {string} publicSlug - Public alphanumeric portal slug.
 * @returns {Promise<PublicPortalMetadata>}
 */
export async function getPublicPortalMetadata(publicSlug: string): Promise<PublicPortalMetadata> {
  const portal = await ClaimPortal.findOne({ publicSlug }).lean<IClaimPortal>();
  if (!portal) {
    throw new ClaimPortalNotFoundError();
  }

  const isExpired = new Date() >= new Date(portal.expiresAt);
  const effectiveStatus = isExpired ? 'expired' : portal.status;

  const credSet = await ClaimCredentialSet.findOne({
    portalId: portal._id,
    revision: portal.credentialSetRevision,
  }).lean<IClaimCredentialSet | null>();

  return {
    label: portal.label,
    instructions: portal.instructions,
    status: effectiveStatus,
    credentialMode: portal.credentialMode,
    primaryFieldLabel:
      credSet?.primaryFieldKey ||
      (portal.credentialMode === 'generated_token' ? 'Claim Token' : 'Primary ID'),
    secondaryFieldLabel: credSet?.secondaryFieldKey,
    expiresAt: portal.expiresAt,
  };
}

/**
 * Authenticates participant claim against keyed HMAC verifiers and issues a scoped session (AC-012, AC-014, AC-015).
 *
 * @param {string} publicSlug - Portal public slug.
 * @param {AuthenticateClaimInput} input - Participant input credentials.
 * @param {string} ip - Client IP.
 * @returns {Promise<AuthenticateClaimResult>}
 */
export async function authenticateClaim(
  publicSlug: string,
  input: AuthenticateClaimInput,
  ip: string
): Promise<AuthenticateClaimResult> {
  const portal = await ClaimPortal.findOne({ publicSlug });
  if (!portal) {
    throw new ClaimPortalNotFoundError();
  }

  // 1. Enforce rate limiting
  const rateLimit = await checkAndIncrementRateLimit(portal._id.toString(), ip);
  if (!rateLimit.allowed) {
    throw new ClaimRateLimitExceededError(undefined, rateLimit.retryAfter);
  }

  // 2. Check Turnstile bot defense
  const turnstileNeeded = await isTurnstileRequired(portal._id.toString(), ip);
  if (turnstileNeeded) {
    if (!input.turnstileToken) {
      throw new ClaimTurnstileRequiredError();
    }
    const verifyRes = await verifyTurnstileToken(input.turnstileToken, ip);
    if (!verifyRes.success) {
      throw new ClaimTurnstileRequiredError();
    }
  }

  // 3. Portal active & not expired check
  const now = new Date();
  if (portal.status !== 'active' || now >= portal.expiresAt) {
    throw new ClaimNotAvailableError();
  }

  // 4. Compute canonical credential verifier
  const canonicalVal =
    portal.credentialMode === 'imported_credential' && input.secondaryCredential
      ? canonicalizePair(input.primaryCredential, input.secondaryCredential)
      : canonicalizeCredential(input.primaryCredential);

  if (!canonicalVal) {
    await recordFailedAttempt(portal._id.toString(), ip);
    throw new ClaimNotAvailableError();
  }

  const credentialVerifier = computeCredentialVerifier(
    CLAIM_PORTAL_HMAC_SECRET,
    portal._id.toString(),
    portal.credentialSetRevision,
    canonicalVal
  );

  // 5. Query active ClaimCredential
  const credential = await ClaimCredential.findOne({
    portalId: portal._id,
    credentialSetRevision: portal.credentialSetRevision,
    credentialVerifier,
    status: 'active',
  });

  if (!credential) {
    await recordFailedAttempt(portal._id.toString(), ip);
    throw new ClaimNotAvailableError();
  }

  // 6. Recipient state checks (revoked, excluded, expired)
  const recipientState = await ClaimRecipientState.findOne({
    portalId: portal._id,
    recipientId: credential.recipientId,
  });

  if (recipientState && (recipientState.status === 'revoked' || recipientState.status === 'excluded' || recipientState.status === 'expired')) {
    await recordFailedAttempt(portal._id.toString(), ip);
    throw new ClaimNotAvailableError();
  }

  // 7. Atomic Claim State Update & Unique Claimed Count increment (AC-015)
  const prevState = await ClaimRecipientState.findOneAndUpdate(
    { portalId: portal._id, recipientId: credential.recipientId },
    {
      $set: {
        status: 'claimed',
        lastClaimAt: now,
        credentialSetRevision: portal.credentialSetRevision,
        snapshotId: portal.snapshotId,
      },
      $setOnInsert: {
        firstClaimAt: now,
      },
    },
    { upsert: true, new: false }
  );

  const isFirstClaim = !prevState || prevState.status !== 'claimed';

  if (isFirstClaim) {
    await ClaimRecipientState.updateOne(
      { portalId: portal._id, recipientId: credential.recipientId, firstClaimAt: { $exists: false } },
      { $set: { firstClaimAt: now } }
    );
    await ClaimPortal.updateOne(
      { _id: portal._id },
      { $inc: { uniqueClaimedCount: 1 } }
    );
  }

  // 8. Fetch recipient details for greeting
  const approvedRecipient = await ApprovedRecipient.findById(credential.recipientId).lean<any>();
  const recipientName =
    approvedRecipient?.effectiveData?.['Name'] ||
    approvedRecipient?.effectiveData?.['Full Name'] ||
    approvedRecipient?.effectiveData?.['name'] ||
    approvedRecipient?.recipientKey ||
    'Participant';

  // 9. Generate 32-byte CSPRNG Session Token & store SHA-256 hash
  const rawSessionToken = crypto.randomBytes(32).toString('base64url');
  const sessionTokenHash = crypto.createHash('sha256').update(rawSessionToken).digest('hex');

  const sessionDurationMs = 15 * 60 * 1000; // 15 minutes
  const sessionExpiresAt = new Date(Math.min(now.getTime() + sessionDurationMs, portal.expiresAt.getTime()));

  await ClaimSession.create({
    sessionTokenHash,
    portalId: portal._id,
    recipientId: credential.recipientId,
    credentialSetRevision: portal.credentialSetRevision,
    expiresAt: sessionExpiresAt,
  });

  return {
    rawSessionToken,
    recipientName,
    snapshotId: portal.snapshotId.toString(),
    recipientId: credential.recipientId.toString(),
    expiresAt: sessionExpiresAt,
  };
}
