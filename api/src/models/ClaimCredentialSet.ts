/**
 * @file ClaimCredentialSet.ts
 * @description Mongoose schema and interface for versioned credential sets bound to a ClaimPortal (PRD-CORE-11).
 * @architecture Captures the active credential configuration and lifecycle for a portal revision.
 *               Enforces strict mutual exclusion between generated tokens and imported credentials.
 *               Mode switches increment revision and mark previous credential sets as revoked.
 */

import mongoose, { Schema, Document } from "mongoose";
import { ClaimCredentialMode } from "./ClaimPortal.js";

export type CredentialSetStatus =
  | "preparing"
  | "awaiting_export_ack"
  | "ready"
  | "revoked"
  | "expired";

export interface IClaimCredentialSet extends Document {
  portalId: mongoose.Types.ObjectId;
  revision: number;
  mode: ClaimCredentialMode;
  sourceImportId?: mongoose.Types.ObjectId;
  primaryFieldKey?: string;
  secondaryFieldKey?: string;
  status: CredentialSetStatus;
  generatedAt?: Date;
  exportAcknowledgedAt?: Date;
  revokedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClaimCredentialSetSchema = new Schema<IClaimCredentialSet>(
  {
    portalId: { type: Schema.Types.ObjectId, ref: "ClaimPortal", required: true, index: true },
    revision: { type: Number, required: true },
    mode: {
      type: String,
      enum: ["generated_token", "imported_credential"],
      required: true,
    },
    sourceImportId: { type: Schema.Types.ObjectId, ref: "BatchImport" },
    primaryFieldKey: { type: String },
    secondaryFieldKey: { type: String },
    status: {
      type: String,
      enum: ["preparing", "awaiting_export_ack", "ready", "revoked", "expired"],
      default: "preparing",
    },
    generatedAt: { type: Date },
    exportAcknowledgedAt: { type: Date },
    revokedAt: { type: Date },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

ClaimCredentialSetSchema.index({ portalId: 1, revision: 1 }, { unique: true });

export const ClaimCredentialSet =
  mongoose.models.ClaimCredentialSet ||
  mongoose.model<IClaimCredentialSet>("ClaimCredentialSet", ClaimCredentialSetSchema);
