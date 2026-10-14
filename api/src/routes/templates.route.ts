/**
 * @file templates.route.ts
 * @description Route definitions and router setup for template management and document versioning.
 *
 * @architecture
 * - Sub-router mounted under `/api/templates` in main application.
 * - Enforces authentication across all sub-paths via `requireAuth` middleware.
 * - Exposes REST endpoints for template creation, retrieval, deletion, version snapshots, Cloudinary signature generation, and secure PDF binary proxying.
 *
 * @agent_note
 * All endpoints in this router require an authenticated session (`c.get('user')`). Adding new unauthenticated routes requires moving them before `templatesApp.use('*', requireAuth)` or mounting them on a public router.
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  signUpload,
  createTemplate,
  getTemplates,
  getTemplateById,
  deleteTemplate,
  getTemplateVersions,
  getTemplateVersionById,
  streamTemplateVersionPdf,
  createTemplateVersion,
} from '../controllers/templates.controller.js';

/**
 * Sub-router mounting all template CRUD and version management endpoints.
 */
const templatesApp = new Hono();

templatesApp.use('*', requireAuth);

templatesApp.post('/sign-upload', signUpload);
templatesApp.post('/', createTemplate);
templatesApp.get('/', getTemplates);
templatesApp.get('/:id', getTemplateById);
templatesApp.delete('/:id', deleteTemplate);

// Versioning endpoints (PRD-CORE-03 Slice 1)
templatesApp.get('/:id/versions', getTemplateVersions);
templatesApp.get('/:id/versions/:versionId', getTemplateVersionById);
templatesApp.get('/:id/versions/:versionId/file', streamTemplateVersionPdf);
templatesApp.post('/:id/versions', createTemplateVersion);

export default templatesApp;
