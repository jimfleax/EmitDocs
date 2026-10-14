/**
 * @file health.controller.ts
 * @description Health monitoring and system diagnostics endpoint handler.
 * @architecture Serves unauthenticated ping requests at `/api/health` to report server availability,
 *               UTC timestamp, and live Mongoose database connection state.
 * @agent_note Used by deployment platforms (Vercel, container health checks) and client uptime monitors.
 */

import { Context } from 'hono'
import mongoose from 'mongoose'

/**
 * @desc Checks API health and MongoDB database connectivity status.
 * @route GET /api/health
 * @access Public
 * @returns {Object} JSON payload with status ('ok'), success (true), timestamp, and database ('connected' | 'disconnected').
 */
export const checkHealth = (c: Context) => {
  return c.json({
    status: 'ok',
    success: true,
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  }, 200)
}

