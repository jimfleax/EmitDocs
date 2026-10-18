/**
 * @file safe-logger.middleware.ts
 * @description Structured JSON request logger that strictly omits/scrubs PII (names, emails, tokens, cookies).
 * @architecture Global Hono middleware timing request lifecycle and logging structured metadata to standard console.
 * @agent_note Never logs raw request bodies or query parameters containing participant data to prevent PII leakage.
 */

import { Context, Next } from 'hono';

export interface SafeLogEntry {
  timestamp: string;
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
}

const PII_KEYS = [
  'name',
  'email',
  'token',
  'cookie',
  'password',
  'secret',
  'authorization',
  'recipient',
  'rows',
  'importeddata',
  'effectivedata',
];

/**
 * @desc    Recursively redacts sensitive PII fields from object or array payloads.
 * @param   {any} value - Raw data object, array, or primitive.
 * @returns {any} Sanitized clone with sensitive keys replaced with [REDACTED].
 */
export function scrubPii(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item) => scrubPii(item));
  }

  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    const lower = k.toLowerCase();
    if (PII_KEYS.some((pk) => lower.includes(pk))) {
      result[k] = '[REDACTED]';
    } else if (typeof v === 'object') {
      result[k] = scrubPii(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

/**
 * @desc    Times request processing and outputs structured JSON audit logs scrubbed of sensitive PII.
 * @param   {Context} c - Hono context
 * @param   {Next} next - Next middleware handler
 * @mutates Reads c.get('requestId') and logs duration; does not mutate context.
 * @returns {Promise<void>} Resolves after downstream handlers complete and entry is logged.
 */
export const safeLoggerMiddleware = async (c: Context, next: Next) => {
  const start = Date.now();

  await next();

  const durationMs = Date.now() - start;
  const requestId = (c.get('requestId') as string) || '';

  const logEntry: SafeLogEntry = {
    timestamp: new Date().toISOString(),
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res ? c.res.status : 200,
    durationMs,
  };

  // Structured JSON output without payload or query PII
  if (process.env.NODE_ENV !== 'test') {
    console.log(JSON.stringify(logEntry));
  }
};
