import { Context } from 'hono'
import mongoose from 'mongoose'

export const checkHealth = (c: Context) => {
  return c.json({
    status: 'ok',
    success: true,
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  }, 200)
}
