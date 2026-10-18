/**
 * @file ClaimPortal.ts
 * @description Mongoose schema and interface for shared participant claim portals (PRD-CORE-11).
 * @architecture Serves as the public coordination hub for self-service certificate claims.
 *               Tied 1:1 to an approved batch snapshot, inheriting its strict expiration deadline.
 *               Transitions through: draft -> ready -> active <-> paused -> disabled -> closed / expired.
 * @agent_note Portals inherit the retention expiration date of the approved batch snapshot; when snapshot expires, portal must automatically expire.
 */

import mongoose, { Schema, Document } from "mongoose";

/**
 * @typedef {("draft" | "ready" | "active" | "paused" | "disabled" | "closed" | "expired")} ClaimPortalStatus
 * @description Lifecycle state machine status of a participant claim portal.
 */
export type ClaimPortalStatus =
  | "draft"
  | "ready"
  | "active"
  | "paused"
  | "disabled"
  | "closed"
  | "expired";

/**
 * @typedef {("generated_token" | "imported_credential")} ClaimCredentialMode
 * @description Credential issuance strategy used by the claim portal.
 */
export type ClaimCredentialMode = "generated_token" | "imported_credential";

/**
 * @interface IClaimPortal
 * @description Mongoose document interface for a public certificate claim portal.
 * @property {string} publicSlug - Unique URL slug for participant access.
 * @property {string} ownerId - Better-Auth user ID of the portal owner.
 * @property {mongoose.Types.ObjectId} batchId - Reference to the target Batch.
 * @property {mongoose.Types.ObjectId} snapshotId - Reference to the frozen ApprovedSnapshot.
 * @property {ClaimCredentialMode} credentialMode - Active credential distribution mode.
 * @property {number} credentialSetRevision - Active revision number of the credential set.
 * @property {ClaimPortalStatus} status - Operational state of the portal.
 * @property {string} label - Human-friendly portal title displayed on the public page.
 * @property {string} [instructions] - Organizer-provided claiming instructions.
 * @property {number} eligibleRecipientCount - Count of valid snapshot recipients eligible to claim.
 * @property {number} excludedRecipientCount - Count of recipients manually excluded from portal.
 * @property {number} uniqueClaimedCount - Count of unique recipients who claimed certificates.
 * @property {Date} expiresAt - Absolute expiration timestamp matching snapshot retention.
 * @property {Date} [activatedAt] - Timestamp when portal was initially activated.
 * @property {Date} [pausedAt] - Timestamp when portal was temporarily paused.
 * @property {Date} [disabledAt] - Timestamp when portal was disabled due to security/abuse.
 * @property {Date} [closedAt] - Timestamp when organizer manually closed the portal.
 * @property {number} version - Concurrency control version counter.
 * @property {Date} createdAt - Ingestion timestamp.
 * @property {Date} updatedAt - Modification timestamp.
 */
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

/**
 * @desc Mongoose schema for ClaimPortal records.
 */
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

/**
 * @module ClaimPortal
 * @desc Mongoose schema and model for ClaimPortal
 * @description Compiled Mongoose model for ClaimPortal documents.
 */
export const ClaimPortal =
  mongoose.models.ClaimPortal || mongoose.model<IClaimPortal>("ClaimPortal", ClaimPortalSchema);
