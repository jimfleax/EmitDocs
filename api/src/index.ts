import { Hono } from 'hono'
import { cors } from 'hono/cors'
import mongoose from 'mongoose'
import 'dotenv/config'
import { checkHealth } from './controllers/health.controller'
import { auth } from './auth'

const app = new Hono().basePath('/api')

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());


app.use('*', cors({
  origin: (origin) => {
    if (!origin) return allowedOrigins[0];
    if (allowedOrigins.includes(origin)) return origin;
    return null;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-client-version', 'x-client-name', 'Accept'],
}))

// Database connection
const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.DB_NAME || 'emitdocs'

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

import templatesApp from './routes/templates.route';
import batchesApp from './routes/batches.route';
import storageApp from './routes/storage.route';

app.route('/templates', templatesApp);
app.route('/batches', batchesApp);
app.route('/storage', storageApp);

// Standardized Not Found Handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `API endpoint '${c.req.path}' not found`,
        path: c.req.path,
        timestamp: new Date().toISOString(),
      },
    },
    404
  )
})

// Standardized Global Error Handler
app.onError((err, c) => {
  console.error(`[API Error] ${c.req.method} ${c.req.path}:`, err)
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
      },
    },
    500
  )
})

import { getRequestListener } from '@hono/node-server'

export const config = {
  api: {
    bodyParser: false,
  },
};

export const honoApp = app
export default getRequestListener(app.fetch)
