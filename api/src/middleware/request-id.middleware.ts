/**
 * @file request-id.middleware.ts
 * @description Injects and propagates correlation request IDs across Hono API requests and responses.
 * @architecture Global middleware placed early in the Hono pipeline to ensure downstream logging and error handling have correlation IDs.
 * @agent_note Respects existing x-request-id headers if supplied, otherwise generates a secure crypto.randomUUID().
 */

import { Context, Next } from 'hono';
import crypto from 'crypto';

/**
 * @desc    Extracts or generates an x-request-id and propagates it on context and response headers.
 * @param   {Context} c - Hono context
 * @param   {Next} next - Next middleware handler
 * @mutates Sets c.set('requestId', requestId) and sets x-request-id response header.
 */
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
