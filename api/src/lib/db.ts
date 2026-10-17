/**
 * @file db.ts
 * @description Direct MongoDB native client connection and database instance provider.
 * @architecture Initializes and exports the shared MongoClient and Db instances required specifically by the
 *               Better-Auth MongoDB adapter (`@better-auth/mongo-adapter`). Operates alongside Mongoose connection pooling.
 * @agent_note For general domain models (Template, Batch, DraftRow), use Mongoose models rather than raw `db`.
 *             `db` and `mongoClient` are primarily used by auth subsystems and direct low-level queries.
 */

import { MongoClient } from 'mongodb';
import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not defined");
}

const client = new MongoClient(MONGODB_URI);

/**
 * @type {import('mongodb').Db}
 * @description Connected MongoDB database instance targeted at DB_NAME or default 'emitdocs'.
 */
export const db = client.db(process.env.DB_NAME || 'emitdocs');

/**
 * @type {MongoClient}
 * @description Root native MongoDB client instance connected to MONGODB_URI.
 */
export const mongoClient = client;
