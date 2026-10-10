import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.middleware';
import {
  signUpload,
  createTemplate,
  getTemplates,
  getTemplateById,
  deleteTemplate
} from '../controllers/templates.controller';

const templatesApp = new Hono();

templatesApp.use('*', requireAuth);

templatesApp.post('/sign-upload', signUpload);
templatesApp.post('/', createTemplate);
templatesApp.get('/', getTemplates);
templatesApp.get('/:id', getTemplateById);
templatesApp.delete('/:id', deleteTemplate);

export default templatesApp;
