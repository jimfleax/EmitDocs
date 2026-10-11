import { Context } from 'hono';

/**
 * Universal JSON body extractor for Hono running on Vercel or standalone Node.
 * Vercel Serverless / dev-server pre-parses request bodies and ends the incoming stream,
 * placing the parsed payload on `(c.env as any)?.incoming?.body`.
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
