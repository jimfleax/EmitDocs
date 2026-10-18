/**
 * @file public-claim.route.ts
 * @description Router mounting unauthenticated participant claim portal endpoints (PRD-CORE-11).
 * @architecture Mounted under `/public/claim-portals` in main application.
 *               Zero Better-Auth authentication requirement.
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
