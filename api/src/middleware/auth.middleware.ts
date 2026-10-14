import { Context, Next } from 'hono';
import { auth } from '../auth.js';

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
