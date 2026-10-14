/**
 * @file index.ts
 * @description Vercel serverless function entry point for the EmitDocs API.
 *
 * @architecture
 * - Re-exports serverless configuration, Hono application instance, and request listener from `../src/index.js`.
 * - Acts as the entry point routed by Vercel's Serverless Function routing engine (`api/api/*` or `api/*`).
 *
 * @agent_note
 * Keep this file as a pure re-export wrapper to maintain parity between local Node development and Vercel cloud deployment.
 */

export { config, honoApp } from '../src/index.js';
export { default } from '../src/index.js';
