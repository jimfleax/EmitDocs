/**
 * @file ClaimSession.ts
 * @description Mongoose schema and interface for scoped participant claim sessions (PRD-CORE-11).
 * @architecture Holds hashed session tokens (SHA-256) issued upon valid participant claim verification.
 *               Enforces short-lived participant access (TTL) bound to portalId, recipientId, and revision.
 *               Raw session tokens exist solely in secure, httpOnly cookies on the client.
 */

import mongoose, { Schema, Document } from "mongoose";

export interface IClaimSession extends Document {
  sessionTokenHash: string;
  portalId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  credentialSetRevision: number;
  expiresAt: Date;
  revokedAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ClaimSessionSchema = new Schema<IClaimSession>(
  {
    sessionTokenHash: { type: String, required: true, unique: true, index: true },
    portalId: { type: Schema.Types.ObjectId, ref: "ClaimPortal", required: true, index: true },
    recipientId: { type: Schema.Types.ObjectId, ref: "ApprovedRecipient", required: true },
    credentialSetRevision: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    lastUsedAt: { type: Date },
  },
  { timestamps: true }
);

ClaimSessionSchema.index({ portalId: 1, recipientId: 1 });
ClaimSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ClaimSession =
  mongoose.models.ClaimSession ||
  mongoose.model<IClaimSession>("ClaimSession", ClaimSessionSchema);
