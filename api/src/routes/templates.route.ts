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
