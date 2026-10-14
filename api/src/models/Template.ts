/**
 * @file Template.ts
 * @description Mongoose schema and interface for root Template entities.
 * @architecture Serves as the primary parent entity for document templates. Holds owner metadata
 *               and points to the active `currentVersionId` (in TemplateVersion).
 * @agent_note Do not mutate field mappings directly on Template; mappings belong strictly to TemplateVersion.
 */

import mongoose, { Schema, Document } from 'mongoose';

/**
 * @interface ITemplate
 * @description Represents a persisted document template owned by a user.
 * @property {string} ownerId - Unique identifier of the owning user (Better-Auth user ID).
 * @property {string} name - Human-readable template display name.
 * @property {mongoose.Types.ObjectId} [currentVersionId] - Reference to the currently active TemplateVersion document.
 * @property {string} [thumbnailUrl] - Signed Cloudinary or authenticated thumbnail preview URL for page 1.
 * @property {Date} [deletedAt] - Soft-deletion timestamp; null if active.
 * @property {Date} createdAt - Timestamp when template was initially registered.
 * @property {Date} updatedAt - Timestamp when template metadata was last modified.
 */
export interface ITemplate extends Document {
  ownerId: string;
  name: string;
  currentVersionId?: mongoose.Types.ObjectId;
  thumbnailUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TemplateSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    currentVersionId: { type: Schema.Types.ObjectId, ref: 'TemplateVersion' },
    thumbnailUrl: { type: String, default: null },
  },
  { timestamps: true }
);

/**
 * @module Template
 * @description Compiled Mongoose model for Template documents.
 */
export const Template = mongoose.models.Template || mongoose.model<ITemplate>('Template', TemplateSchema);

