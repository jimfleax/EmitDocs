/**
 * @file TemplateVersion.ts
 * @description Mongoose schema and interface for versioned PDF document templates and their field mappings.
 * @architecture Child of Template entity (`templateId`). Uses an append-only versioning strategy where
 *               new versions supersede older versions. Holds PDF storage asset keys (`sourceObjectKey`),
 *               byte/page counts, status lifecycle ('draft' | 'active' | 'superseded'), and visual field mappings.
 * @agent_note Template versions are immutable once published. Any modification to field mappings or asset
 *             requires incrementing the version number and creating a new TemplateVersion document with CAS checking.
 */

import mongoose, { Schema, Document } from 'mongoose';

/**
 * @interface IFieldMapping
 * @description Defines the layout, coordinates, typography, and masking rules for a single dynamic field on a PDF template.
 * @property {string} id - Unique identifier for this field mapping (client UUID).
 * @property {string} key - Variable key used to match spreadsheet columns (e.g. "studentName", "issueDate").
 * @property {string} [label] - Human-friendly display label for UI rendering.
 * @property {boolean} [required=true] - Whether values for this field are mandatory during batch validation.
 * @property {'text' | 'date' | 'number'} type - Data type used for format validation and spreadsheet parsing.
 * @property {number} pageIndex - Zero-indexed PDF page number where this field is placed.
 * @property {Object} rect - Coordinates and dimensions relative to PDF page boundaries.
 * @property {'left' | 'center' | 'right'} alignment - Horizontal text alignment within the bounding box.
 * @property {string} fontFamily - Font family name (e.g. 'Helvetica', or custom font identifier).
 * @property {number} fontSize - Base font size in points.
 * @property {number} minFontSize - Minimum font size permitted when shrink-to-fit is enabled.
 * @property {number} maxFontSize - Maximum font size permitted when shrink-to-fit is enabled.
 * @property {string} color - Hex color code for the rendered text (e.g. '#000000').
 * @property {'shrink-to-fit' | 'fixed' | 'multi-line'} fitMode - Text fitting behavior if string exceeds bounding width.
 * @property {'none' | 'solid-white' | 'custom-color' | 'acroform-field'} maskMode - Background redaction or masking mode beneath text.
 * @property {string} [maskColor] - Hex background color if custom-color maskMode is chosen.
 * @property {string} [format] - Date or number formatting token string.
 * @property {string} [sampleValue] - Preview sample text rendered in the visual builder.
 * @property {string} [customFontBytes] - Base64 encoded font file bytes for embedded fonts.
 * @property {string} [customFontUrl] - Remote URL for custom font loading.
 * @property {number} [lineHeight] - Multiplier or point size for multi-line line spacing.
 * @property {'none' | 'uppercase' | 'lowercase' | 'capitalize'} [textTransform] - Case transformation applied before rendering.
 */
export interface IFieldMapping {
  id: string;
  key: string;
  label?: string;
  required?: boolean;
  type: 'text' | 'date' | 'number';
  pageIndex: number;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  alignment: 'left' | 'center' | 'right';
  fontFamily: string;
  fontSize: number;
  minFontSize: number;
  maxFontSize: number;
  color: string;
  fitMode: 'shrink-to-fit' | 'fixed' | 'multi-line';
  maskMode: 'none' | 'solid-white' | 'custom-color' | 'acroform-field';
  maskColor?: string;
  format?: string;
  sampleValue?: string;
  customFontBytes?: string;
  customFontUrl?: string;
  lineHeight?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

/**
 * @interface ITemplateVersion
 * @description Mongoose document interface for a specific version revision of a template.
 * @property {mongoose.Types.ObjectId} templateId - Parent Template reference ID.
 * @property {string} ownerId - Better-Auth user ID of the owner.
 * @property {number} version - Sequential 1-based version number.
 * @property {string} sourceObjectKey - Cloudinary public ID for the underlying PDF asset.
 * @property {number} bytes - File size in bytes of the uploaded PDF asset.
 * @property {number} pageCount - Total number of pages in the PDF.
 * @property {'draft' | 'active' | 'superseded'} status - Publication lifecycle state.
 * @property {IFieldMapping[]} fieldMappings - Array of visual field coordinates and typography rules.
 * @property {string | null} mappingHash - Deterministic SHA-256 hash of fieldMappings for quick diffing.
 * @property {string} [resourceType='image'] - Cloudinary asset type ('image' or 'raw').
 * @property {Date} createdAt - Timestamp when this version was created.
 * @property {Date} updatedAt - Timestamp when this version was last updated.
 */
export interface ITemplateVersion extends Document {
  templateId: mongoose.Types.ObjectId;
  ownerId: string;
  version: number;
  sourceObjectKey: string;
  bytes: number;
  pageCount: number;
  status: 'draft' | 'active' | 'superseded';
  fieldMappings: IFieldMapping[];
  mappingHash: string | null;
  resourceType?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * @desc Sub-schema for individual dynamic field mapping definitions.
 */
const FieldMappingSchema = new Schema<IFieldMapping>(
  {
    id: { type: String, required: true },
    key: { type: String, required: true },
    label: { type: String },
    required: { type: Boolean, default: true },
    type: { type: String, enum: ['text', 'date', 'number'], default: 'text' },
    pageIndex: { type: Number, required: true },
    rect: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
      width: { type: Number, required: true },
      height: { type: Number, required: true },
    },
    alignment: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
    fontFamily: { type: String, default: 'Helvetica' },
    fontSize: { type: Number, required: true, default: 12 },
    minFontSize: { type: Number, required: true, default: 8 },
    maxFontSize: { type: Number, required: true, default: 24 },
    color: { type: String, default: '#000000' },
    fitMode: { type: String, enum: ['shrink-to-fit', 'fixed', 'multi-line'], default: 'shrink-to-fit' },
    maskMode: { type: String, enum: ['none', 'solid-white', 'custom-color', 'acroform-field'], default: 'none' },
    maskColor: { type: String },
    format: { type: String },
    sampleValue: { type: String },
    customFontBytes: { type: String },
    customFontUrl: { type: String },
    lineHeight: { type: Number },
    textTransform: {
      type: String,
      enum: ['none', 'uppercase', 'lowercase', 'capitalize'],
      default: 'none',
    },
  },
  { _id: false }
);

/**
 * @desc Mongoose schema for TemplateVersion records.
 */
const TemplateVersionSchema = new Schema<ITemplateVersion>(
  {
    templateId: { type: Schema.Types.ObjectId, ref: 'Template', required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    sourceObjectKey: { type: String, required: true },
    resourceType: { type: String, enum: ['image', 'raw'], default: 'image' },
    bytes: { type: Number, required: true },
    pageCount: { type: Number, required: true },
    status: { type: String, enum: ['draft', 'active', 'superseded'], default: 'draft' },
    fieldMappings: { type: [FieldMappingSchema], default: [] },
    mappingHash: { type: String, default: null },
  },
  { timestamps: true }
);

TemplateVersionSchema.index({ templateId: 1, version: 1 }, { unique: true });

/**
 * @module TemplateVersion
 * @desc Mongoose schema and model for TemplateVersion
 * @description Compiled Mongoose model for TemplateVersion documents.
 */
export const TemplateVersion =
  mongoose.models.TemplateVersion ||
  mongoose.model<ITemplateVersion>('TemplateVersion', TemplateVersionSchema);
