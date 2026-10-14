/**
 * @file auth-client.ts
 * @description Better Auth client instance configuration for React frontend.
 * @architecture Initializes authentication client talking to the backend API base URL for session and user state.
 * @agent_note Relies on VITE_API_BASE_URL environment variable, defaulting to http://localhost:3000.
 */

import { createAuthClient } from "better-auth/react";

/**
 * Better Auth React client instance.
 */
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
});
