/**
 * @file auth-client.ts
 * @description Better Auth client instance configuration for React frontend.
 * @architecture Initializes authentication client talking to the backend API base URL for session and user state.
 *               Dynamically resolves between configured environment variables and current origin.
 * @agent_note Relies on VITE_API_BASE_URL environment variable, defaulting to window.location.origin in production
 *             or http://localhost:3000 in local development.
 */

import { createAuthClient } from "better-auth/react";

/**
 * Resolves the client API base URL dynamically.
 * Prioritizes VITE_API_BASE_URL if set (and not localhost in production),
 * falling back to window.location.origin in browser environments or localhost:3000.
 */
function getClientBaseURL(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envUrl && (import.meta.env.DEV || !envUrl.includes("localhost"))) {
    return envUrl;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return envUrl || "http://localhost:3000";
}

/**
 * Better Auth React client instance.
 */
export const authClient = createAuthClient({
  baseURL: getClientBaseURL(),
});
