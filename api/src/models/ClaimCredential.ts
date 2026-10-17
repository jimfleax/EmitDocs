/**
 * @file ClaimCredential.ts
 * @description Mongoose schema and interface for keyed HMAC credential verifiers (PRD-CORE-11).
 * @architecture Stores solely HMAC-SHA-256 verifiers rather than plaintext secret tokens.
 *               Links a recipient in an approved snapshot to their verifiable credential for an active revision.
 *               Indexed for constant-time lookup and recipient uniqueness.
 */

import mongoose, { Schema, Document } from "mongoose";

export interface IClaimCredential extends Document {
  ownerId: string;
  portalId: mongoose.Types.ObjectId;
  credentialSetId: mongoose.Types.ObjectId;
  credentialSetRevision: number;
  recipientId: mongoose.Types.ObjectId;
  credentialVerifier: string;
  credentialKind: "single" | "pair";
  verifierKeyVersion: number;
  strengthClass: "generated" | "strong_import" | "two_field_import";
  status: "active" | "revoked" | "expired";
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ClaimCredentialSchema = new Schema<IClaimCredential>(
  {
    ownerId: { type: String, required: true, index: true },
    portalId: { type: Schema.Types.ObjectId, ref: "ClaimPortal", required: true },
    credentialSetId: { type: Schema.Types.ObjectId, ref: "ClaimCredentialSet", required: true },
    credentialSetRevision: { type: Number, required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: "ApprovedRecipient", required: true },
    credentialVerifier: { type: String, required: true },
    credentialKind: { type: String, enum: ["single", "pair"], required: true },
    verifierKeyVersion: { type: Number, default: 1 },
    strengthClass: {
      type: String,
      enum: ["generated", "strong_import", "two_field_import"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "revoked", "expired"],
      default: "active",
      index: true,
    },
    revokedAt: { type: Date },
  },
  { timestamps: true }
);

ClaimCredentialSchema.index(
  { portalId: 1, credentialSetRevision: 1, credentialVerifier: 1 },
  { unique: true }
);
ClaimCredentialSchema.index(
  { portalId: 1, credentialSetRevision: 1, recipientId: 1 },
  { unique: true }
);

export const ClaimCredential =
  mongoose.models.ClaimCredential ||
  mongoose.model<IClaimCredential>("ClaimCredential", ClaimCredentialSchema);
