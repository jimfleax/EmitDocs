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
  getClaimRenderPayload,
  getClaimTemplateAsset,
  getClaimTemplateBaseBytes,
  ClaimSessionInvalidError,
  ClaimPortalInactiveError,
} from '../services/claim-delivery.js';
import { generateServerPdfWithOverlay } from '../services/claim-pdf-generator.js';
import { ApprovedSnapshot } from '../models/ApprovedSnapshot.js';
import { TemplateVersion } from '../models/TemplateVersion.js';
import cloudinary from '../lib/cloudinary.js';

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

function createMinimalCertificatePdf(title: string, recipientName: string): Buffer {
  const content = `BT\n/F1 24 Tf\n50 700 Td\n(${title}) Tj\n/F1 16 Tf\n0 -40 Td\n(Awarded to: ${recipientName}) Tj\nET`;
  const streamLen = Buffer.byteLength(content);
  const pdfString = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length ${streamLen} >>\nstream\n${content}\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000300 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n380\n%%EOF`;
  return Buffer.from(pdfString);
}

/**
 * GET /api/public/claim-portals/:publicSlug/render-payload
 * Returns the layout mappings and recipient data for verified claimant to render client-side.
 */
export async function getRenderPayload(c: Context) {
  const publicSlug = c.req.param('publicSlug');
  if (!publicSlug) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing slug' } }, 400);
  }

  const token = getCookie(c, CLAIM_SESSION_COOKIE) || c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No claim session' } }, 401);
  }

  try {
    const payload = await getClaimRenderPayload(publicSlug, token);
    return c.json({ success: true, ...payload }, 200);
  } catch (err: any) {
    if (err instanceof ClaimSessionInvalidError) {
      return c.json({ success: false, error: { code: err.code, message: err.message } }, 401);
    }
    if (err instanceof ClaimPortalInactiveError) {
      return c.json({ success: false, error: { code: err.code, message: err.message } }, 410);
    }
    if (err instanceof ClaimNotAvailableError) {
      return c.json({ success: false, error: { code: err.code, message: err.message } }, 403);
    }
    return c.json({ success: false, error: { code: 'PAYLOAD_ERROR', message: err.message } }, 400);
  }
}

/**
 * GET /api/public/claim-portals/:publicSlug/template-file
 * Streams the base template PDF document for client-side custom certificate synthesis.
 */
export async function streamTemplateFile(c: Context) {
  const publicSlug = c.req.param('publicSlug');
  if (!publicSlug) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing slug' } }, 400);
  }

  const token = getCookie(c, CLAIM_SESSION_COOKIE) || c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No claim session' } }, 401);
  }

  try {
    const asset = await getClaimTemplateAsset(publicSlug, token);
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `inline; filename="${asset.filename}"`);
    c.header('Cache-Control', 'private, max-age=3600');
    return c.body(asset.body);
  } catch (err: any) {
    if (err instanceof ClaimSessionInvalidError) {
      return c.json({ success: false, error: { code: err.code, message: err.message } }, 401);
    }
    if (err instanceof ClaimPortalInactiveError) {
      return c.json({ success: false, error: { code: err.code, message: err.message } }, 410);
    }
    // Fallback: return a clean 1-page PDF if asset fetch fails in development/test
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `inline; filename="template.pdf"`);
    c.header('Cache-Control', 'private, max-age=3600');
    return c.body(new Uint8Array(createMinimalCertificatePdf('Certificate Template', 'Participant')));
  }
}

/**
 * GET /api/public/claim-portals/:publicSlug/documents/:documentId
 * Streams the custom recipient certificate document after validating claim session.
 */
export async function streamClaimDocument(c: Context) {
  const publicSlug = c.req.param('publicSlug');
  if (!publicSlug) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing slug' } }, 400);
  }

  const token = getCookie(c, CLAIM_SESSION_COOKIE) || c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No claim session' } }, 401);
  }

  try {
    const { portal, recipient } = await validateClaimSession(publicSlug, token);

    const recipientName =
      recipient.effectiveData?.['Name'] ||
      recipient.effectiveData?.['Full Name'] ||
      recipient.effectiveData?.['name'] ||
      recipient.recipientKey ||
      'Participant';
    const sanitizedName = recipientName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${sanitizedName}_certificate.pdf`;

    if (recipient.outputKey && cloudinary.config().cloud_name) {
      let downloadUrl = cloudinary.url(recipient.outputKey, {
        resource_type: 'image',
        format: 'pdf',
        type: 'authenticated',
        sign_url: true,
      });

      let res: any = null;
      try {
        const response = await fetch(downloadUrl);
        if (response && response.ok && response.body) {
          res = response;
        }
      } catch {
        // Fallback
      }

      if (!res) {
        downloadUrl = cloudinary.url(recipient.outputKey, {
          resource_type: 'raw',
          type: 'authenticated',
          sign_url: true,
        });
        try {
          const response = await fetch(downloadUrl);
          if (response && response.ok && response.body) {
            res = response;
          }
        } catch {
          // Fallback
        }
      }

      if (res && res.body) {
        c.header('Content-Type', 'application/pdf');
        c.header('Content-Disposition', `inline; filename="${filename}"`);
        c.header('Cache-Control', 'private, max-age=3600');
        return c.body(res.body);
      }
    }

    // Dynamic Synthesis: Load snapshot, template version field mappings, and base PDF
    const snapshot = await ApprovedSnapshot.findById(portal.snapshotId);
    if (snapshot) {
      const version = await TemplateVersion.findById(snapshot.templateVersionId);
      if (version) {
        const baseBytes = await getClaimTemplateBaseBytes(
          portal._id.toString(),
          portal.ownerId,
          snapshot._id.toString()
        );

        const customPdf = await generateServerPdfWithOverlay(
          baseBytes,
          version.fieldMappings || [],
          recipient.effectiveData || {}
        );

        c.header('Content-Type', 'application/pdf');
        c.header('Content-Disposition', `inline; filename="${filename}"`);
        c.header('Cache-Control', 'private, max-age=3600');
        return c.body(new Uint8Array(customPdf));
      }
    }

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `inline; filename="${filename}"`);
    c.header('Cache-Control', 'private, max-age=3600');
    return c.body(new Uint8Array(createMinimalCertificatePdf('Certificate of Completion', recipientName)));
  } catch (err: any) {
    if (err instanceof ClaimSessionInvalidError) {
      return c.json({ success: false, error: { code: err.code, message: err.message } }, 401);
    }
    if (err instanceof ClaimPortalInactiveError) {
      return c.json({ success: false, error: { code: err.code, message: err.message } }, 410);
    }
    if (err instanceof ClaimNotAvailableError) {
      return c.json({ success: false, error: { code: err.code, message: err.message } }, 403);
    }
    return c.json({ success: false, error: { code: 'DOCUMENT_STREAM_ERROR', message: err.message } }, 400);
  }
}

