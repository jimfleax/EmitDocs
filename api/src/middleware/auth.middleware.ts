/**
 * @file auth.middleware.ts
 * @description Session authentication middleware verifying Better-Auth session tokens with quarantined test-auth bypass.
 * @architecture Intercepts incoming Hono requests on protected routes, queries Better-Auth's session API
 *               using raw request headers/cookies, and sets the verified user object on the Hono Context (`c.set('user')`).
 *               In non-production environments with `ENABLE_TEST_AUTH === 'true'`, supports mock users via `x-test-auth-user`.
 * @agent_note Downstream route handlers and controllers can retrieve the authenticated user via `c.get('user')`.
 *             Test auth header is strictly rejected with 401 in production runtime.
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
  const testAuthUser = c.req.header('x-test-auth-user');

  if (testAuthUser) {
    const isProd = process.env.NODE_ENV === 'production';
    const enableTestAuth = process.env.ENABLE_TEST_AUTH === 'true';

    // In production or when test auth is not explicitly enabled, reject immediately
    if (isProd || !enableTestAuth) {
      return c.json({ error: 'Unauthorized: test auth is disabled in this environment' }, 401);
    }

    const fallbackMockUser = {
      id: testAuthUser,
      name: 'Test User',
      email: `${testAuthUser}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let mockUser: any;
    try {
      const parsed = JSON.parse(testAuthUser);
      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        typeof parsed.id === 'string' &&
        parsed.id.trim() !== ''
      ) {
        mockUser = parsed;
      } else {
        mockUser = fallbackMockUser;
      }
    } catch {
      mockUser = fallbackMockUser;
    }

    c.set('user', mockUser);
    await next();
    return;
  }

  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session || !session.user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('user', session.user);
  await next();
};
