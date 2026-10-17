/**
 * @file ClaimPortal.ts
 * @description Mongoose schema and interface for shared participant claim portals (PRD-CORE-11).
 * @architecture Serves as the public coordination hub for self-service certificate claims.
 *               Tied 1:1 to an approved batch snapshot, inheriting its strict expiration deadline.
 *               Transitions through: draft -> ready -> active <-> paused -> disabled -> closed / expired.
 */

import mongoose, { Schema, Document } from "mongoose";

export type ClaimPortalStatus =
  | "draft"
  | "ready"
  | "active"
  | "paused"
  | "disabled"
  | "closed"
  | "expired";

export type ClaimCredentialMode = "generated_token" | "imported_credential";

export interface IClaimPortal extends Document {
  publicSlug: string;
  ownerId: string;
  batchId: mongoose.Types.ObjectId;
  snapshotId: mongoose.Types.ObjectId;
  credentialMode: ClaimCredentialMode;
  credentialSetRevision: number;
  status: ClaimPortalStatus;
  label: string;
  instructions?: string;
  eligibleRecipientCount: number;
  excludedRecipientCount: number;
  uniqueClaimedCount: number;
  expiresAt: Date;
  activatedAt?: Date;
  pausedAt?: Date;
  disabledAt?: Date;
  closedAt?: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const ClaimPortalSchema = new Schema<IClaimPortal>(
  {
    publicSlug: { type: String, required: true, unique: true, index: true },
    ownerId: { type: String, required: true, index: true },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    snapshotId: { type: Schema.Types.ObjectId, ref: "ApprovedSnapshot", required: true },
    credentialMode: {
      type: String,
      enum: ["generated_token", "imported_credential"],
      default: "generated_token",
      required: true,
    },
    credentialSetRevision: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ["draft", "ready", "active", "paused", "disabled", "closed", "expired"],
      default: "draft",
      index: true,
    },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    instructions: { type: String, trim: true, maxlength: 2000 },
    eligibleRecipientCount: { type: Number, default: 0 },
    excludedRecipientCount: { type: Number, default: 0 },
    uniqueClaimedCount: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, index: true },
    activatedAt: { type: Date },
    pausedAt: { type: Date },
    disabledAt: { type: Date },
    closedAt: { type: Date },
    version: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ClaimPortalSchema.index({ ownerId: 1, batchId: 1 }, { unique: true });
ClaimPortalSchema.index({ ownerId: 1, updatedAt: -1 });

export const ClaimPortal =
  mongoose.models.ClaimPortal || mongoose.model<IClaimPortal>("ClaimPortal", ClaimPortalSchema);
