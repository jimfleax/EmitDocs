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
import { ApprovedSnapshot } from '../models/ApprovedSnapshot.js';
import { TemplateVersion } from '../models/TemplateVersion.js';
import { TemplateLifecycle } from './template-lifecycle.js';
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
  const { recipient } = await validateClaimSession(publicSlug, rawToken);

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
    ? `/api/public/claim-portals/${encodeURIComponent(publicSlug)}/documents/${recipient.outputKey}`
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

export interface ClaimRenderPayload {
  recipientName: string;
  filename: string;
  fieldMappings: any[];
  effectiveData: Record<string, any>;
  templateVersion: number;
  outputKey: string | null;
}

/**
 * Retrieves the full generation payload (template field mappings and recipient effective data)
 * for an authorized claim session, allowing deterministic client-side or server-side custom PDF synthesis.
 */
export async function getClaimRenderPayload(
  publicSlug: string,
  rawToken: string
): Promise<ClaimRenderPayload> {
  const { portal, recipient } = await validateClaimSession(publicSlug, rawToken);

  const snapshot = await ApprovedSnapshot.findById(portal.snapshotId);
  if (!snapshot) {
    throw new ClaimSessionInvalidError('Snapshot for portal not found');
  }

  const version = await TemplateVersion.findById(snapshot.templateVersionId);
  if (!version) {
    throw new ClaimSessionInvalidError('Template version for snapshot not found');
  }

  const recipientName =
    recipient.effectiveData?.['Name'] ||
    recipient.effectiveData?.['Full Name'] ||
    recipient.effectiveData?.['name'] ||
    recipient.recipientKey ||
    'Participant';

  const sanitizedName = recipientName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${sanitizedName}_certificate.pdf`;

  return {
    recipientName,
    filename,
    fieldMappings: version.fieldMappings || [],
    effectiveData: recipient.effectiveData || {},
    templateVersion: version.version,
    outputKey: recipient.outputKey,
  };
}

/**
 * Retrieves the base PDF template stream for an authorized claim session.
 */
export async function getClaimTemplateAsset(
  publicSlug: string,
  rawToken: string
): Promise<{ body: any; filename: string }> {
  const { portal } = await validateClaimSession(publicSlug, rawToken);

  const snapshot = await ApprovedSnapshot.findById(portal.snapshotId);
  if (!snapshot) throw new ClaimSessionInvalidError('Snapshot not found');

  return TemplateLifecycle.streamAsset({
    templateId: snapshot.templateId.toString(),
    versionId: snapshot.templateVersionId.toString(),
    ownerId: portal.ownerId,
  });
}

/**
 * Retrieves the base PDF template bytes as Buffer for server-side overlay generation.
 */
export async function getClaimTemplateBaseBytes(
  portalId: string,
  ownerId: string,
  snapshotId: string
): Promise<Buffer | null> {
  try {
    const snapshot = await ApprovedSnapshot.findById(snapshotId);
    if (!snapshot) return null;

    const asset = await TemplateLifecycle.streamAsset({
      templateId: snapshot.templateId.toString(),
      versionId: snapshot.templateVersionId.toString(),
      ownerId,
    });

    if (asset && asset.body) {
      if (Buffer.isBuffer(asset.body)) return asset.body;
      const chunks: Buffer[] = [];
      const reader = (asset.body as any).getReader ? (asset.body as any).getReader() : null;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(Buffer.from(value));
        }
        return Buffer.concat(chunks);
      } else if (typeof (asset.body as any)[Symbol.asyncIterator] === 'function') {
        for await (const chunk of asset.body as any) {
          chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
      }
    }
  } catch {
    // Fallback if Cloudinary asset is missing or offline
  }
  return null;
}

