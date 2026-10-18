/**
 * @file ClaimRecipientState.ts
 * @description Mongoose schema and interface for recipient eligibility and claim tracking (PRD-CORE-11).
 * @architecture Tracks whether each recipient in the snapshot is eligible, claimed, revoked, excluded, or expired.
 *               Ensures atomic idempotency for claims: firstClaimAt records initial claim without double-counting.
 * @agent_note Compound index `{ portalId: 1, recipientId: 1 }` prevents duplicate recipient claim records within a portal.
 */

import mongoose, { Schema, Document } from "mongoose";

/**
 * @interface IClaimRecipientState
 * @description Mongoose document interface for tracking participant claim progression.
 * @property {mongoose.Types.ObjectId} portalId - Reference to the target ClaimPortal.
 * @property {mongoose.Types.ObjectId} snapshotId - Reference to the frozen ApprovedSnapshot.
 * @property {mongoose.Types.ObjectId} recipientId - Reference to the ApprovedRecipient.
 * @property {mongoose.Types.ObjectId} [outputId] - Reference to generated document output if already rendered.
 * @property {"eligible" | "claimed" | "revoked" | "excluded" | "expired"} status - Individual claiming state.
 * @property {Date} [firstClaimAt] - Timestamp when certificate was first claimed.
 * @property {Date} [lastClaimAt] - Timestamp when certificate was most recently downloaded/viewed.
 * @property {number} credentialSetRevision - Revision of the credential set active during state creation.
 * @property {Date} createdAt - Ingestion timestamp.
 * @property {Date} updatedAt - Modification timestamp.
 */
export interface IClaimRecipientState extends Document {
  portalId: mongoose.Types.ObjectId;
  snapshotId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  outputId?: mongoose.Types.ObjectId;
  status: "eligible" | "claimed" | "revoked" | "excluded" | "expired";
  firstClaimAt?: Date;
  lastClaimAt?: Date;
  credentialSetRevision: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * @desc Mongoose schema for ClaimRecipientState records.
 */
const ClaimRecipientStateSchema = new Schema<IClaimRecipientState>(
  {
    portalId: { type: Schema.Types.ObjectId, ref: "ClaimPortal", required: true },
    snapshotId: { type: Schema.Types.ObjectId, ref: "ApprovedSnapshot", required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: "ApprovedRecipient", required: true },
    outputId: { type: Schema.Types.ObjectId },
    status: {
      type: String,
      enum: ["eligible", "claimed", "revoked", "excluded", "expired"],
      default: "eligible",
      index: true,
    },
    firstClaimAt: { type: Date },
    lastClaimAt: { type: Date },
    credentialSetRevision: { type: Number, required: true },
  },
  { timestamps: true }
);

ClaimRecipientStateSchema.index({ portalId: 1, recipientId: 1 }, { unique: true });
ClaimRecipientStateSchema.index({ portalId: 1, status: 1 });

/**
 * @module ClaimRecipientState
 * @desc Mongoose schema and model for ClaimRecipientState
 * @description Compiled Mongoose model for ClaimRecipientState documents.
 */
export const ClaimRecipientState =
  mongoose.models.ClaimRecipientState ||
  mongoose.model<IClaimRecipientState>("ClaimRecipientState", ClaimRecipientStateSchema);
