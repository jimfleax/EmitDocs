/**
 * @file ApprovedRecipient.ts
 * @description Mongoose schema and interface for frozen recipient records within an approved snapshot.
 * @architecture Stores deep copies of valid DraftRow records frozen at approval time (PRD-CORE-06).
 *               Decoupled from spreadsheet draft rows so subsequent draft edits, re-imports, or deletes
 *               cannot alter approved generation data. Includes generation lifecycle fields for document worker leasing.
 * @agent_note Compound index `{ snapshotId: 1, recipientKey: 1 }` guarantees idempotent upsert during chunked copy.
 */

import mongoose, { Schema, Document } from 'mongoose';

/**
 * @interface IApprovedRecipientDoc
 * @description Document interface for a frozen recipient record.
 */
export interface IApprovedRecipientDoc extends Document {
  snapshotId: mongoose.Types.ObjectId;
  batchId: mongoose.Types.ObjectId;
  ownerId: string;
  recipientKey: string;
  sourceRowNumber: number;
  effectiveData: Record<string, any>;
  overrides: Record<string, any>;
  digest: string;
  status: 'valid';
  generationStatus: 'pending' | 'leased' | 'generated' | 'failed';
  generationAttempts: number;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  outputKey: string | null;
  outputChecksum: string | null;
  outputBytes: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const ApprovedRecipientSchema = new Schema<IApprovedRecipientDoc>(
  {
    snapshotId: { type: Schema.Types.ObjectId, ref: 'ApprovedSnapshot', required: true, index: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    recipientKey: { type: String, required: true },
    sourceRowNumber: { type: Number, required: true },
    effectiveData: { type: Schema.Types.Mixed, required: true },
    overrides: { type: Schema.Types.Mixed, default: {} },
    digest: { type: String, default: '' },
    status: { type: String, enum: ['valid'], default: 'valid' },
    generationStatus: {
      type: String,
      enum: ['pending', 'leased', 'generated', 'failed'],
      default: 'pending',
    },
    generationAttempts: { type: Number, default: 0 },
    leaseOwner: { type: String, default: null },
    leaseExpiresAt: { type: Date, default: null },
    outputKey: { type: String, default: null },
    outputChecksum: { type: String, default: null },
    outputBytes: { type: Number, default: null },
  },
  { timestamps: true }
);

ApprovedRecipientSchema.index({ snapshotId: 1, recipientKey: 1 }, { unique: true });
ApprovedRecipientSchema.index({ batchId: 1, generationStatus: 1 });

/**
 * @module ApprovedRecipient
 * @description Compiled Mongoose model for ApprovedRecipient documents.
 */
export const ApprovedRecipient =
  mongoose.models.ApprovedRecipient ||
  mongoose.model<IApprovedRecipientDoc>('ApprovedRecipient', ApprovedRecipientSchema);
