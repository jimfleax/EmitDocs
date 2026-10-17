/**
 * @file BatchImport.ts
 * @description Mongoose schema and interface for spreadsheet upload revisions within a Batch.
 * @architecture Belongs to a Batch (`batchId`). Represents an intake revision (e.g. revision 1 for initial CSV,
 *               revision 2 for updated re-import). Tracks received chunk IDs (`receivedChunkIds`) for idempotency,
 *               column header mappings, date formatting hints, and aggregated intake metrics.
 * @agent_note Imports use compound unique indexing on `{ batchId: 1, revision: 1 }`. When chunking rows,
 *             chunk completion is atomically tracked in `receivedChunkIds`.
 */

import mongoose, { Schema, Document } from 'mongoose';

/**
 * @typedef {('pending' | 'uploading' | 'processing' | 'completed' | 'failed')} ImportStatus
 * @description Ingestion status of a spreadsheet import revision.
 */
export type ImportStatus = 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';

/**
 * @interface IBatchImport
 * @description Mongoose document interface for a spreadsheet import session.
 * @property {mongoose.Types.ObjectId} batchId - Parent Batch reference ID.
 * @property {string} ownerId - Better-Auth user ID of the owner.
 * @property {number} revision - Monotonically increasing revision number for this batch.
 * @property {string} sourceFileName - Original file name uploaded by user.
 * @property {number} sourceFileSize - Byte size of the source file.
 * @property {string} [sourceChecksum] - Optional SHA-256 or MD5 checksum of uploaded file.
 * @property {string} [worksheetName] - Selected sheet name in multi-sheet Excel workbooks.
 * @property {string[]} availableWorksheets - List of all sheet names discovered in workbook.
 * @property {string[]} rawHeaders - Original column header names from the spreadsheet.
 * @property {string[]} disambiguatedHeaders - Sanitized headers with deduplicated column names.
 * @property {Record<string, string>} columnMap - Dictionary mapping template field keys to spreadsheet columns.
 * @property {Record<string, string>} [dateFormatHints] - Per-column explicit date format hints (e.g. 'DD/MM/YYYY').
 * @property {ImportStatus} status - Upload and processing state.
 * @property {number} totalExpectedRows - Declared total number of rows from client parsing.
 * @property {number} totalExpectedChunks - Declared total number of chunks expected.
 * @property {string[]} receivedChunkIds - List of chunk IDs already persisted (for idempotency).
 * @property {number} rowCount - Count of persisted draft rows for this revision.
 * @property {number} validCount - Count of valid rows in this revision.
 * @property {number} invalidCount - Count of invalid rows in this revision.
 * @property {number} duplicateCount - Count of detected duplicate rows in this revision.
 * @property {Date} createdAt - Ingestion start timestamp.
 * @property {Date} updatedAt - Last modified timestamp.
 */
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
  dateFormatHints?: Record<string, string>;
  status: ImportStatus;
  totalExpectedRows: number;
  totalExpectedChunks: number;
  receivedChunkIds: string[];
  rowCount: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  ingestLockToken?: string | null;
  ingestLockExpiresAt?: Date | null;
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
    dateFormatHints: { type: Schema.Types.Mixed, default: {} },
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
    ingestLockToken: { type: String, default: null },
    ingestLockExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

BatchImportSchema.index({ batchId: 1, revision: 1 }, { unique: true });
BatchImportSchema.index({ ownerId: 1, createdAt: -1 });

/**
 * @module BatchImport
 * @description Compiled Mongoose model for BatchImport documents.
 */
export const BatchImport =
  mongoose.models.BatchImport || mongoose.model<IBatchImport>('BatchImport', BatchImportSchema);
