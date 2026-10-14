import mongoose, { Schema, Document } from 'mongoose';

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
  createdAt: Date;
  updatedAt: Date;
}

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

const TemplateVersionSchema = new Schema<ITemplateVersion>(
  {
    templateId: { type: Schema.Types.ObjectId, ref: 'Template', required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    sourceObjectKey: { type: String, required: true },
    bytes: { type: Number, required: true },
    pageCount: { type: Number, required: true },
    status: { type: String, enum: ['draft', 'active', 'superseded'], default: 'draft' },
    fieldMappings: { type: [FieldMappingSchema], default: [] },
    mappingHash: { type: String, default: null },
  },
  { timestamps: true }
);

TemplateVersionSchema.index({ templateId: 1, version: 1 }, { unique: true });

export const TemplateVersion =
  mongoose.models.TemplateVersion ||
  mongoose.model<ITemplateVersion>('TemplateVersion', TemplateVersionSchema);
