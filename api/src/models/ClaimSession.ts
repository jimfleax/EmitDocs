/**
 * @file ClaimSession.ts
 * @description Mongoose schema and interface for scoped participant claim sessions (PRD-CORE-11).
 * @architecture Holds hashed session tokens (SHA-256) issued upon valid participant claim verification.
 *               Enforces short-lived participant access (TTL) bound to portalId, recipientId, and revision.
 *               Raw session tokens exist solely in secure, httpOnly cookies on the client.
 * @agent_note Only SHA-256 session token hashes are stored in the database; raw session tokens must never be persisted.
 */

import mongoose, { Schema, Document } from "mongoose";

/**
 * @interface IClaimSession
 * @description Mongoose document interface for an authenticated participant claim session.
 * @property {string} sessionTokenHash - SHA-256 hash of the random session token cookie.
 * @property {mongoose.Types.ObjectId} portalId - Reference to the target ClaimPortal.
 * @property {mongoose.Types.ObjectId} recipientId - Reference to the verified ApprovedRecipient.
 * @property {number} credentialSetRevision - Revision of the credential set active during verification.
 * @property {Date} expiresAt - Expiration timestamp managed by MongoDB TTL.
 * @property {Date} [revokedAt] - Timestamp when session was revoked, if applicable.
 * @property {Date} [lastUsedAt] - Timestamp when session was last used to access claims.
 * @property {Date} createdAt - Ingestion timestamp.
 * @property {Date} updatedAt - Modification timestamp.
 */
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

/**
 * @desc Mongoose schema for ClaimSession records.
 */
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

/**
 * @module ClaimSession
 * @desc Mongoose schema and model for ClaimSession
 * @description Compiled Mongoose model for ClaimSession documents.
 */
export const ClaimSession =
  mongoose.models.ClaimSession ||
  mongoose.model<IClaimSession>("ClaimSession", ClaimSessionSchema);
