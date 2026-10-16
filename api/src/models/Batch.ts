/**
 * @file Batch.ts
 * @description Mongoose schema and interface for bulk document issuance batches.
 * @architecture Central coordination model for the bulk issuance workflow. Links a user to a specific
 *               `templateId` and `templateVersionId`, tracks revision progress (`currentImportRevision`),
 *               aggregates authoritatively calculated row metrics (valid, invalid, duplicates), and tracks
 *               overall lifecycle status from 'draft' through 'generating' to 'ready_for_download'.
 * @agent_note When updating draft rows or imports, never manually increment row counters on Batch directly;
 *             always use `recalculateBatchCounters` in `batch-intake.ts` to maintain transactional truth.
 */

import mongoose, { Schema, Document } from 'mongoose';

/**
 * @typedef {('draft' | 'importing' | 'review' | 'awaiting_approval' | 'approved' | 'generating' | 'ready_for_download' | 'paused' | 'cancelled' | 'failed' | 'deleting')} BatchStatus
 * @description Represents the lifecycle state machine status of a bulk generation batch.
 */
export type BatchStatus =
  | 'draft'
  | 'importing'
  | 'review'
  | 'awaiting_approval'
  | 'approved'
  | 'generating'
  | 'ready_for_download'
  | 'paused'
  | 'cancelled'
  | 'failed'
  | 'deleting'
  | 'expired';

/**
 * @interface IBatch
 * @description Mongoose document interface for a bulk issuance batch.
 * @property {string} ownerId - Better-Auth user ID of the batch owner.
 * @property {mongoose.Types.ObjectId} templateId - Reference to the target Template.
 * @property {mongoose.Types.ObjectId} templateVersionId - Reference to the locked TemplateVersion.
 * @property {string} name - User-defined batch name.
 * @property {BatchStatus} status - Current progression state of the batch.
 * @property {number} currentImportRevision - Active revision number of spreadsheet data.
 * @property {mongoose.Types.ObjectId} [approvedSnapshotId] - Reference to the approved snapshot if frozen.
 * @property {number} totalRows - Total count of draft rows in the active revision.
 * @property {number} validRows - Count of rows passing all schema and format constraints.
 * @property {number} invalidRows - Count of rows containing validation or mapping errors.
 * @property {number} duplicateRows - Count of rows identified as duplicate records.
 * @property {number} version - Concurrency control version number.
 * @property {number} retentionHours - Retention period in hours before data cleanup.
 * @property {Date} createdAt - Creation timestamp.
 * @property {Date} updatedAt - Last modified timestamp.
 */
export interface IBatch extends Document {
  ownerId: string;
  templateId: mongoose.Types.ObjectId;
  templateVersionId: mongoose.Types.ObjectId;
  name: string;
  status: BatchStatus;
  currentImportRevision: number;
  approvedSnapshotId?: mongoose.Types.ObjectId | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  version: number;
  retentionHours: number;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BatchSchema = new Schema<IBatch>(
  {
    ownerId: { type: String, required: true, index: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'Template', required: true, index: true },
    templateVersionId: { type: Schema.Types.ObjectId, ref: 'TemplateVersion', required: true },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: [
        'draft',
        'importing',
        'review',
        'awaiting_approval',
        'approved',
        'generating',
        'ready_for_download',
        'paused',
        'cancelled',
        'failed',
        'deleting',
        'expired',
      ],
      default: 'draft',
    },
    currentImportRevision: { type: Number, default: 0 },
    approvedSnapshotId: { type: Schema.Types.ObjectId, ref: 'ApprovedSnapshot', default: null },
    totalRows: { type: Number, default: 0 },
    validRows: { type: Number, default: 0 },
    invalidRows: { type: Number, default: 0 },
    duplicateRows: { type: Number, default: 0 },
    version: { type: Number, default: 1 },
    retentionHours: { type: Number, default: 168 },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

BatchSchema.index({ ownerId: 1, createdAt: -1 });
BatchSchema.index({ templateId: 1, createdAt: -1 });
BatchSchema.index({ expiresAt: 1 });
BatchSchema.index({ ownerId: 1, status: 1 });

/**
 * @module Batch
 * @description Compiled Mongoose model for Batch documents.
 */
export const Batch = mongoose.models.Batch || mongoose.model<IBatch>('Batch', BatchSchema);
