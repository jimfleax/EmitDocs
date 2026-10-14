/**
 * @file origins.ts
 * @description Origin verification, CORS resolution, and dynamic deployment pattern matching.
 * @architecture Centralizes allowed web origin rules for both Hono CORS middleware and Better-Auth
 *               trustedOrigins config. Supports canonical production/dev domains, env variable overrides,
 *               and dynamic regex matching for Vercel preview environments.
 * @agent_note When adding new preview environments or testing locally with different ports, update
 *               `CANONICAL_ORIGINS` or supply comma-separated values in `ALLOWED_ORIGINS` env var.
 */

/**
 * Canonical production and default local development origins.
 */
const CANONICAL_ORIGINS = [
  'https://emitdocs.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

/**
 * Regex matching Vercel preview environments:
 * e.g., https://emitdocs.vercel.app, https://emitdocs-git-feature.vercel.app,
 * or https://emitdocs-abc1234.vercel.app
 */
const VERCEL_PREVIEW_REGEX = /^https:\/\/(emitdocs|emitdocs-[a-z0-9-]+)\.vercel\.app$/i;

/**
 * Normalizes an origin string by trimming whitespace and removing trailing slashes.
 * 
 * @desc Cleans raw origin string for deterministic URL comparison.
 * @param {string} origin - Raw origin URL.
 * @returns {string} Sanitized origin without trailing slashes.
 */
function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

/**
 * Returns a deduplicated array of all allowed origins based on environment
 * variables and canonical domain rules.
 * 
 * @desc Computes the authoritative list of trusted origins for CORS and authentication.
 * @returns {string[]} Array of permitted origin URL strings.
 */
export function getAllowedOrigins(): string[] {
  const envOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((o) => normalizeOrigin(o))
    .filter(Boolean);

  const originsSet = new Set<string>();

  // Process configured environment origins
  for (const origin of envOrigins) {
    originsSet.add(origin);

    if (origin.startsWith('http://') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      // Add https counterpart for non-localhost http origins (e.g. http://emitdocs.vercel.app -> https://emitdocs.vercel.app)
      originsSet.add(`https://${origin.slice('http://'.length)}`);
    } else if (origin.startsWith('https://')) {
      // Add http counterpart for network / local proxy testing
      originsSet.add(`http://${origin.slice('https://'.length)}`);
    }
  }

  // Always ensure canonical origins are present
  for (const canonical of CANONICAL_ORIGINS) {
    originsSet.add(canonical);
  }

  return Array.from(originsSet);
}

/**
 * Determines whether a given origin string is permitted.
 * 
 * @desc Evaluates whether an incoming request origin is allowed against explicit lists and regexes.
 * @param {string | undefined} origin - Origin header value from incoming HTTP request.
 * @returns {boolean} True if origin is permitted, false otherwise.
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;

  const normalized = normalizeOrigin(origin);
  const allowedList = getAllowedOrigins();

  if (allowedList.includes(normalized)) {
    return true;
  }

  // Check Vercel preview deployments
  if (VERCEL_PREVIEW_REGEX.test(normalized)) {
    return true;
  }

  return false;
}

/**
 * Resolves the CORS origin header response value.
 * If origin is omitted (e.g. server-to-server or curl), returns primary allowed origin.
 * If origin is allowed, returns the origin.
 * Otherwise returns null to refuse CORS credentials/headers.
 * 
 * @desc Resolves exact value to reflect in `Access-Control-Allow-Origin` header for Hono CORS.
 * @param {string | undefined} origin - Request origin header value.
 * @returns {string | null} Exact allowed origin string, or null if denied.
 */
export function resolveCorsOrigin(origin: string | undefined): string | null {
  if (!origin) {
    const list = getAllowedOrigins();
    return list[0] || 'https://emitdocs.vercel.app';
  }

  if (isOriginAllowed(origin)) {
    return origin;
  }

  return null;
}

