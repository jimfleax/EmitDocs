import mongoose, { Schema, Document } from 'mongoose';

export interface IRowFieldError {
  field: string;
  code: string;
  message: string;
}

export interface IRowFieldWarning {
  field: string;
  code: string;
  message: string;
  referenceRowNumbers?: number[];
}

export interface IDraftRow extends Omit<Document, 'errors'> {
  batchId: mongoose.Types.ObjectId;
  importId: mongoose.Types.ObjectId;
  ownerId: string;
  revision: number;
  rowKey: string;
  sourceRowNumber: number;
  importedData: Record<string, any>;
  overrides: Record<string, any>;
  effectiveData: Record<string, any>;
  status: 'valid' | 'invalid';
  errors: IRowFieldError[];
  warnings: IRowFieldWarning[];
  isDuplicate: boolean;
  duplicateReferences: number[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const RowFieldErrorSchema = new Schema<IRowFieldError>(
  {
    field: { type: String, required: true },
    code: { type: String, required: true },
    message: { type: String, required: true },
  },
  { _id: false }
);

const RowFieldWarningSchema = new Schema<IRowFieldWarning>(
  {
    field: { type: String, required: true },
    code: { type: String, required: true },
    message: { type: String, required: true },
    referenceRowNumbers: { type: [Number], default: [] },
  },
  { _id: false }
);

const DraftRowSchema = new Schema<IDraftRow>(
  {
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    importId: { type: Schema.Types.ObjectId, ref: 'BatchImport', required: true, index: true },
    ownerId: { type: String, required: true },
    revision: { type: Number, required: true },
    rowKey: { type: String, required: true },
    sourceRowNumber: { type: Number, required: true },
    importedData: { type: Schema.Types.Mixed, default: {} },
    overrides: { type: Schema.Types.Mixed, default: {} },
    effectiveData: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['valid', 'invalid'], default: 'valid' },
    errors: { type: [RowFieldErrorSchema], default: [] },
    warnings: { type: [RowFieldWarningSchema], default: [] },
    isDuplicate: { type: Boolean, default: false },
    duplicateReferences: { type: [Number], default: [] },
    version: { type: Number, default: 1 },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

DraftRowSchema.index({ importId: 1, rowKey: 1 }, { unique: true });
DraftRowSchema.index({ batchId: 1, revision: 1, sourceRowNumber: 1 });
DraftRowSchema.index({ batchId: 1, revision: 1, status: 1 });

export const DraftRow = mongoose.models.DraftRow || mongoose.model<IDraftRow>('DraftRow', DraftRowSchema);
