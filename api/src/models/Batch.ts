import mongoose, { Schema, Document } from 'mongoose';

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
  | 'failed';

export interface IBatch extends Document {
  ownerId: string;
  templateId: mongoose.Types.ObjectId;
  templateVersionId: mongoose.Types.ObjectId;
  name: string;
  status: BatchStatus;
  currentImportRevision: number;
  approvedSnapshotId?: mongoose.Types.ObjectId;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  version: number;
  retentionHours: number;
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
      ],
      default: 'draft',
    },
    currentImportRevision: { type: Number, default: 0 },
    approvedSnapshotId: { type: Schema.Types.ObjectId, default: null },
    totalRows: { type: Number, default: 0 },
    validRows: { type: Number, default: 0 },
    invalidRows: { type: Number, default: 0 },
    duplicateRows: { type: Number, default: 0 },
    version: { type: Number, default: 1 },
    retentionHours: { type: Number, default: 168 },
  },
  { timestamps: true }
);

BatchSchema.index({ ownerId: 1, createdAt: -1 });
BatchSchema.index({ templateId: 1, createdAt: -1 });

export const Batch = mongoose.models.Batch || mongoose.model<IBatch>('Batch', BatchSchema);
