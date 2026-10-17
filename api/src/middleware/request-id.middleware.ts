/**
 * @file request-id.middleware.ts
 * @description Injects and propagates correlation request IDs across Hono API requests and responses.
 */

import { Context, Next } from 'hono';
import crypto from 'crypto';

export const requestIdMiddleware = async (c: Context, next: Next) => {
  const incoming = c.req.header('x-request-id');
  const requestId = incoming && incoming.trim() !== '' ? incoming.trim() : crypto.randomUUID();

  c.set('requestId', requestId);
  c.header('x-request-id', requestId);

  await next();

  if (c.res && c.res.headers) {
    c.res.headers.set('x-request-id', requestId);
  }
};
