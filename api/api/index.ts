import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import mongoose from 'mongoose'
import 'dotenv/config'

const app = new Hono().basePath('/api')

// Database connection
const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.DB_NAME || 'emitdocs'

const connectDB = async (retries = 3, delay = 5000) => {
  if (!MONGODB_URI) {
    console.warn('MONGODB_URI is not defined in environment variables.')
    return
  }

  let uri: string
  try {
    const url = new URL(MONGODB_URI)
    url.pathname = `/${DB_NAME}`
    uri = url.toString()
  } catch (err) {
    console.error('Invalid MONGODB_URI format:', err)
    return
  }

  while (retries > 0) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      })
      console.log(`Successfully connected to MongoDB database: ${DB_NAME}`)
      return
    } catch (err) {
      retries -= 1
      console.error(`MongoDB connection failed. Retries left: ${retries}`)
      if (retries === 0) {
        console.error('Maximum retries reached. Exiting application...')
        process.exit(1)
      }
      console.log(`Retrying connection in ${delay / 1000} seconds...`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

// Global Mongoose Event Handlers
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB connection lost. Mongoose will attempt to auto-reconnect.')
})

mongoose.connection.on('error', (err) => {
  console.error('MongoDB encountered a runtime error:', err)
})

// Initialize connection
connectDB()

app.get('/', (c) => {
  return c.json({ 
    message: 'Welcome to EmitDocs API',
    tagline: 'Document Automation · Bulk Issuance',
    positioning: 'One template. Every recipient. Ready to go.',
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  })
})

export default handle(app)
