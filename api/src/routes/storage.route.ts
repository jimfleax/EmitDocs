/**
 * @file storage.route.ts
 * @description Route definitions and router setup for user storage usage analytics and quotas.
 *
 * @architecture
 * - Sub-router mounted under `/api/storage` in main application.
 * - Secures all routes via `requireAuth` middleware.
 * - Routes `/` and `/summary` to `getUserStorage` controller handler to return aggregate storage statistics.
 *
 * @agent_note
 * Both GET `/` and GET `/summary` resolve to the same handler for backward compatibility with frontend storage consumers.
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getUserStorage } from '../controllers/storage.controller.js';

/**
 * Sub-router mounting storage usage summary endpoints.
 */
const storageApp = new Hono();

storageApp.use('*', requireAuth);

storageApp.get('/', getUserStorage);
storageApp.get('/summary', getUserStorage);

export default storageApp;
