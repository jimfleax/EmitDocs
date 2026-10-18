/**
 * @file claim-delivery.ts
 * @description Document authorization, preview session validation, and secure delivery (PRD-CORE-11).
 * @architecture Validates session token hashes against MongoDB, guarantees IDOR/BOLA defense
 *               by strictly scoping download authorization to session.recipientId, and validates
 *               logical portal expiry before authorizing artifact delivery.
 * @agent_note Session tokens are single-purpose and stored hashed (SHA-256). Download URLs are strictly derived from the validated session context to prevent BOLA/IDOR.
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
 * @desc    Validates a participant claim session token against portal state and database hash (AC-014, AC-016, AC-017).
 * @param   {string} publicSlug - Portal public slug.
 * @param   {string} rawToken - Plaintext session token from cookie.
 * @returns {Promise<ValidatedSession>} Validated portal, session, and recipient documents.
 * @throws  {ClaimSessionInvalidError} If token is missing, invalid, or expired.
 * @throws  {ClaimPortalInactiveError} If portal is not active or has expired.
 * @throws  {ClaimNotAvailableError} If recipient state is revoked or excluded.
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
 * @desc    Authorizes certificate download payload strictly from session context, ignoring client inputs (AC-011).
 * @param   {string} publicSlug - Portal public slug.
 * @param   {string} rawToken - Session token.
 * @returns {Promise<AuthorizedDownloadPayload>}
 * @throws  {ClaimSessionInvalidError} If session token is invalid or expired.
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
 * @desc    Revokes an active claim session immediately by setting revokedAt timestamp.
 * @param   {string} rawToken - Raw session token.
 * @returns {Promise<boolean>} True if session was found and revoked, false otherwise.
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
 * @desc    Retrieves the full generation payload (template field mappings and recipient effective data) for an authorized claim session.
 * @param   {string} publicSlug - Portal public slug.
 * @param   {string} rawToken - Plaintext session token.
 * @returns {Promise<ClaimRenderPayload>} Render metadata, field mappings, and recipient effective data.
 * @throws  {ClaimSessionInvalidError} If session, snapshot, or template version is not found.
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
 * @desc    Retrieves the base PDF template stream for an authorized claim session.
 * @param   {string} publicSlug - Portal public slug.
 * @param   {string} rawToken - Plaintext session token.
 * @returns {Promise<{ body: any; filename: string }>} Binary stream and filename of the base template.
 * @throws  {ClaimSessionInvalidError} If session or snapshot is invalid.
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
 * @desc    Retrieves the base PDF template bytes as Buffer for server-side overlay generation.
 * @param   {string} portalId - Claim portal ID.
 * @param   {string} ownerId - Portal owner ID.
 * @param   {string} snapshotId - Approved snapshot ID.
 * @returns {Promise<Buffer | null>} Base PDF bytes as Buffer, or null if unresolvable.
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

