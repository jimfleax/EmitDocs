/**
 * @file auth-url.ts
 * @description Resolves canonical Better-Auth base URL from environment variables.
 * @architecture Ensures dynamic OAuth redirect URIs point to the correct domain across
 *               local development, preview, and production environments.
 * @agent_note Strips trailing slashes and /api suffix to ensure Better-Auth resolves relative auth paths accurately.
 */

/**
 * @desc Resolves and normalizes the Better-Auth base URL.
 *
 * Precedence:
 * 1. env.BETTER_AUTH_URL (trimmed)
 * 2. env.FRONTEND_URL (trimmed)
 * 3. env.VITE_API_BASE_URL (trimmed)
 * 4. Production fallback: "https://emitdocs.jimfleax.in" (when NODE_ENV === 'production' or VERCEL === '1')
 * 5. Development default: "http://localhost:3000"
 *
 * Normalization:
 * - Trims whitespace
 * - Strips trailing slashes, trailing `/api`, and subsequent trailing slashes
 *
 * @param {Record<string, string | undefined>} [env=process.env] - Environment variables object.
 * @returns {string} Normalized base URL for Better-Auth.
 */
export function resolveAuthBaseURL(env: Record<string, string | undefined> = process.env): string {
  const isProduction = env.NODE_ENV === "production" || env.VERCEL === "1";
  const rawUrl =
    env.BETTER_AUTH_URL?.trim() ||
    env.FRONTEND_URL?.trim() ||
    env.VITE_API_BASE_URL?.trim() ||
    (isProduction ? "https://emitdocs.jimfleax.in" : "http://localhost:3000");

  return rawUrl
    .replace(/\/+$/, "")
    .replace(/\/api$/, "")
    .replace(/\/+$/, "");
}
