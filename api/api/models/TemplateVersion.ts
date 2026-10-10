import mongoose, { Schema, Document } from 'mongoose';

export interface ITemplateVersion extends Document {
  templateId: mongoose.Types.ObjectId;
  ownerId: string;
  version: number;
  sourceObjectKey: string;
  bytes: number;
  pageCount: number;
  status: 'draft' | 'active' | 'superseded';
  fieldMappings: any[];
  createdAt: Date;
  updatedAt: Date;
}

const TemplateVersionSchema = new Schema(
  {
    templateId: { type: Schema.Types.ObjectId, ref: 'Template', required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    sourceObjectKey: { type: String, required: true },
    bytes: { type: Number, required: true },
    pageCount: { type: Number, required: true },
    status: { type: String, enum: ['draft', 'active', 'superseded'], default: 'draft' },
    fieldMappings: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

export const TemplateVersion = mongoose.models.TemplateVersion || mongoose.model<ITemplateVersion>('TemplateVersion', TemplateVersionSchema);

