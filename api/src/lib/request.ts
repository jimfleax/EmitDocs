/**
 * @file request.ts
 * @description Universal HTTP request body parsing utilities for Hono applications.
 * @architecture Bridges differences between standalone Node HTTP servers and Vercel Serverless environments,
 *               where incoming request streams may already be consumed and stored in environment context.
 * @agent_note Always use `getJsonBody(c)` in controllers instead of `c.req.json()` directly to prevent
 *             "body already consumed" stream read errors on Vercel deployments.
 */

import { Context } from 'hono';

/**
 * Universal JSON body extractor for Hono running on Vercel or standalone Node.
 * Vercel Serverless / dev-server pre-parses request bodies and ends the incoming stream,
 * placing the parsed payload on `(c.env as any)?.incoming?.body`.
 * 
 * @desc Extracts JSON request payload across standard Hono stream and Vercel pre-parsed contexts.
 * @template T - Expected shape of the parsed JSON payload.
 * @param {Context} c - Active Hono request context.
 * @returns {Promise<T>} Parsed body object cast to type T.
 */
export async function getJsonBody<T = any>(c: Context): Promise<T> {
  const incoming = (c.env as any)?.incoming;
  if (incoming?.body !== undefined && incoming?.body !== null) {
    if (typeof incoming.body === 'string') {
      try {
        return JSON.parse(incoming.body) as T;
      } catch {
        return incoming.body as T;
      }
    }
    return incoming.body as T;
  }

  return (await c.req.json()) as T;
}
