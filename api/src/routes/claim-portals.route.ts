/**
 * @file claim-portals.route.ts
 * @description Route definitions and router setup for organizer claim portals (PRD-CORE-11 Slice 2).
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  updatePortal,
  configureImport,
  generateTokens,
  acknowledgeExport,
  rotateTokens,
  getPreflight,
  activatePortal,
  pausePortal,
  resumePortal,
  disablePortal,
  closePortal,
  getRecipients,
  revokeRecipient,
  getAnalytics,
} from '../controllers/claim-portals.controller.js';

const claimPortalsApp = new Hono();

// All organizer portal endpoints require Better-Auth session
claimPortalsApp.use('*', requireAuth);

claimPortalsApp.patch('/:portalId', updatePortal);
claimPortalsApp.post('/:portalId/credentials/generate', generateTokens);
claimPortalsApp.post('/:portalId/credentials/export-ack', acknowledgeExport);
claimPortalsApp.post('/:portalId/credentials/import-config', configureImport);
claimPortalsApp.post('/:portalId/credentials/rotate', rotateTokens);
claimPortalsApp.get('/:portalId/preflight', getPreflight);
claimPortalsApp.post('/:portalId/activate', activatePortal);
claimPortalsApp.post('/:portalId/pause', pausePortal);
claimPortalsApp.post('/:portalId/resume', resumePortal);
claimPortalsApp.post('/:portalId/disable', disablePortal);
claimPortalsApp.post('/:portalId/close', closePortal);
claimPortalsApp.get('/:portalId/recipients', getRecipients);
claimPortalsApp.post('/:portalId/recipients/:recipientId/revoke', revokeRecipient);
claimPortalsApp.get('/:portalId/analytics', getAnalytics);

export default claimPortalsApp;
