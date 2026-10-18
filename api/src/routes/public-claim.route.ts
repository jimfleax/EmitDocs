/**
 * @file public-claim.route.ts
 * @description Router mounting unauthenticated participant claim portal endpoints (PRD-CORE-11).
 * @architecture Sub-router mounted under /api/public/claim-portals in the primary Hono application pipeline.
 * @agent_note Completely unauthenticated public route set; relies on custom claim session cookie for verification.
 */

import { Hono } from 'hono';
import {
  getPublicPortal,
  claimCredential,
  getSession,
  getDownloadUrl,
  logoutSession,
  getRenderPayload,
  streamTemplateFile,
  streamClaimDocument,
} from '../controllers/public-claim.controller.js';

/**
 * @desc Sub-router mounting unauthenticated participant claim portal and document retrieval endpoints.
 */
const publicClaimApp = new Hono();

publicClaimApp.get('/:publicSlug', getPublicPortal);
publicClaimApp.post('/:publicSlug/claim', claimCredential);
publicClaimApp.get('/:publicSlug/session', getSession);
publicClaimApp.post('/:publicSlug/download-url', getDownloadUrl);
publicClaimApp.post('/:publicSlug/logout', logoutSession);
publicClaimApp.get('/:publicSlug/render-payload', getRenderPayload);
publicClaimApp.get('/:publicSlug/template-file', streamTemplateFile);
publicClaimApp.get('/:publicSlug/documents/:documentId', streamClaimDocument);
publicClaimApp.get('/:publicSlug/documents/*', streamClaimDocument);

export default publicClaimApp;
