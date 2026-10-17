/**
 * @file claim-delivery.ts
 * @description Document authorization, preview session validation, and secure delivery (PRD-CORE-11).
 * @architecture Validates session token hashes against MongoDB, guarantees IDOR/BOLA defense
 *               by strictly scoping download authorization to session.recipientId, and validates
 *               logical portal expiry before authorizing artifact delivery.
 */

import crypto from 'node:crypto';
import { ClaimPortal, IClaimPortal } from '../models/ClaimPortal.js';
import { ClaimSession, IClaimSession } from '../models/ClaimSession.js';
import { ClaimRecipientState } from '../models/ClaimRecipientState.js';
import { ApprovedRecipient, IApprovedRecipientDoc } from '../models/ApprovedRecipient.js';
import { ClaimNotAvailableError } from './participant-claim.js';

export class ClaimSessionInvalidError extends Error {
  code = 'SESSION_INVALID';
  status = 401;
  constructor(message = 'Session is invalid or expired. Please re-authenticate.') {
    super(message);
    this.name = 'ClaimSessionInvalidError';
  }
}

export class ClaimPortalInactiveError extends Error {
  code = 'PORTAL_INACTIVE';
  status = 410;
  constructor(message = 'This claim portal is no longer active or has expired.') {
    super(message);
    this.name = 'ClaimPortalInactiveError';
  }
}

export interface ValidatedSession {
  portal: IClaimPortal;
  session: IClaimSession;
  recipient: IApprovedRecipientDoc;
}

export interface AuthorizedDownloadPayload {
  downloadUrl: string;
  filename: string;
  mimeType: string;
  recipientName: string;
  outputKey: string | null;
}

/**
 * Validates a participant claim session token against portal state and database hash (AC-014, AC-016, AC-017).
 *
 * @param {string} publicSlug - Portal public slug.
 * @param {string} rawToken - Plaintext session token from cookie.
 * @returns {Promise<ValidatedSession>}
 */
export async function validateClaimSession(
  publicSlug: string,
  rawToken: string
): Promise<ValidatedSession> {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new ClaimSessionInvalidError();
  }

  const sessionTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const session = await ClaimSession.findOne({
    sessionTokenHash,
    revokedAt: { $exists: false },
  });

  if (!session) {
    throw new ClaimSessionInvalidError();
  }

  const now = new Date();
  if (now >= session.expiresAt) {
    throw new ClaimSessionInvalidError('Claim session has expired.');
  }

  const portal = await ClaimPortal.findById(session.portalId);
  if (!portal || portal.publicSlug !== publicSlug) {
    throw new ClaimSessionInvalidError();
  }

  // Logical expiry and status checks
  if (portal.status !== 'active' || now >= portal.expiresAt) {
    throw new ClaimPortalInactiveError();
  }

  // Recipient state check (revoked/excluded)
  const recipientState = await ClaimRecipientState.findOne({
    portalId: portal._id,
    recipientId: session.recipientId,
  });

  if (recipientState && (recipientState.status === 'revoked' || recipientState.status === 'excluded')) {
    throw new ClaimNotAvailableError();
  }

  const recipient = await ApprovedRecipient.findById(session.recipientId);
  if (!recipient) {
    throw new ClaimSessionInvalidError('Approved recipient record not found.');
  }

  // Update session lastUsedAt
  session.lastUsedAt = now;
  await session.save();

  return { portal, session, recipient };
}

/**
 * Authorizes certificate download payload strictly from session context, ignoring client inputs (AC-011).
 *
 * @param {string} publicSlug - Portal public slug.
 * @param {string} rawToken - Session token.
 * @returns {Promise<AuthorizedDownloadPayload>}
 */
export async function getAuthorizedDownloadPayload(
  publicSlug: string,
  rawToken: string
): Promise<AuthorizedDownloadPayload> {
  const { portal, recipient } = await validateClaimSession(publicSlug, rawToken);

  const recipientName =
    recipient.effectiveData?.['Name'] ||
    recipient.effectiveData?.['Full Name'] ||
    recipient.effectiveData?.['name'] ||
    recipient.recipientKey ||
    'Participant';

  const sanitizedName = recipientName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${sanitizedName}_certificate.pdf`;

  // Anti-IDOR: URL points directly to verified recipient's output or authorized proxy
  const downloadUrl = recipient.outputKey
    ? `/api/storage/file/${recipient.outputKey}`
    : `/api/public/claim-portals/${encodeURIComponent(publicSlug)}/documents/${recipient._id}`;

  return {
    downloadUrl,
    filename,
    mimeType: 'application/pdf',
    recipientName,
    outputKey: recipient.outputKey,
  };
}

/**
 * Revokes an active claim session immediately.
 *
 * @param {string} rawToken - Raw session token.
 * @returns {Promise<boolean>}
 */
export async function revokeClaimSession(rawToken: string): Promise<boolean> {
  if (!rawToken || typeof rawToken !== 'string') return false;

  const sessionTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const result = await ClaimSession.updateOne(
    { sessionTokenHash, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );

  return result.modifiedCount > 0;
}
