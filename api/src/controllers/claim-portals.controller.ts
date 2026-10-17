/**
 * @file claim-portals.controller.ts
 * @description HTTP controller endpoints managing organizer certificate claim portals.
 * @architecture Thin HTTP layer routing requests to ClaimPortalLifecycle service routines.
 * @agent_note Protected by requireAuth middleware. Always uses getJsonBody(c) rather than c.req.json().
 */

import { Context } from 'hono';
import { getJsonBody } from '../lib/request.js';
import { ClaimPortal } from '../models/ClaimPortal.js';
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

export const getPortalByBatch = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const batchId = c.req.param('id') || c.req.param('batchId');
  if (!batchId) return c.json({ error: 'Missing batch ID' }, 400);

  try {
    const portal = await ClaimPortal.findOne({ batchId, ownerId: user.id });
    if (!portal) return c.json({ portal: null }, 200);
    return c.json({ portal }, 200);
  } catch (err) {
    return handleControllerError(c, err);
  }
};

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
    return c.json({ portal }, 201);
  } catch (err) {
    return handleControllerError(c, err);
  }
};

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
