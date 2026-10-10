import mongoose, { Schema, Document } from 'mongoose';

export interface ITemplate extends Document {
  ownerId: string;
  name: string;
  currentVersionId?: mongoose.Types.ObjectId;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TemplateSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    currentVersionId: { type: Schema.Types.ObjectId, ref: 'TemplateVersion' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Template = mongoose.models.Template || mongoose.model<ITemplate>('Template', TemplateSchema);

