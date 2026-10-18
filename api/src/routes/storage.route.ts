/**
 * @file storage.route.ts
 * @description Route definitions and router setup for user storage usage analytics and quotas.
 * @architecture Sub-router mounted under /api/storage in the primary Hono application pipeline.
 * @agent_note Both GET / and GET /summary resolve to the same handler for backward compatibility with frontend consumers.
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getUserStorage } from '../controllers/storage.controller.js';

/**
 * @desc Sub-router mounting user storage consumption and quota query endpoints.
 */
const storageApp = new Hono();

storageApp.use('*', requireAuth);

storageApp.get('/', getUserStorage);
storageApp.get('/summary', getUserStorage);

export default storageApp;
