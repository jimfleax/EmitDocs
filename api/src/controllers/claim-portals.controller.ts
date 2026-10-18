/**
 * @file claim-portals.controller.ts
 * @description HTTP controller endpoints managing organizer certificate claim portals.
 * @architecture Thin HTTP layer routing requests to ClaimPortalLifecycle service routines.
 * @agent_note Protected by requireAuth middleware. Always uses getJsonBody(c) rather than c.req.json().
 */

import { Context } from 'hono';
import { getJsonBody } from '../lib/request.js';
import { ClaimPortal } from '../models/ClaimPortal.js';
import { ClaimCredentialSet } from '../models/ClaimCredentialSet.js';
import {
  ClaimPortalLifecycle,
  PortalConflictError,
  PortalNotFoundError,
  BatchNotEligibleError,
  ExportAlreadyAcknowledgedError,
  InvalidStateTransitionError,
  WeakCredentialError,
} from '../services/claim-portal-lifecycle.js';

function handleControllerError(c: Context, err: any) {
  if (err instanceof PortalNotFoundError) {
    return c.json({ error: err.message, code: err.code }, 404);
  }
  if (err instanceof PortalConflictError || err instanceof ExportAlreadyAcknowledgedError) {
    return c.json({ error: err.message, code: err.code }, 409);
  }
  if (err instanceof BatchNotEligibleError || err instanceof InvalidStateTransitionError) {
    return c.json({ error: err.message, code: err.code }, 400);
  }
  if (err instanceof WeakCredentialError) {
    return c.json({ error: err.message, code: err.code, reasons: err.reasons }, 400);
  }
  console.error('[ClaimPortalsController] Unhandled error:', err);
  return c.json({ error: err.message || 'Internal server error' }, 500);
}

function getRequiredParam(c: Context, name: string): string {
  const val = c.req.param(name);
  if (!val) {
    throw new PortalNotFoundError(`Missing required parameter '${name}'`);
  }
  return val;
}

/**
 * @desc    Retrieves claim portal details and active credential set configuration for a specific batch.
 * @route   GET /api/batches/:id/claim-portal
 * @access  Private (Authenticated User)
 * @returns {Promise<Response>} 200 JSON with `{ portal: IClaimPortal | null }`, 400 on invalid batch, or 500 on error.
 */
export const getPortalByBatch = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const batchId = c.req.param('id') || c.req.param('batchId');
  if (!batchId) return c.json({ error: 'Missing batch ID' }, 400);

  try {
    const portal = await ClaimPortal.findOne({ batchId, ownerId: user.id });
    if (!portal) return c.json({ portal: null }, 200);
    const credSet = await ClaimCredentialSet.findOne({
      portalId: portal._id,
      revision: portal.credentialSetRevision,
    });
    const portalData = portal.toObject();
    if (credSet) {
      portalData.credentialSetStatus = credSet.status;
      portalData.primaryFieldKey = credSet.primaryFieldKey;
      portalData.secondaryFieldKey = credSet.secondaryFieldKey;
    }
    return c.json({ portal: portalData }, 200);
  } catch (err) {
    return handleControllerError(c, err);
  }
};

/**
 * @desc    Creates a new draft claim portal for an approved batch with optional custom label and instructions.
 * @route   POST /api/batches/:id/claim-portal
 * @access  Private (Authenticated User)
 * @body    {Object} [body] - Portal draft options including label and instructions.
 * @returns {Promise<Response>} 201 Created JSON with `{ portal: IClaimPortal }`, 400 if ineligible, 409 if already exists.
 */
export const createPortal = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const batchId = c.req.param('id') || c.req.param('batchId');
  if (!batchId) return c.json({ error: 'Missing batch ID' }, 400);

  try {
    const body = await getJsonBody(c);
    const portal = await ClaimPortalLifecycle.createPortalDraft(user.id, batchId, {
      label: body?.label,
      instructions: body?.instructions,
    });
    const portalData = portal.toObject();
    portalData.credentialSetStatus = 'preparing';
    return c.json({ portal: portalData }, 201);
  } catch (err) {
    return handleControllerError(c, err);
  }
};

/**
 * @desc    Updates configuration settings (label, instructions, rate limits) for a claim portal.
 * @route   PATCH /api/claim-portals/:portalId
 * @access  Private (Authenticated User)
 * @body    {Object} body - Updated portal settings including label, instructions, rateLimitPerIp, etc.
 * @returns {Promise<Response>} 200 JSON with `{ portal: IClaimPortal }`, 404 if not found, 500 on failure.
 */
export const updatePortal = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const portalId = getRequiredParam(c, 'portalId');
    const body = await getJsonBody(c);
    const portal = await ClaimPortalLifecycle.updatePortalConfig(user.id, portalId, body || {});
    return c.json({ portal }, 200);
  } catch (err) {
    return handleControllerError(c, err);
  }
};

/**
 * @desc    Generates unique access claim tokens for all eligible recipients in the portal's approved batch.
 * @route   POST /api/claim-portals/:portalId/credentials/generate
 * @access  Private (Authenticated User)
 * @returns {Promise<Response>} 200 JSON with generated credential set summary and token count, 404 if not found, 409 on conflict.
 */
export const generateTokens = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const portalId = getRequiredParam(c, 'portalId');
    const result = await ClaimPortalLifecycle.generateTokenSet(user.id, portalId);
    return c.json(result, 200);
  } catch (err) {
    return handleControllerError(c, err);
  }
};

/**
 * @desc    Records organizer acknowledgement of downloaded credential tokens, marking credential set exported.
 * @route   POST /api/claim-portals/:portalId/credentials/export-ack
 * @access  Private (Authenticated User)
 * @body    {Object} body - Payload with credential set revision number.
 * @returns {Promise<Response>} 200 JSON with `{ credentialSet: IClaimCredentialSet }`, 404 if not found, 409 if already acked.
 */
export const acknowledgeExport = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const portalId = getRequiredParam(c, 'portalId');
    const body = await getJsonBody(c);
    const credentialSet = await ClaimPortalLifecycle.acknowledgeTokenExport(user.id, portalId, Number(body?.revision));
    return c.json({ credentialSet }, 200);
  } catch (err) {
    return handleControllerError(c, err);
  }
};

/**
 * @desc    Configures participant lookup fields (primary and secondary keys) from imported batch data.
 * @route   POST /api/claim-portals/:portalId/credentials/import-config
 * @access  Private (Authenticated User)
 * @body    {Object} body - Configuration with primaryFieldKey and optional secondaryFieldKey.
 * @returns {Promise<Response>} 200 JSON with `{ credentialSet: IClaimCredentialSet }`, 400 on weak credentials, 404 if not found.
 */
export const configureImport = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const portalId = getRequiredParam(c, 'portalId');
    const body = await getJsonBody(c);
    const credentialSet = await ClaimPortalLifecycle.configureImportedCredentials(user.id, portalId, {
      primaryFieldKey: body?.primaryFieldKey,
      secondaryFieldKey: body?.secondaryFieldKey,
    });
    return c.json({ credentialSet }, 200);
  } catch (err) {
    return handleControllerError(c, err);
  }
};

/**
 * @desc    Computes preflight validation checks, credential coverage, and activation readiness for a portal.
 * @route   GET /api/claim-portals/:portalId/preflight
 * @access  Private (Authenticated User)
 * @returns {Promise<Response>} 200 JSON with preflight metrics and readiness status, 404 if not found, 500 on failure.
 */
export const getPreflight = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const portalId = getRequiredParam(c, 'portalId');
    const preflight = await ClaimPortalLifecycle.getPortalPreflight(user.id, portalId);
    return c.json(preflight, 200);
  } catch (err) {
    return handleControllerError(c, err);
  }
};

/**
 * @desc    Transitions a draft or paused claim portal to active status, enabling public participant claims.
 * @route   POST /api/claim-portals/:portalId/activate
 * @access  Private (Authenticated User)
 * @body    {Object} [body] - Activation options with optional expectedVersion CAS token and ackExclusions flag.
 * @returns {Promise<Response>} 200 JSON with `{ portal: IClaimPortal }`, 400 if validation fails, 404 if not found.
 */
export const activatePortal = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const portalId = getRequiredParam(c, 'portalId');
    const body = await getJsonBody(c);
    const portal = await ClaimPortalLifecycle.activatePortal(
      user.id,
      portalId,
      body?.expectedVersion,
      body?.ackExclusions
    );
    return c.json({ portal }, 200);
  } catch (err) {
    return handleControllerError(c, err);
  }
};

/**
 * @desc    Pauses an active claim portal, temporarily disabling participant claims without losing configuration.
 * @route   POST /api/claim-portals/:portalId/pause
 * @access  Private (Authenticated User)
 * @returns {Promise<Response>} 200 JSON with `{ portal: IClaimPortal }`, 400 on invalid transition, 404 if not found.
 */
export const pausePortal = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const portalId = getRequiredParam(c, 'portalId');
    const portal = await ClaimPortalLifecycle.pausePortal(user.id, portalId);
    return c.json({ portal }, 200);
  } catch (err) {
    return handleControllerError(c, err);
  }
};

/**
 * @desc    Resumes a paused claim portal back to active status.
 * @route   POST /api/claim-portals/:portalId/resume
 * @access  Private (Authenticated User)
 * @returns {Promise<Response>} 200 JSON with `{ portal: IClaimPortal }`, 400 on invalid transition, 404 if not found.
 */
export const resumePortal = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const portalId = getRequiredParam(c, 'portalId');
    const portal = await ClaimPortalLifecycle.resumePortal(user.id, portalId);
    return c.json({ portal }, 200);
  } catch (err) {
    return handleControllerError(c, err);
  }
};

/**
 * @desc    Disables a claim portal, blocking any new claim attempts.
 * @route   POST /api/claim-portals/:portalId/disable
 * @access  Private (Authenticated User)
 * @returns {Promise<Response>} 200 JSON with `{ portal: IClaimPortal }`, 400 on invalid transition, 404 if not found.
 */
export const disablePortal = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const portalId = getRequiredParam(c, 'portalId');
    const portal = await ClaimPortalLifecycle.disablePortal(user.id, portalId);
    return c.json({ portal }, 200);
  } catch (err) {
    return handleControllerError(c, err);
  }
};

/**
 * @desc    Permanently closes a claim portal, finalizing its lifecycle.
 * @route   POST /api/claim-portals/:portalId/close
 * @access  Private (Authenticated User)
 * @returns {Promise<Response>} 200 JSON with `{ portal: IClaimPortal }`, 400 on invalid transition, 404 if not found.
 */
export const closePortal = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const portalId = getRequiredParam(c, 'portalId');
    const portal = await ClaimPortalLifecycle.closePortal(user.id, portalId);
    return c.json({ portal }, 200);
  } catch (err) {
    return handleControllerError(c, err);
  }
};

/**
 * @desc    Rotates portal credentials, re-generating tokens for unclaimed or all recipients.
 * @route   POST /api/claim-portals/:portalId/credentials/rotate
 * @access  Private (Authenticated User)
 * @body    {Object} [body] - Rotation options with mode ('unclaimed_only' | 'all').
 * @returns {Promise<Response>} 200 JSON with rotation results and credentialSet, 404 if not found, 500 on failure.
 */
export const rotateTokens = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const portalId = getRequiredParam(c, 'portalId');
    const body = await getJsonBody(c);
    const result = await ClaimPortalLifecycle.rotateCredentials(user.id, portalId, body?.mode);
    return c.json(result, 200);
  } catch (err) {
    return handleControllerError(c, err);
  }
};

/**
 * @desc    Retrieves paginated recipient claim states and audit statuses for an organizer portal.
 * @route   GET /api/claim-portals/:portalId/recipients
 * @access  Private (Authenticated User)
 * @returns {Promise<Response>} 200 JSON with paginated recipient claim statuses, 404 if not found, 500 on failure.
 */
export const getRecipients = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const portalId = getRequiredParam(c, 'portalId');
    const query = {
      page: Number(c.req.query('page') || 1),
      limit: Number(c.req.query('limit') || 20),
      status: c.req.query('status'),
    };
    const result = await ClaimPortalLifecycle.getPortalRecipients(user.id, portalId, query);
    return c.json(result, 200);
  } catch (err) {
    return handleControllerError(c, err);
  }
};

/**
 * @desc    Revokes a specific recipient's claimed status, resetting their access or invalidating credentials.
 * @route   POST /api/claim-portals/:portalId/recipients/:recipientId/revoke
 * @access  Private (Authenticated User)
 * @returns {Promise<Response>} 200 JSON with `{ recipientState: IClaimRecipientState }`, 404 if not found, 500 on failure.
 */
export const revokeRecipient = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const portalId = getRequiredParam(c, 'portalId');
    const recipientId = getRequiredParam(c, 'recipientId');
    const result = await ClaimPortalLifecycle.revokeRecipientClaim(user.id, portalId, recipientId);
    return c.json({ recipientState: result }, 200);
  } catch (err) {
    return handleControllerError(c, err);
  }
};

/**
 * @desc    Retrieves real-time analytics, claim conversion rates, and hourly activity buckets for a portal.
 * @route   GET /api/claim-portals/:portalId/analytics
 * @access  Private (Authenticated User)
 * @returns {Promise<Response>} 200 JSON with `{ analytics: IClaimPortalAnalytics }`, 404 if not found, 500 on failure.
 */
export const getAnalytics = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const portalId = getRequiredParam(c, 'portalId');
    const analytics = await ClaimPortalLifecycle.getPortalAnalytics(user.id, portalId);
    return c.json({ analytics }, 200);
  } catch (err) {
    return handleControllerError(c, err);
  }
};
