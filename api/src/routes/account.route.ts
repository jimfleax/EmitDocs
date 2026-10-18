/**
 * @file account.route.ts
 * @description Route definitions and router setup for user account lifecycle and deletion (PRD-CORE-09).
 * @architecture Sub-router mounted under /api/account in the root Hono application pipeline.
 * @agent_note Enforces authentication across all account routes via requireAuth middleware.
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.middleware.js';
import { deleteAccount } from '../controllers/account.controller.js';

/**
 * @desc Sub-router mounting account management and cascade deletion endpoints into the request pipeline.
 */
const accountApp = new Hono();

accountApp.use('*', requireAuth);
accountApp.delete('/', deleteAccount);

export default accountApp;
