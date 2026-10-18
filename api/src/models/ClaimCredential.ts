/**
 * @file ClaimCredential.ts
 * @description Mongoose schema and interface for keyed HMAC credential verifiers (PRD-CORE-11).
 * @architecture Stores solely HMAC-SHA-256 verifiers rather than plaintext secret tokens.
 *               Links a recipient in an approved snapshot to their verifiable credential for an active revision.
 *               Indexed for constant-time lookup and recipient uniqueness.
 * @agent_note Raw secret tokens or credentials must never be persisted; only HMAC verifiers are stored.
 */

import mongoose, { Schema, Document } from "mongoose";

/**
 * @interface IClaimCredential
 * @description Mongoose document interface for a recipient claim credential verifier.
 * @property {string} ownerId - Better-Auth user ID of the credential set owner.
 * @property {mongoose.Types.ObjectId} portalId - Reference to the parent ClaimPortal.
 * @property {mongoose.Types.ObjectId} credentialSetId - Reference to the versioned ClaimCredentialSet.
 * @property {number} credentialSetRevision - Revision number of the credential set.
 * @property {mongoose.Types.ObjectId} recipientId - Reference to the ApprovedRecipient.
 * @property {string} credentialVerifier - HMAC-SHA-256 verifier hash.
 * @property {"single" | "pair"} credentialKind - Single secret token or two-field credential pair.
 * @property {number} verifierKeyVersion - Version of the HMAC key used to compute verifier.
 * @property {"generated" | "strong_import" | "two_field_import"} strengthClass - Classification of credential strength.
 * @property {"active" | "revoked" | "expired"} status - Verification lifecycle status.
 * @property {Date} [revokedAt] - Timestamp when credential was revoked, if applicable.
 * @property {Date} createdAt - Ingestion timestamp.
 * @property {Date} updatedAt - Modification timestamp.
 */
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

/**
 * @desc Mongoose schema for ClaimCredential records.
 */
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

/**
 * @module ClaimCredential
 * @desc Mongoose schema and model for ClaimCredential
 * @description Compiled Mongoose model for ClaimCredential documents.
 */
export const ClaimCredential =
  mongoose.models.ClaimCredential ||
  mongoose.model<IClaimCredential>("ClaimCredential", ClaimCredentialSchema);
