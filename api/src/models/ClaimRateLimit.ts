/**
 * @file ClaimRateLimit.ts
 * @description Mongoose schema and interface for serverless atomic claim rate limiting (PRD-CORE-11).
 * @architecture Enables multi-window rate limiting on serverless environments without in-memory state or Redis.
 *               Uses atomic $inc and $setOnInsert with MongoDB TTL expiresAfterSeconds for automatic window cleanup.
 * @agent_note Relies on MongoDB TTL index on `expiresAt` for zero-maintenance automatic window expiration.
 */

import mongoose, { Schema, Document } from "mongoose";

/**
 * @interface IClaimRateLimit
 * @description Mongoose document interface for atomic rate limit tracking buckets.
 * @property {string} key - Unique rate limit cache key (combining IP/portal and window bucket).
 * @property {number} count - Request counter for this time window.
 * @property {Date} expiresAt - Absolute timestamp when rate limit document expires via MongoDB TTL.
 * @property {Date} createdAt - Ingestion timestamp.
 * @property {Date} updatedAt - Modification timestamp.
 */
export interface IClaimRateLimit extends Document {
  key: string;
  count: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * @desc Mongoose schema for ClaimRateLimit records.
 */
const ClaimRateLimitSchema = new Schema<IClaimRateLimit>(
  {
    key: { type: String, required: true, unique: true, index: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

ClaimRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * @module ClaimRateLimit
 * @desc Mongoose schema and model for ClaimRateLimit
 * @description Compiled Mongoose model for ClaimRateLimit documents.
 */
export const ClaimRateLimit =
  mongoose.models.ClaimRateLimit ||
  mongoose.model<IClaimRateLimit>("ClaimRateLimit", ClaimRateLimitSchema);
