/**
 * @file DraftRow.ts
 * @description Mongoose schema and interface for granular spreadsheet row records within a batch import.
 * @architecture Belongs to both a Batch (`batchId`) and a BatchImport revision (`importId`, `revision`).
 *               Maintains the raw incoming data (`importedData`), inline human corrections (`overrides`),
 *               and normalized derived values (`effectiveData`). Carries structured field-level errors and
 *               duplicate detection warnings.
 * @agent_note DraftRow documents use optimistic locking with a `version` field. When mutating via `patchRowOverride`,
 *             always condition the update on `version` and increment it atomically to avoid race conditions.
 */

import mongoose, { Schema, Document } from 'mongoose';

/**
 * @interface IRowFieldError
 * @description Structure representing a blocking validation error on a specific row field.
 * @property {string} field - Target template field key (e.g. 'studentName').
 * @property {string} code - Machine-readable error code (e.g. 'REQUIRED_FIELD_MISSING', 'INVALID_DATE').
 * @property {string} message - Human-friendly explanation of the validation failure.
 */
export interface IRowFieldError {
  field: string;
  code: string;
  message: string;
}

/**
 * @interface IRowFieldWarning
 * @description Structure representing a non-blocking advisory warning on a row (such as duplicate content).
 * @property {string} field - Target field or 'general'.
 * @property {string} code - Machine-readable warning code (e.g. 'DUPLICATE_ROW').
 * @property {string} message - Human-friendly warning message.
 * @property {number[]} [referenceRowNumbers] - Other spreadsheet row numbers sharing the same values.
 */
export interface IRowFieldWarning {
  field: string;
  code: string;
  message: string;
  referenceRowNumbers?: number[];
}

/**
 * @interface IDraftRow
 * @description Mongoose document interface for an individual ingested spreadsheet row.
 * @property {mongoose.Types.ObjectId} batchId - Parent Batch reference ID.
 * @property {mongoose.Types.ObjectId} importId - Parent BatchImport reference ID.
 * @property {string} ownerId - Better-Auth user ID of the owner.
 * @property {number} revision - Import revision number.
 * @property {string} rowKey - Unique identifier for the row within this import revision.
 * @property {number} sourceRowNumber - Original row number in spreadsheet (1-based, typically accounting for header).
 * @property {Record<string, any>} importedData - Raw parsed values mapped by spreadsheet column names.
 * @property {Record<string, any>} overrides - User-entered inline edits overriding imported values.
 * @property {Record<string, any>} effectiveData - Merged and type-normalized values used for document generation.
 * @property {'valid' | 'invalid'} status - Validity status based on presence of blocking errors.
 * @property {IRowFieldError[]} errors - Array of blocking validation errors.
 * @property {IRowFieldWarning[]} warnings - Array of non-blocking warnings.
 * @property {boolean} isDuplicate - Flag indicating identical field fingerprint to another row.
 * @property {number[]} duplicateReferences - Spreadsheet row numbers matching this duplicate.
 * @property {number} version - Optimistic concurrency version counter.
 * @property {Date} createdAt - Ingestion timestamp.
 * @property {Date} updatedAt - Modification timestamp.
 */
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
DraftRowSchema.index({ batchId: 1, revision: 1, isDuplicate: 1 });

/**
 * @module DraftRow
 * @description Compiled Mongoose model for DraftRow documents.
 */
export const DraftRow = mongoose.models.DraftRow || mongoose.model<IDraftRow>('DraftRow', DraftRowSchema);
