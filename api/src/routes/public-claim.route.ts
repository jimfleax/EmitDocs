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
} from '../controllers/public-claim.controller.js';

const publicClaimApp = new Hono();

publicClaimApp.get('/:publicSlug', getPublicPortal);
publicClaimApp.post('/:publicSlug/claim', claimCredential);
publicClaimApp.get('/:publicSlug/session', getSession);
publicClaimApp.post('/:publicSlug/download-url', getDownloadUrl);
publicClaimApp.post('/:publicSlug/logout', logoutSession);

export default publicClaimApp;
