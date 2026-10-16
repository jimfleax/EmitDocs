/**
 * @file account.route.ts
 * @description Route definitions for account management and account deletion (PRD-CORE-09).
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.middleware.js';
import { deleteAccount } from '../controllers/account.controller.js';

const accountApp = new Hono();

accountApp.use('*', requireAuth);
accountApp.delete('/', deleteAccount);

export default accountApp;
