/**
 * @file public-claim.controller.ts
 * @description HTTP controllers for public, unauthenticated participant claim portal endpoints (PRD-CORE-11).
 * @architecture Endpoints consume bodies strictly via `getJsonBody(c)` to support Vercel serverless streaming.
 *               Manages `emitdocs_claim_session` HttpOnly, SameSite=Lax cookie lifecycle.
 */

import { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { getJsonBody } from '../lib/request.js';
import {
  getPublicPortalMetadata,
  authenticateClaim,
  ClaimPortalNotFoundError,
  ClaimRateLimitExceededError,
  ClaimTurnstileRequiredError,
  ClaimNotAvailableError,
} from '../services/participant-claim.js';
import {
  validateClaimSession,
  getAuthorizedDownloadPayload,
  revokeClaimSession,
  ClaimSessionInvalidError,
  ClaimPortalInactiveError,
} from '../services/claim-delivery.js';

export const CLAIM_SESSION_COOKIE = 'emitdocs_claim_session';

/**
 * Helper to extract client IP from headers.
 */
function getClientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return c.req.header('x-real-ip') || '127.0.0.1';
}

/**
 * GET /api/public/claim-portals/:publicSlug
 * Retrieves safe public portal metadata without exposing recipient data.
 */
export async function getPublicPortal(c: Context) {
  const publicSlug = c.req.param('publicSlug');
  if (!publicSlug) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing slug' } }, 400);
  }

  try {
    const metadata = await getPublicPortalMetadata(publicSlug);
    return c.json({ success: true, portal: metadata });
  } catch (err: any) {
    if (err instanceof ClaimPortalNotFoundError) {
      return c.json({ success: false, error: { code: err.code, message: err.message } }, 404);
    }
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
  }
}

/**
 * POST /api/public/claim-portals/:publicSlug/claim
 * Authenticates participant credentials and issues scoped session cookie.
 */
export async function claimCredential(c: Context) {
  const publicSlug = c.req.param('publicSlug');
  if (!publicSlug) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing slug' } }, 400);
  }
  const ip = getClientIp(c);

  try {
    const body = await getJsonBody<{
      primaryCredential: string;
      secondaryCredential?: string;
      turnstileToken?: string;
    }>(c);

    if (!body || !body.primaryCredential) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CLAIM_NOT_AVAILABLE',
            message: "We couldn't complete this claim. Check the details and try again, or contact the organizer.",
          },
        },
        400
      );
    }

    const result = await authenticateClaim(publicSlug, body, ip);

    // Set secure HttpOnly session cookie
    const isProd = process.env.NODE_ENV === 'production';
    setCookie(c, CLAIM_SESSION_COOKIE, result.rawSessionToken, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: isProd,
      path: '/api/public/claim-portals',
      maxAge: 15 * 60, // 15 minutes
    });

    return c.json({
      success: true,
      recipientName: result.recipientName,
      expiresAt: result.expiresAt,
    });
  } catch (err: any) {
    if (err instanceof ClaimRateLimitExceededError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message, retryAfter: err.retryAfter } },
        429
      );
    }
    if (err instanceof ClaimTurnstileRequiredError) {
      return c.json({ success: false, error: { code: err.code, message: err.message } }, 400);
    }
    if (err instanceof ClaimPortalNotFoundError) {
      return c.json({ success: false, error: { code: err.code, message: err.message } }, 404);
    }
    if (err instanceof ClaimNotAvailableError) {
      return c.json({ success: false, error: { code: err.code, message: err.message } }, 400);
    }

    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
  }
}

/**
 * GET /api/public/claim-portals/:publicSlug/session
 * Checks whether client has an active authenticated session.
 */
export async function getSession(c: Context) {
  const publicSlug = c.req.param('publicSlug');
  if (!publicSlug) {
    return c.json({ success: false, valid: false, error: { code: 'BAD_REQUEST', message: 'Missing slug' } }, 400);
  }
  const token = getCookie(c, CLAIM_SESSION_COOKIE);

  if (!token) {
    return c.json({ success: false, valid: false }, 401);
  }

  try {
    const { recipient } = await validateClaimSession(publicSlug, token);
    const recipientName =
      recipient.effectiveData?.['Name'] ||
      recipient.effectiveData?.['Full Name'] ||
      recipient.effectiveData?.['name'] ||
      recipient.recipientKey ||
      'Participant';

    return c.json({ success: true, valid: true, recipientName });
  } catch (err: any) {
    if (err instanceof ClaimSessionInvalidError) {
      return c.json({ success: false, valid: false, error: { code: err.code, message: err.message } }, 401);
    }
    if (err instanceof ClaimPortalInactiveError) {
      return c.json({ success: false, valid: false, error: { code: err.code, message: err.message } }, 410);
    }
    return c.json({ success: false, valid: false, error: { code: 'ERROR', message: err.message } }, 400);
  }
}

/**
 * POST /api/public/claim-portals/:publicSlug/download-url
 * Authorizes and returns certificate download URL.
 */
export async function getDownloadUrl(c: Context) {
  const publicSlug = c.req.param('publicSlug');
  if (!publicSlug) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing slug' } }, 400);
  }
  const token = getCookie(c, CLAIM_SESSION_COOKIE);

  if (!token) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No claim session' } }, 401);
  }

  try {
    const payload = await getAuthorizedDownloadPayload(publicSlug, token);
    return c.json({
      success: true,
      downloadUrl: payload.downloadUrl,
      filename: payload.filename,
      mimeType: payload.mimeType,
      recipientName: payload.recipientName,
    });
  } catch (err: any) {
    if (err instanceof ClaimSessionInvalidError) {
      return c.json({ success: false, error: { code: err.code, message: err.message } }, 401);
    }
    if (err instanceof ClaimPortalInactiveError) {
      return c.json({ success: false, error: { code: err.code, message: err.message } }, 410);
    }
    return c.json({ success: false, error: { code: 'CLAIM_NOT_AVAILABLE', message: err.message } }, 400);
  }
}

/**
 * POST /api/public/claim-portals/:publicSlug/logout
 * Revokes session in DB and clears cookie.
 */
export async function logoutSession(c: Context) {
  const token = getCookie(c, CLAIM_SESSION_COOKIE);
  if (token) {
    await revokeClaimSession(token);
  }

  deleteCookie(c, CLAIM_SESSION_COOKIE, {
    path: '/api/public/claim-portals',
  });

  return c.json({ success: true, message: 'Logged out successfully' });
}
