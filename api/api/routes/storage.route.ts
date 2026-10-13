import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getUserStorage } from '../controllers/storage.controller.js';

const storageApp = new Hono();

storageApp.use('*', requireAuth);

storageApp.get('/', getUserStorage);
storageApp.get('/summary', getUserStorage);

export default storageApp;
