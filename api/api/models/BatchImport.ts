import mongoose, { Schema, Document } from 'mongoose';

export type ImportStatus = 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';

export interface IBatchImport extends Document {
  batchId: mongoose.Types.ObjectId;
  ownerId: string;
  revision: number;
  sourceFileName: string;
  sourceFileSize: number;
  sourceChecksum?: string;
  worksheetName?: string;
  availableWorksheets: string[];
  rawHeaders: string[];
  disambiguatedHeaders: string[];
  columnMap: Record<string, string>;
  status: ImportStatus;
  totalExpectedRows: number;
  totalExpectedChunks: number;
  receivedChunkIds: string[];
  rowCount: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const BatchImportSchema = new Schema<IBatchImport>(
  {
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    revision: { type: Number, required: true },
    sourceFileName: { type: String, required: true },
    sourceFileSize: { type: Number, required: true },
    sourceChecksum: { type: String },
    worksheetName: { type: String },
    availableWorksheets: { type: [String], default: [] },
    rawHeaders: { type: [String], default: [] },
    disambiguatedHeaders: { type: [String], default: [] },
    columnMap: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['pending', 'uploading', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    totalExpectedRows: { type: Number, default: 0 },
    totalExpectedChunks: { type: Number, default: 0 },
    receivedChunkIds: { type: [String], default: [] },
    rowCount: { type: Number, default: 0 },
    validCount: { type: Number, default: 0 },
    invalidCount: { type: Number, default: 0 },
    duplicateCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

BatchImportSchema.index({ batchId: 1, revision: 1 }, { unique: true });
BatchImportSchema.index({ ownerId: 1, createdAt: -1 });

export const BatchImport =
  mongoose.models.BatchImport || mongoose.model<IBatchImport>('BatchImport', BatchImportSchema);
