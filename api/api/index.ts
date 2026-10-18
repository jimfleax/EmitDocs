/**
 * @file index.ts
 * @description Vercel serverless function entry point for the EmitDocs API.
 * @architecture Re-exports serverless configuration, Hono application instance, and request listener from ../src/index.js.
 * @agent_note Keep this file as a pure re-export wrapper to maintain parity between local Node development and Vercel cloud deployment.
 */

export { config, honoApp } from '../src/index.js';
export { default } from '../src/index.js';
