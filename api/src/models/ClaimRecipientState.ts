/**
 * @file ClaimRecipientState.ts
 * @description Mongoose schema and interface for recipient eligibility and claim tracking (PRD-CORE-11).
 * @architecture Tracks whether each recipient in the snapshot is eligible, claimed, revoked, excluded, or expired.
 *               Ensures atomic idempotency for claims: firstClaimAt records initial claim without double-counting.
 */

import mongoose, { Schema, Document } from "mongoose";

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

export const ClaimRecipientState =
  mongoose.models.ClaimRecipientState ||
  mongoose.model<IClaimRecipientState>("ClaimRecipientState", ClaimRecipientStateSchema);
