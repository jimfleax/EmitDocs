/**
 * @file auth-url.ts
 * @description Resolves canonical Better-Auth base URL from environment variables.
 * @architecture Ensures dynamic OAuth redirect URIs point to the correct domain across
 *               local development, preview, and production environments.
 */

/**
 * Resolves and normalizes the Better-Auth base URL.
 *
 * Precedence:
 * 1. env.VITE_API_BASE_URL (trimmed)
 * 2. env.BETTER_AUTH_URL (trimmed)
 * 3. "http://localhost:3000" (default)
 *
 * Normalization:
 * - Trims whitespace
 * - Strips trailing slashes, trailing `/api`, and subsequent trailing slashes
 *
 * @param {Record<string, string | undefined>} [env=process.env] - Environment variables object.
 * @returns {string} Normalized base URL for Better-Auth.
 */
export function resolveAuthBaseURL(env: Record<string, string | undefined> = process.env): string {
  const rawUrl =
    env.VITE_API_BASE_URL?.trim() ||
    env.BETTER_AUTH_URL?.trim() ||
    "http://localhost:3000";

  return rawUrl
    .replace(/\/+$/, "")
    .replace(/\/api$/, "")
    .replace(/\/+$/, "");
}
