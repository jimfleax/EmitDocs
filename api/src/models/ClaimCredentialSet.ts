/**
 * @file ClaimCredentialSet.ts
 * @description Mongoose schema and interface for versioned credential sets bound to a ClaimPortal (PRD-CORE-11).
 * @architecture Captures the active credential configuration and lifecycle for a portal revision.
 *               Enforces strict mutual exclusion between generated tokens and imported credentials.
 *               Mode switches increment revision and mark previous credential sets as revoked.
 * @agent_note Mode changes require incrementing revision and revoking previous sets; generated tokens and imported credentials are strictly mutually exclusive.
 */

import mongoose, { Schema, Document } from "mongoose";
import { ClaimCredentialMode } from "./ClaimPortal.js";

/**
 * @typedef {("preparing" | "awaiting_export_ack" | "ready" | "revoked" | "expired")} CredentialSetStatus
 * @description Lifecycle state of a versioned credential set.
 */
export type CredentialSetStatus =
  | "preparing"
  | "awaiting_export_ack"
  | "ready"
  | "revoked"
  | "expired";

/**
 * @interface IClaimCredentialSet
 * @description Mongoose document interface for versioned claim credential set configuration.
 * @property {mongoose.Types.ObjectId} portalId - Reference to the parent ClaimPortal.
 * @property {number} revision - Monotonically increasing revision number.
 * @property {ClaimCredentialMode} mode - Credential issuance strategy ('generated_token' or 'imported_credential').
 * @property {mongoose.Types.ObjectId} [sourceImportId] - Reference to BatchImport if imported mode.
 * @property {string} [primaryFieldKey] - Primary mapping key for imported credentials.
 * @property {string} [secondaryFieldKey] - Secondary mapping key for two-field credential import.
 * @property {CredentialSetStatus} status - Lifecycle state of the credential set.
 * @property {Date} [generatedAt] - Timestamp when generated tokens were minted.
 * @property {Date} [exportAcknowledgedAt] - Timestamp when organizer acknowledged export download.
 * @property {Date} [revokedAt] - Timestamp when credential set was superseded/revoked.
 * @property {string} createdBy - Better-Auth user ID of the creator.
 * @property {Date} createdAt - Ingestion timestamp.
 * @property {Date} updatedAt - Modification timestamp.
 */
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

/**
 * @desc Mongoose schema for ClaimCredentialSet records.
 */
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

/**
 * @module ClaimCredentialSet
 * @desc Mongoose schema and model for ClaimCredentialSet
 * @description Compiled Mongoose model for ClaimCredentialSet documents.
 */
export const ClaimCredentialSet =
  mongoose.models.ClaimCredentialSet ||
  mongoose.model<IClaimCredentialSet>("ClaimCredentialSet", ClaimCredentialSetSchema);
