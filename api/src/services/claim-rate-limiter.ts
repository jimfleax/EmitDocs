/**
 * @file claim-rate-limiter.ts
 * @description Serverless atomic rate limiting and bot defense tracking backed by MongoDB (PRD-CORE-11).
 * @architecture Pseudonymizes client IPs with HMAC-SHA-256 and rotating salt.
 *               Uses atomic findOneAndUpdate with $inc and $setOnInsert to prevent race conditions.
 *               Enforces adaptive Cloudflare Turnstile triggers when failed attempts exceed thresholds.
 */

import crypto from 'node:crypto';
import { ClaimRateLimit } from '../models/ClaimRateLimit.js';

export function getClaimRateLimitSalt(): string {
  const salt = process.env.CLAIM_RATE_LIMIT_SALT;
  if (process.env.NODE_ENV === 'production') {
    if (!salt || salt.trim() === '') {
      throw new Error(
        'CLAIM_RATE_LIMIT_SALT must be set when NODE_ENV is production'
      );
    }
    return salt;
  }
  return salt || 'emitdocs_dev_claim_rate_limit_salt';
}

export const ROTATING_SALT = getClaimRateLimitSalt();

/**
 * Pseudonymizes client IP address to prevent storing plaintext PII while allowing windowed throttling.
 *
 * @param {string} ip - Raw client IP.
 * @returns {string} 16-character hex digest of HMAC-SHA-256.
 */
export function pseudonymizeIp(ip: string): string {
  const normalized = (ip || '127.0.0.1').trim();
  return crypto.createHmac('sha256', ROTATING_SALT).update(normalized).digest('hex').slice(0, 16);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

/**
 * Atomically checks and increments rate limit for a portal and pseudonymized IP within a sliding window.
 *
 * @param {string} portalId - Target claim portal ID.
 * @param {string} ip - Client IP.
 * @param {number} [limit=30] - Max requests permitted in the window.
 * @param {number} [windowSec=60] - Window duration in seconds.
 * @returns {Promise<RateLimitResult>}
 */
export async function checkAndIncrementRateLimit(
  portalId: string,
  ip: string,
  limit = 30,
  windowSec = 60
): Promise<RateLimitResult> {
  const hashedIp = pseudonymizeIp(ip);
  const currentWindow = Math.floor(Date.now() / (windowSec * 1000));
  const key = `prl:${portalId}:${hashedIp}:${currentWindow}`;
  const expiresAt = new Date((currentWindow + 2) * windowSec * 1000);

  const doc = await ClaimRateLimit.findOneAndUpdate(
    { key },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
    { upsert: true, new: true }
  );

  const count = doc?.count ?? 1;
  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);
  const retryAfter = allowed
    ? undefined
    : Math.ceil(((currentWindow + 1) * windowSec * 1000 - Date.now()) / 1000);

  return { allowed, remaining, retryAfter };
}

/**
 * Records a failed credential verification attempt.
 * If failed attempts within a 5-minute window reach 5 or more, requires Turnstile verification.
 *
 * @param {string} portalId - Target claim portal ID.
 * @param {string} ip - Client IP.
 * @returns {Promise<{ requiresTurnstile: boolean; failedAttempts: number }>}
 */
export async function recordFailedAttempt(
  portalId: string,
  ip: string
): Promise<{ requiresTurnstile: boolean; failedAttempts: number }> {
  const hashedIp = pseudonymizeIp(ip);
  const windowSec = 300; // 5-minute window
  const currentWindow = Math.floor(Date.now() / (windowSec * 1000));
  const key = `pfl:${portalId}:${hashedIp}:${currentWindow}`;
  const expiresAt = new Date((currentWindow + 2) * windowSec * 1000);

  const doc = await ClaimRateLimit.findOneAndUpdate(
    { key },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
    { upsert: true, new: true }
  );

  const failedAttempts = doc?.count ?? 1;
  return {
    requiresTurnstile: failedAttempts >= 5,
    failedAttempts,
  };
}

/**
 * Checks whether client has exceeded failed attempt threshold without incrementing.
 *
 * @param {string} portalId - Target claim portal ID.
 * @param {string} ip - Client IP.
 * @returns {Promise<boolean>} True if Turnstile challenge is mandatory.
 */
export async function isTurnstileRequired(portalId: string, ip: string): Promise<boolean> {
  const hashedIp = pseudonymizeIp(ip);
  const windowSec = 300;
  const currentWindow = Math.floor(Date.now() / (windowSec * 1000));
  const key = `pfl:${portalId}:${hashedIp}:${currentWindow}`;

  const doc = await ClaimRateLimit.findOne({ key });
  return (doc?.count ?? 0) >= 5;
}
