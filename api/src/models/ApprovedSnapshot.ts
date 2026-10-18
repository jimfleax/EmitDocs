/**
 * @file ApprovedSnapshot.ts
 * @description Mongoose schema and interface for frozen, immutable batch approval snapshots.
 * @architecture Implements the immutable snapshot boundary for bulk document issuance (PRD-CORE-06).
 *               Captures the exact template version, source checksum, visual mapping hash, and import revision
 *               along with a canonical SHA-256 digest calculated across all valid recipient records.
 *               Once set to 'ready', snapshots are strictly immutable and retained according to `retentionHours`.
 * @agent_note Interrupted builds with status 'building' are resumed idempotently using the compound index
 *             `{ batchId: 1, idempotencyKey: 1 }`.
 */

import mongoose, { Schema, Document } from 'mongoose';

/**
 * @typedef {('building' | 'ready' | 'failed' | 'superseded')} SnapshotStatus
 * @description Progression status of an approved snapshot freeze.
 */
export type SnapshotStatus = 'building' | 'ready' | 'failed' | 'superseded';

/**
 * @interface IApprovedSnapshotDoc
 * @description Document interface for an approved immutable batch snapshot.
 */
export interface IApprovedSnapshotDoc extends Document {
  batchId: mongoose.Types.ObjectId;
  ownerId: string;
  templateId: mongoose.Types.ObjectId;
  templateVersionId: mongoose.Types.ObjectId;
  templateVersion: number;
  templateSourceChecksum: string;
  mappingHash: string;
  importRevision: number;
  retentionHours: number;
  expiresAt: Date;
  canonicalDigest: string;
  totalRecipients: number;
  idempotencyKey: string;
  status: SnapshotStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * @desc Mongoose schema for ApprovedSnapshot records.
 */
const ApprovedSnapshotSchema = new Schema<IApprovedSnapshotDoc>(
  {
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'Template', required: true },
    templateVersionId: { type: Schema.Types.ObjectId, ref: 'TemplateVersion', required: true },
    templateVersion: { type: Number, required: true },
    templateSourceChecksum: { type: String, default: '' },
    mappingHash: { type: String, required: true },
    importRevision: { type: Number, required: true },
    retentionHours: { type: Number, default: 168 },
    expiresAt: { type: Date, required: true },
    canonicalDigest: { type: String, required: true },
    totalRecipients: { type: Number, default: 0 },
    idempotencyKey: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['building', 'ready', 'failed', 'superseded'],
      default: 'building',
    },
  },
  { timestamps: true }
);

ApprovedSnapshotSchema.index({ batchId: 1, idempotencyKey: 1 });
ApprovedSnapshotSchema.index({ ownerId: 1, status: 1 });

/**
 * @module ApprovedSnapshot
 * @desc Mongoose schema and model for ApprovedSnapshot
 * @description Compiled Mongoose model for ApprovedSnapshot documents.
 */
export const ApprovedSnapshot =
  mongoose.models.ApprovedSnapshot ||
  mongoose.model<IApprovedSnapshotDoc>('ApprovedSnapshot', ApprovedSnapshotSchema);
