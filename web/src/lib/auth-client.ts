/**
 * @file auth-client.ts
 * @description Better Auth client instance configuration for React frontend.
 * @architecture Initializes authentication client talking to the backend API base URL for session and user state.
 *               Dynamically resolves between current origin and configured environment variables.
 * @agent_note Always resolves to window.location.origin in browser environments to leverage the same-origin reverse proxy,
 *             defaulting to VITE_API_BASE_URL or http://localhost:3000 in non-browser / SSR contexts.
 */

import { createAuthClient } from "better-auth/react";

/**
 * Resolves the client API base URL dynamically.
 * In browser runtime, always resolves to window.location.origin so requests go through the
 * same-origin reverse proxy (/api/*), enabling first-party cookies.
 * Falls back to VITE_API_BASE_URL or http://localhost:3000 in non-browser / SSR contexts.
 */
function getClientBaseURL(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  const envUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  return envUrl || "http://localhost:3000";
}

/**
 * Better Auth React client instance.
 */
export const authClient = createAuthClient({
  baseURL: getClientBaseURL(),
});
