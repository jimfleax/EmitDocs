/**
 * @file public-claim.controller.ts
 * @description HTTP controllers for public, unauthenticated participant claim portal endpoints (PRD-CORE-11).
 * @architecture Thin HTTP layer routing requests to participant claim and delivery services, managing claim session cookies.
 * @agent_note Endpoints consume bodies strictly via getJsonBody(c) to support Vercel serverless streaming. Manages emitdocs_claim_session HttpOnly cookie.
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
 * @desc    Retrieves safe public portal metadata without exposing recipient data.
 * @route   GET /api/public/claim-portals/:publicSlug
 * @access  Public
 * @returns {Promise<Response>} 200 JSON with portal metadata, 400 on missing slug, 404 if not found, 500 on error.
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
 * @desc    Authenticates participant credentials and issues scoped session cookie.
 * @route   POST /api/public/claim-portals/:publicSlug/claim
 * @access  Public
 * @body    {Object} body - Participant credentials including primaryCredential, optional secondaryCredential, and turnstileToken.
 * @returns {Promise<Response>} 200 JSON with recipientName and session expiration, 400 on invalid input, 429 on rate limit.
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
 * @desc    Checks whether client has an active authenticated claim session cookie.
 * @route   GET /api/public/claim-portals/:publicSlug/session
 * @access  Public
 * @returns {Promise<Response>} 200 JSON with session validity and recipient name, 401 if unauthenticated, 410 if portal inactive.
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
 * @desc    Authorizes and returns direct certificate download URL for authenticated participant.
 * @route   POST /api/public/claim-portals/:publicSlug/download-url
 * @access  Public (Claim Session Cookie)
 * @returns {Promise<Response>} 200 JSON with downloadUrl, filename, mimeType, and recipientName; 401 if unauthorized.
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
 * @desc    Revokes participant claim session in database and clears the session cookie.
 * @route   POST /api/public/claim-portals/:publicSlug/logout
 * @access  Public
 * @returns {Promise<Response>} 200 JSON with `{ success: true, message: 'Logged out successfully' }`.
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

const CLOUDINARY_FETCH_TIMEOUT_MS = Number(process.env.CLOUDINARY_FETCH_TIMEOUT_MS) || 10000;

function isPlaceholderPdfAllowed(): boolean {
  return (
    process.env.ENABLE_PLACEHOLDER_PDF === 'true' ||
    process.env.ALLOW_PLACEHOLDER_PDF === 'true' ||
    process.env.ALLOW_CLAIM_PLACEHOLDER === 'true'
  );
}

/**
 * Escapes characters for PDF literal strings enclosed in parentheses.
 * Backslashes, open and close parentheses, and line breaks are escaped
 * to prevent PDF syntax breakage and operator injection.
 */
function escapePdfStringLiteral(str: string): string {
  return String(str ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

function createMinimalCertificatePdf(title: string, recipientName: string): Buffer {
  const safeTitle = escapePdfStringLiteral(title);
  const safeRecipient = escapePdfStringLiteral(recipientName);
  const content = `BT\n/F1 24 Tf\n50 700 Td\n(${safeTitle}) Tj\n/F1 16 Tf\n0 -40 Td\n(Awarded to: ${safeRecipient}) Tj\nET`;
  const streamLen = Buffer.byteLength(content);
  const pdfString = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length ${streamLen} >>\nstream\n${content}\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000300 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n380\n%%EOF`;
  return Buffer.from(pdfString);
}

/**
 * @desc    Returns layout mappings and recipient data for verified claimant to render certificate client-side.
 * @route   GET /api/public/claim-portals/:publicSlug/render-payload
 * @access  Public (Claim Session Cookie)
 * @returns {Promise<Response>} 200 JSON with render payload containing fieldMappings and recipientData, 401 if unauthorized.
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
 * @desc    Streams the base template PDF document for client-side custom certificate synthesis.
 * @route   GET /api/public/claim-portals/:publicSlug/template-file
 * @access  Public (Claim Session Cookie)
 * @returns {Promise<Response>} 200 Binary PDF stream with inline disposition header, 401 if unauthorized, 500 on failure.
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
    if (err instanceof ClaimNotAvailableError) {
      return c.json({ success: false, error: { code: err.code, message: err.message } }, 403);
    }
    // Fallback: return a clean 1-page PDF if asset fetch fails in development/test with explicit flag
    if (isPlaceholderPdfAllowed()) {
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `inline; filename="template.pdf"`);
      c.header('Cache-Control', 'private, max-age=3600');
      return c.body(new Uint8Array(createMinimalCertificatePdf('Certificate Template', 'Participant')));
    }
    return c.json(
      { success: false, error: { code: 'TEMPLATE_FETCH_FAILED', message: err.message || 'Template asset not available' } },
      err.status || 500
    );
  }
}

/**
 * @desc    Streams the custom recipient certificate document after validating claim session.
 * @route   GET /api/public/claim-portals/:publicSlug/documents/:documentId
 * @access  Public (Claim Session Cookie)
 * @returns {Promise<Response>} 200 Binary PDF stream with inline headers, 401 if unauthorized, 404 if not found.
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
        const response = await fetch(downloadUrl, {
          signal: AbortSignal.timeout(CLOUDINARY_FETCH_TIMEOUT_MS),
        });
        if (response && response.ok && response.body) {
          res = response;
        } else if (response && response.body) {
          await response.body.cancel().catch(() => {});
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
          const response = await fetch(downloadUrl, {
            signal: AbortSignal.timeout(CLOUDINARY_FETCH_TIMEOUT_MS),
          });
          if (response && response.ok && response.body) {
            res = response;
          } else if (response && response.body) {
            await response.body.cancel().catch(() => {});
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
    if (!snapshot) {
      if (isPlaceholderPdfAllowed()) {
        c.header('Content-Type', 'application/pdf');
        c.header('Content-Disposition', `inline; filename="${filename}"`);
        c.header('Cache-Control', 'private, max-age=3600');
        return c.body(new Uint8Array(createMinimalCertificatePdf('Certificate of Completion', recipientName)));
      }
      return c.json({ success: false, error: { code: 'SNAPSHOT_NOT_FOUND', message: 'Approved snapshot not found for portal' } }, 404);
    }

    const version = await TemplateVersion.findById(snapshot.templateVersionId);
    if (!version) {
      if (isPlaceholderPdfAllowed()) {
        c.header('Content-Type', 'application/pdf');
        c.header('Content-Disposition', `inline; filename="${filename}"`);
        c.header('Cache-Control', 'private, max-age=3600');
        return c.body(new Uint8Array(createMinimalCertificatePdf('Certificate of Completion', recipientName)));
      }
      return c.json({ success: false, error: { code: 'TEMPLATE_VERSION_NOT_FOUND', message: 'Template version not found' } }, 404);
    }

    const baseBytes = await getClaimTemplateBaseBytes(
      portal._id.toString(),
      portal.ownerId,
      snapshot._id.toString()
    );

    if (!baseBytes) {
      if (isPlaceholderPdfAllowed()) {
        const customPdf = await generateServerPdfWithOverlay(
          null,
          version.fieldMappings || [],
          recipient.effectiveData || {}
        );
        c.header('Content-Type', 'application/pdf');
        c.header('Content-Disposition', `inline; filename="${filename}"`);
        c.header('Cache-Control', 'private, max-age=3600');
        return c.body(new Uint8Array(customPdf));
      }
      return c.json({ success: false, error: { code: 'TEMPLATE_ASSET_NOT_FOUND', message: 'Base template asset could not be retrieved' } }, 502);
    }

    const customPdf = await generateServerPdfWithOverlay(
      baseBytes,
      version.fieldMappings || [],
      recipient.effectiveData || {}
    );

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `inline; filename="${filename}"`);
    c.header('Cache-Control', 'private, max-age=3600');
    return c.body(new Uint8Array(customPdf));
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
    return c.json({ success: false, error: { code: 'DOCUMENT_STREAM_ERROR', message: err.message } }, err.status || 500);
  }
}

