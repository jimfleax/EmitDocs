/**
 * @file index.ts
 * @description Main application server entry point, database connection manager, middleware pipeline, and route mount registry for the EmitDocs API.
 *
 * @architecture
 * - Instantiates the root Hono application with base path `/api`.
 * - Configures global CORS using dynamic origin resolution (`resolveCorsOrigin`).
 * - Manages serverless-safe Mongoose connection pooling with caching and exponential retry backoff.
 * - Mounts Better-Auth wildcard routes (`/auth/*`) with request reconstruction for pre-parsed bodies.
 * - Registers sub-routers for templates (`/templates`), batches (`/batches`), and storage (`/storage`).
 * - Provides standardized global 404 (notFound) and 500 (onError) handlers.
 * - Exports both `honoApp` instance and Node listener via `getRequestListener` for serverless or Node runtime hosts.
 *
 * @agent_note
 * Vercel serverless functions disable standard body parsing via `export const config = { api: { bodyParser: false } }`.
 * When proxying incoming bodies to Better-Auth, `incoming.body` is reconstructed into a standard `Request` object if present.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import mongoose from 'mongoose'
import crypto from 'crypto'
import 'dotenv/config'
import { checkHealth } from './controllers/health.controller.js'
import { auth } from './auth.js'
import { resolveCorsOrigin } from './lib/origins.js'
import { validateEnvironment } from './config/production-guard.js'
import { requestIdMiddleware } from './middleware/request-id.middleware.js'
import { safeLoggerMiddleware } from './middleware/safe-logger.middleware.js'

// Validate environment on boot (fail-closed in production)
if (process.env.NODE_ENV !== 'test') {
  try {
    validateEnvironment();
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Production Guard] Environment validation failed:', err);
      process.exit(1);
    } else {
      console.warn('[Environment Guard] Non-fatal dev warning:', err);
    }
  }
}

const app = new Hono().basePath('/api')

app.use('*', requestIdMiddleware)
app.use('*', safeLoggerMiddleware)

app.use('*', cors({
  origin: (origin) => resolveCorsOrigin(origin),
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-client-version', 'x-client-name', 'Accept', 'Cookie', 'x-request-id', 'x-test-auth-user'],
}))

// Database connection
const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.DB_NAME || 'emitdocs'

/**
 * Global cache interface for preserving Mongoose connection handles across serverless cold starts.
 */
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = (globalThis as any).mongooseCache;

if (!cached) {
  cached = (globalThis as any).mongooseCache = { conn: null, promise: null };
}

/**
 * Establishes or reuses a cached MongoDB connection with configurable retry attempts.
 *
 * @param {number} [retries=3] - Number of connection attempts before failing.
 * @param {number} [delay=5000] - Backoff delay in milliseconds between failed connection attempts.
 * @returns {Promise<typeof mongoose | null>} The active Mongoose instance or null if unconfigured/failed.
 * @throws {Error} When connection attempts are exhausted without establishing a connection.
 */
const connectDB = async (retries = 3, delay = 5000): Promise<typeof mongoose | null> => {
  // 1. If already connected, return immediately
  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose;
    return cached.conn;
  }

  // 2. If cached connection exists and is connected
  if (cached.conn && cached.conn.connection.readyState === 1) {
    return cached.conn;
  }

  if (!MONGODB_URI) {
    console.warn('MONGODB_URI is not defined in environment variables.');
    return null;
  }

  let uri: string;
  try {
    const url = new URL(MONGODB_URI);
    url.pathname = `/${DB_NAME}`;
    uri = url.toString();
  } catch (err) {
    console.error('Invalid MONGODB_URI format:', err);
    return null;
  }

  // 3. If a connection is not already in flight, create the shared promise
  if (!cached.promise) {
    cached.promise = (async () => {
      let attemptsLeft = retries;
      while (attemptsLeft > 0) {
        try {
          const client = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
          });
          console.log(`Successfully connected to MongoDB database: ${DB_NAME}`);
          cached.conn = client;
          return client;
        } catch (err) {
          attemptsLeft -= 1;
          console.error(`MongoDB connection failed. Retries left: ${attemptsLeft}`);
          if (attemptsLeft === 0) {
            cached.promise = null;
            throw err instanceof Error ? err : new Error('Failed to connect to MongoDB after maximum retries');
          }
          console.log(`Retrying connection in ${delay / 1000} seconds...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      return null as any;
    })();
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
};

// Global Mongoose Event Handlers
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB connection lost. Mongoose will attempt to auto-reconnect.');
  cached.conn = null;
  cached.promise = null;
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB encountered a runtime error:', err);
});

// Database middleware ensures every API request has a DB connection safely
app.use('*', async (c, next) => {
  await connectDB()
  await next()
})

app.get('/health', checkHealth)

app.all("/auth/*", (c) => {
  let req = c.req.raw;
  const incoming = (c.env as any)?.incoming;
  if (incoming?.body && req.method !== 'GET' && req.method !== 'HEAD') {
    req = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: JSON.stringify(incoming.body)
    });
  }
  return auth.handler(req);
})

app.get('/', (c) => {
  return c.json({ 
    message: 'Welcome to EmitDocs API',
    tagline: 'Document Automation · Bulk Issuance',
    positioning: 'One template. Every recipient. Ready to go.',
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  })
})

import templatesApp from './routes/templates.route.js';
import batchesApp from './routes/batches.route.js';
import storageApp from './routes/storage.route.js';
import accountApp from './routes/account.route.js';
import claimPortalsApp from './routes/claim-portals.route.js';
import publicClaimApp from './routes/public-claim.route.js';

app.route('/templates', templatesApp);
app.route('/batches', batchesApp);
app.route('/storage', storageApp);
app.route('/account', accountApp);
app.route('/claim-portals', claimPortalsApp);
app.route('/public/claim-portals', publicClaimApp);

// Standardized Not Found Handler
app.notFound((c) => {
  const requestId = (c as any).get('requestId') || crypto.randomUUID()
  c.header('x-request-id', requestId)
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `API endpoint '${c.req.path}' not found`,
        path: c.req.path,
        timestamp: new Date().toISOString(),
        requestId,
      },
    },
    404
  )
})

// Standardized Global Error Handler
app.onError((err, c) => {
  console.error(`[API Error] ${c.req.method} ${c.req.path}:`, err)
  const requestId = (c as any).get('requestId') || crypto.randomUUID()
  c.header('x-request-id', requestId)
  const isDev = process.env.NODE_ENV !== 'production'
  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: isDev ? err.message : 'An unexpected server error occurred',
        ...(isDev && err.stack ? { stack: err.stack } : {}),
        path: c.req.path,
        timestamp: new Date().toISOString(),
        requestId,
      },
    },
    500
  )
})

import { getRequestListener, serve } from '@hono/node-server'

/**
 * Serverless function configuration disabling automated body parsing so raw streams remain readable.
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * The configured root Hono application instance.
 */
export const honoApp = app

/**
 * Default Node.js request listener handler for production deployment and local development.
 */
export default getRequestListener(app.fetch)

// In local Node development outside Vercel, start the HTTP server on port 3000
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT) || 3000
  serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    console.log(`[EmitDocs API] Server listening on http://localhost:${info.port}`)
  })
}
