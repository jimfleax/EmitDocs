/**
 * @file auth.ts
 * @description Better-Auth authentication library configuration and instance initialization.
 * @architecture Configures social identity providers (Google OAuth), connects to the native MongoDB client
 *               via `@better-auth/mongo-adapter`, and establishes dynamic trusted origin policies.
 *               Exported `auth` instance is mounted directly in Hono router (`/api/auth/*`) and consumed
 *               by `requireAuth` middleware for session resolution.
 * @agent_note When changing cookies, origins, or session schemas, ensure changes align with both
 *             the web client Better-Auth client configuration and backend CORS headers in `api/src/index.ts`.
 */

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { db } from "./lib/db.js";
import { getAllowedOrigins } from "./lib/origins.js";
import { resolveAuthBaseURL } from "./lib/auth-url.js";
import 'dotenv/config';

/**
 * @type {ReturnType<typeof betterAuth>}
 * @description Central Better-Auth authentication handler instance.
 */
export const auth = betterAuth({
  baseURL: resolveAuthBaseURL(),
  advanced: {
    trustedProxyHeaders: true,
  },
  database: mongodbAdapter(db),
  trustedOrigins: getAllowedOrigins(),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
});

