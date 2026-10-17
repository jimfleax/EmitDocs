/**
 * @file ClaimRateLimit.ts
 * @description Mongoose schema and interface for serverless atomic claim rate limiting (PRD-CORE-11).
 * @architecture Enables multi-window rate limiting on serverless environments without in-memory state or Redis.
 *               Uses atomic $inc and $setOnInsert with MongoDB TTL expiresAfterSeconds for automatic window cleanup.
 */

import mongoose, { Schema, Document } from "mongoose";

export interface IClaimRateLimit extends Document {
  key: string;
  count: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ClaimRateLimitSchema = new Schema<IClaimRateLimit>(
  {
    key: { type: String, required: true, unique: true, index: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

ClaimRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ClaimRateLimit =
  mongoose.models.ClaimRateLimit ||
  mongoose.model<IClaimRateLimit>("ClaimRateLimit", ClaimRateLimitSchema);
