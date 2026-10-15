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
 * 3. On Vercel / Production:
 *    - Automatically derives from Vercel system environment variables:
 *      `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` or `https://${env.VERCEL_URL}`
 *    - Falls back to canonical production API URL "https://emitdocs-api.vercel.app"
 *    - Explicitly rejects localhost/127.0.0.1 leakage when deployed on Vercel
 * 4. Local Development default: "http://localhost:3000"
 *
 * Normalization:
 * - Trims whitespace
 * - Strips trailing slashes, trailing `/api`, and subsequent trailing slashes
 *
 * @param {Record<string, string | undefined>} [env=process.env] - Environment variables object.
 * @returns {string} Normalized base URL for Better-Auth.
 */
export function resolveAuthBaseURL(env: Record<string, string | undefined> = process.env): string {
  const isVercel = env.VERCEL === "1" || env.VERCEL === "true";
  const isProduction = env.NODE_ENV === "production" || isVercel;

  const candidateUrls = [
    env.VITE_API_BASE_URL?.trim(),
    env.BETTER_AUTH_URL?.trim(),
  ].filter(Boolean) as string[];

  // In production/Vercel, filter out any local addresses that may have leaked from development .env
  const validProductionCandidate = candidateUrls.find(
    (url) => !url.includes("localhost") && !url.includes("127.0.0.1")
  );

  let rawUrl: string;

  if (validProductionCandidate) {
    rawUrl = validProductionCandidate;
  } else if (isVercel) {
    // Automatically derive from Vercel system environment variables
    const vercelHost = env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || env.VERCEL_URL?.trim();
    if (vercelHost) {
      rawUrl = `https://${vercelHost.replace(/^https?:\/\//, "")}`;
    } else {
      rawUrl = "https://emitdocs-api.vercel.app";
    }
  } else if (isProduction && candidateUrls.length > 0) {
    rawUrl = candidateUrls[0];
  } else {
    // Local development fallback
    rawUrl = candidateUrls[0] || "http://localhost:3000";
  }

  return rawUrl
    .replace(/\/+$/, "")
    .replace(/\/api$/, "")
    .replace(/\/+$/, "");
}
