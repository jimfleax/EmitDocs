/**
 * @file auth.middleware.ts
 * @description Session authentication middleware verifying Better-Auth session tokens.
 * @architecture Intercepts incoming Hono requests on protected routes, queries Better-Auth's session API
 *               using raw request headers/cookies, and sets the verified user object on the Hono Context (`c.set('user')`).
 * @agent_note Downstream route handlers and controllers can retrieve the authenticated user via `c.get('user')`.
 *             Ensure Better-Auth cookies are forwarded if making internal or proxied requests.
 */

import { Context, Next } from 'hono';
import { auth } from '../auth.js';

/**
 * @desc Verifies incoming session credentials via Better-Auth and enforces authentication on protected routes.
 * @route Middleware on protected routes
 * @access Private
 * @mutates c.set('user', session.user)
 * @returns {Promise<Response | void>} 401 Unauthorized JSON response if unauthenticated, or calls next().
 */
export const requireAuth = async (c: Context, next: Next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  });
  if (!session || !session.user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('user', session.user);
  await next();
};

