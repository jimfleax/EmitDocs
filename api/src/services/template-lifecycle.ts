import crypto from 'crypto';
import mongoose from 'mongoose';
import cloudinary from '../lib/cloudinary.js';
import { Template, ITemplate } from '../models/Template.js';
import { TemplateVersion, ITemplateVersion, IFieldMapping } from '../models/TemplateVersion.js';

/* -------------------------------------------------------------------------- */
/*                               Typed Domain Errors                          */
/* -------------------------------------------------------------------------- */

/**
 * Thrown when a Template or TemplateVersion cannot be found or access is denied.
 */
export class TemplateNotFoundError extends Error {
  code: string;
  constructor(message = 'Template or version not found') {
    super(message);
    this.name = 'TemplateNotFoundError';
    this.code = 'TEMPLATE_NOT_FOUND';
    Object.setPrototypeOf(this, TemplateNotFoundError.prototype);
  }
}

/**
 * Thrown when an optimistic concurrency CAS check fails on template version bump.
 */
export class VersionConflictError extends Error {
  code: string;
  currentVersion?: number;
  constructor(message: string, currentVersion?: number) {
    super(message);
    this.name = 'VersionConflictError';
    this.code = 'VERSION_CONFLICT';
    this.currentVersion = currentVersion;
    Object.setPrototypeOf(this, VersionConflictError.prototype);
  }
}

/**
 * Thrown when template parameters or field mappings fail schema validation.
 */
export class TemplateValidationError extends Error {
  code: string;
  constructor(message: string, code = 'TEMPLATE_VALIDATION_ERROR') {
    super(message);
    this.name = 'TemplateValidationError';
    this.code = code;
    Object.setPrototypeOf(this, TemplateValidationError.prototype);
  }
}

/**
 * Thrown when storage asset fetching, signature, or thumbnail processing fails.
 */
export class StorageAssetError extends Error {
  code: string;
  constructor(message: string, code = 'STORAGE_ASSET_ERROR') {
    super(message);
    this.name = 'StorageAssetError';
    this.code = code;
    Object.setPrototypeOf(this, StorageAssetError.prototype);
  }
}

/* -------------------------------------------------------------------------- */
/*                             Interfaces & Payloads                          */
/* -------------------------------------------------------------------------- */

export interface PublishVersionInput {
  templateId?: string | mongoose.Types.ObjectId;
  ownerId: string;
  expectedVersion: number;
  fieldMappings: IFieldMapping[];
}

export interface PublishVersionResult {
  template: ITemplate;
  version: ITemplateVersion;
}

export interface ListVersionsInput {
  templateId?: string | mongoose.Types.ObjectId;
  ownerId: string;
}

export interface GetVersionInput {
  templateId?: string | mongoose.Types.ObjectId;
  versionId?: string | mongoose.Types.ObjectId;
  ownerId: string;
}

export interface SignUploadParamsInput {
  ownerId: string;
}

export interface SignUploadParamsResult {
  signature: string;
  timestamp: number;
  folder: string;
  cloudName: string;
  apiKey: string;
}

export interface CreateTemplateInput {
  ownerId: string;
  name: string;
  cloudinaryPublicId: string;
  thumbnailUrl?: string | null;
}

export interface CreateTemplateResult {
  template: ITemplate;
  version: ITemplateVersion;
}

export interface ListTemplatesInput {
  ownerId: string;
  mappedOnly?: boolean;
}

export interface GetTemplateInput {
  templateId?: string | mongoose.Types.ObjectId;
  ownerId: string;
}

export interface DeleteTemplateInput {
  templateId?: string | mongoose.Types.ObjectId;
  ownerId: string;
}

export interface DeleteTemplateResult {
  success: boolean;
  message: string;
}

export interface StreamAssetInput {
  templateId?: string | mongoose.Types.ObjectId;
  versionId?: string | mongoose.Types.ObjectId;
  ownerId: string;
}

export interface StreamAssetResult {
  body: any;
  filename: string;
  versionNumber: number;
}

/* -------------------------------------------------------------------------- */
/*                        TemplateLifecycle Implementation                    */
/* -------------------------------------------------------------------------- */

/**
 * Computes a canonical, deterministic SHA-256 hash of field mappings.
 * Mappings are sorted by pageIndex -> rect.y -> rect.x -> id before digesting.
 */
export function computeMappingHash(mappings: IFieldMapping[]): string {
  if (!mappings || mappings.length === 0) {
    return crypto.createHash('sha256').update(JSON.stringify([])).digest('hex');
  }
  const sorted = [...mappings].sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
    if (a.rect.y !== b.rect.y) return a.rect.y - b.rect.y;
    if (a.rect.x !== b.rect.x) return a.rect.x - b.rect.x;
    return a.id.localeCompare(b.id);
  });
  return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

/**
 * Publishes a new template version with optimistic CAS concurrency protection.
 * Marks the previous active version as 'superseded' and updates template.currentVersionId.
 */
export async function publishVersion(input: PublishVersionInput): Promise<PublishVersionResult> {
  const { templateId, ownerId, expectedVersion, fieldMappings } = input;

  if (typeof expectedVersion !== 'number' || !Number.isInteger(expectedVersion)) {
    throw new TemplateValidationError('Missing or invalid expectedVersion (must be integer)', 'INVALID_EXPECTED_VERSION');
  }

  if (!Array.isArray(fieldMappings)) {
    throw new TemplateValidationError('fieldMappings must be an array', 'INVALID_FIELD_MAPPINGS');
  }

  if (!templateId || !mongoose.isValidObjectId(templateId)) {
    throw new TemplateNotFoundError('Template not found or access denied');
  }

  const template = await Template.findOne({
    _id: templateId,
    ownerId,
    deletedAt: null,
  });

  if (!template) {
    throw new TemplateNotFoundError('Template not found or access denied');
  }

  const latest = await TemplateVersion.findOne({
    templateId: template._id,
    ownerId,
  }).sort({ version: -1 });

  if (!latest) {
    throw new TemplateNotFoundError('No existing template version found');
  }

  // Optimistic CAS verification
  if (latest.version !== expectedVersion) {
    throw new VersionConflictError(
      `Version modified concurrently. Expected version ${expectedVersion}, but latest is ${latest.version}`,
      latest.version
    );
  }

  const mappingHash = computeMappingHash(fieldMappings);

  // Create and persist new version FIRST to ensure validation and uniqueness succeed
  const newVersion = new TemplateVersion({
    templateId: template._id,
    ownerId,
    version: latest.version + 1,
    sourceObjectKey: latest.sourceObjectKey,
    resourceType: latest.resourceType,
    bytes: latest.bytes,
    pageCount: latest.pageCount,
    status: 'active',
    fieldMappings,
    mappingHash,
  });

  try {
    await newVersion.save();
  } catch (err: any) {
    if (err.code === 11000) {
      throw new VersionConflictError(
        `Version modified concurrently. Expected version ${expectedVersion}, but latest is ${latest.version}`,
        latest.version
      );
    }
    throw err;
  }

  // Mark previous version superseded only after new version is committed
  latest.status = 'superseded';
  await latest.save();

  // Update current version pointer on template
  template.currentVersionId = newVersion._id as any;
  await template.save();

  return {
    template,
    version: newVersion,
  };
}

/**
 * Lists all versions for a template in descending order by version number.
 */
export async function listVersions(input: ListVersionsInput): Promise<ITemplateVersion[]> {
  const { templateId, ownerId } = input;

  if (!templateId || !mongoose.isValidObjectId(templateId)) {
    throw new TemplateNotFoundError('Template not found or access denied');
  }

  const template = await Template.findOne({
    _id: templateId,
    ownerId,
    deletedAt: null,
  });

  if (!template) {
    throw new TemplateNotFoundError('Template not found or access denied');
  }

  return TemplateVersion.find({
    templateId: template._id,
    ownerId,
  }).sort({ version: -1 });
}

/**
 * Retrieves a specific template version by ID for the authorized owner.
 */
export async function getVersion(input: GetVersionInput): Promise<ITemplateVersion> {
  const { templateId, versionId, ownerId } = input || {};

  if (!templateId || !mongoose.isValidObjectId(templateId)) {
    throw new TemplateNotFoundError('Template not found or access denied');
  }

  if (!versionId || !mongoose.isValidObjectId(versionId)) {
    throw new TemplateNotFoundError('Template version not found or access denied');
  }

  const template = await Template.findOne({
    _id: templateId,
    ownerId,
    deletedAt: null,
  });

  if (!template) {
    throw new TemplateNotFoundError('Template not found or access denied');
  }

  const version = await TemplateVersion.findOne({
    _id: versionId,
    templateId: template._id,
    ownerId,
  });

  if (!version) {
    throw new TemplateNotFoundError('Template version not found or access denied');
  }

  return version;
}

/* -------------------------------------------------------------------------- */
/*                           Slice 2: Asset & Thumbnail                      */
/* -------------------------------------------------------------------------- */

/**
 * Generates Cloudinary authenticated upload parameters for direct client uploads.
 */
export function signUploadParams(input: string | SignUploadParamsInput): SignUploadParamsResult {
  const ownerId = typeof input === 'string' ? input : input?.ownerId;
  if (!ownerId || typeof ownerId !== 'string' || ownerId.trim() === '') {
    throw new TemplateValidationError('Missing or invalid ownerId', 'INVALID_OWNER_ID');
  }

  const timestamp = Math.round(new Date().getTime() / 1000);
  const folder = `templates/${ownerId}`;

  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiSecret) {
    throw new StorageAssetError('CLOUDINARY_API_SECRET is not configured', 'STORAGE_CONFIG_ERROR');
  }

  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder,
      type: 'authenticated',
    },
    apiSecret
  );

  return {
    signature,
    timestamp,
    folder,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
  };
}

/**
 * Generates a signed Cloudinary thumbnail URL for page 1 of an authenticated PDF document.
 * Safely strips any trailing extensions (e.g. .pdf) to avoid double extensions (.pdf.png).
 */
export function generateThumbnailUrl(publicId: string): string {
  if (!publicId || typeof publicId !== 'string' || publicId.trim() === '') {
    throw new TemplateValidationError('Missing or invalid publicId', 'INVALID_PUBLIC_ID');
  }
  const cleanId = publicId.replace(/\.[^/.]+$/, '');
  return cloudinary.url(cleanId, {
    type: 'authenticated',
    resource_type: 'image',
    format: 'png',
    page: 1,
    width: 600,
    height: 450,
    crop: 'fill',
    sign_url: true,
  });
}

/**
 * Repairs legacy or missing thumbnail URLs.
 * Converts legacy /image/upload/ URLs to /image/authenticated/.
 * Generates fresh authenticated thumbnail URLs if the URL is missing and publicId is present.
 */
export function repairThumbnailUrl(
  url: string | null | undefined,
  publicId?: string,
  resourceType?: string
): string | null {
  if (url && url.includes('/image/upload/') && url.includes('/templates/')) {
    if (publicId && resourceType !== 'raw') {
      return generateThumbnailUrl(publicId);
    }
    return url;
  }
  if (url && url.includes('/image/authenticated/')) {
    return url;
  }
  if (!url && publicId) {
    if (resourceType === 'raw') return null;
    if (!resourceType || resourceType === 'image') return generateThumbnailUrl(publicId);
    return null;
  }
  return url || null;
}

/**
 * Ensures thumbnail health for a template entity:
 * Repairs in-memory immediately for caller latency, and schedules a background DB update if changed.
 */
export function ensureThumbnailHealth(
  inputOrTemplate: any,
  sourceObjectKeyArg?: string,
  resourceTypeArg?: string
): string | null {
  if (!inputOrTemplate) return null;

  let template = inputOrTemplate;
  let sourceKey = sourceObjectKeyArg;
  let resType = resourceTypeArg || template.resourceType;

  if (inputOrTemplate.template && !inputOrTemplate._id && !inputOrTemplate.name) {
    template = inputOrTemplate.template;
    sourceKey = sourceKey || inputOrTemplate.sourceObjectKey;
    resType = resType || inputOrTemplate.resourceType;
  }

  const originalUrl = template.thumbnailUrl;
  if (!sourceKey && template.currentVersionId) {
    if (typeof template.currentVersionId === 'object' && 'sourceObjectKey' in template.currentVersionId) {
      sourceKey = template.currentVersionId.sourceObjectKey;
      if (!resType && 'resourceType' in template.currentVersionId) {
        resType = template.currentVersionId.resourceType;
      }
    }
  }

  const repaired = repairThumbnailUrl(originalUrl, sourceKey, resType);
  if (repaired && repaired !== originalUrl) {
    template.thumbnailUrl = repaired;
    if (template._id) {
      Template.updateOne({ _id: template._id }, { $set: { thumbnailUrl: repaired } })
        .exec()
        .catch((err) => {
          console.error('Failed to update repaired thumbnail URL in background:', err);
        });
    }
  }

  return template.thumbnailUrl || null;
}

/**
 * Creates a new template document and its initial version (v1) from an uploaded asset key.
 */
export async function createTemplate(input: CreateTemplateInput): Promise<CreateTemplateResult> {
  const { ownerId, name, cloudinaryPublicId, thumbnailUrl } = input || {};

  if (!ownerId || typeof ownerId !== 'string' || ownerId.trim() === '') {
    throw new TemplateValidationError('Missing or invalid ownerId', 'MISSING_OWNER_ID');
  }

  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new TemplateValidationError('Missing or invalid name', 'MISSING_NAME');
  }

  if (!cloudinaryPublicId || typeof cloudinaryPublicId !== 'string' || cloudinaryPublicId.trim() === '') {
    throw new TemplateValidationError('Missing or invalid cloudinaryPublicId', 'MISSING_CLOUDINARY_PUBLIC_ID');
  }

  const expectedFolderPrefix = `templates/${ownerId}/`;
  if (!cloudinaryPublicId.startsWith(expectedFolderPrefix) || cloudinaryPublicId.trim() === expectedFolderPrefix) {
    throw new TemplateValidationError(
      `cloudinaryPublicId must belong to owner folder '${expectedFolderPrefix}'`,
      'INVALID_CLOUDINARY_PUBLIC_ID'
    );
  }

  if (thumbnailUrl) {
    const isCloudinary =
      thumbnailUrl.includes('res.cloudinary.com') ||
      (process.env.CLOUDINARY_CLOUD_NAME && thumbnailUrl.includes(process.env.CLOUDINARY_CLOUD_NAME));
    const isOwnerScoped = thumbnailUrl.includes(`/templates/${ownerId}/`);
    if (!isCloudinary || !isOwnerScoped) {
      throw new TemplateValidationError(
        'thumbnailUrl must be a Cloudinary URL scoped to the owner',
        'INVALID_THUMBNAIL_URL'
      );
    }
  }

  let asset: any;
  let isImageResource = true;
  try {
    asset = await cloudinary.api.resource(cloudinaryPublicId, {
      type: 'authenticated',
      resource_type: 'image',
    });
  } catch (imgErr: any) {
    try {
      isImageResource = false;
      asset = await cloudinary.api.resource(cloudinaryPublicId, {
        type: 'authenticated',
        resource_type: 'raw',
      });
    } catch (rawErr: any) {
      throw new StorageAssetError(
        `Failed to probe Cloudinary asset '${cloudinaryPublicId}': ${rawErr?.message || imgErr?.message || 'Resource not found'}`,
        'STORAGE_ASSET_NOT_FOUND'
      );
    }
  }

  const bytes = asset?.bytes || 0;
  const pageCount = asset?.pages || 1;

  let finalThumbnailUrl = thumbnailUrl || null;
  if (!finalThumbnailUrl && isImageResource) {
    finalThumbnailUrl = generateThumbnailUrl(cloudinaryPublicId);
  }

  const template = new Template({
    ownerId,
    name: name.trim(),
    thumbnailUrl: finalThumbnailUrl,
  });
  await template.save();

  const detectedResourceType = asset?.resource_type || (isImageResource ? 'image' : 'raw');

  const version = new TemplateVersion({
    templateId: template._id,
    ownerId,
    version: 1,
    sourceObjectKey: cloudinaryPublicId,
    resourceType: detectedResourceType,
    bytes,
    pageCount,
    status: 'active',
    fieldMappings: [],
    mappingHash: computeMappingHash([]),
  });
  await version.save();

  template.currentVersionId = version._id as any;
  await template.save();

  return {
    template,
    version,
  };
}

/* -------------------------------------------------------------------------- */
/*                     Slice 3: Query, Deletion & Streaming                   */
/* -------------------------------------------------------------------------- */

/**
 * Lists active templates for an owner with populated currentVersionId.
 * Auto-heals legacy or missing thumbnail URLs via ensureThumbnailHealth.
 * Supports filtering to only templates with configured field mappings (mappedOnly: true).
 */
export async function listTemplates(input: string | ListTemplatesInput): Promise<ITemplate[]> {
  const ownerId = typeof input === 'string' ? input : input?.ownerId;
  const mappedOnly = typeof input === 'object' ? Boolean(input?.mappedOnly) : false;

  if (!ownerId || typeof ownerId !== 'string' || ownerId.trim() === '') {
    throw new TemplateValidationError('Missing or invalid ownerId', 'INVALID_OWNER_ID');
  }

  let templates = await Template.find({
    ownerId,
    deletedAt: null,
  })
    .populate('currentVersionId')
    .sort({ createdAt: -1 });

  // Auto-heal thumbnails for all listed templates
  for (const template of templates) {
    ensureThumbnailHealth(template);
  }

  if (mappedOnly) {
    templates = templates.filter((t) => {
      const ver = t.currentVersionId as any;
      return Boolean(ver && Array.isArray(ver.fieldMappings) && ver.fieldMappings.length > 0);
    });
  }

  return templates;
}

/**
 * Retrieves a single active template by ID with populated currentVersionId.
 * Auto-heals legacy thumbnail URLs via ensureThumbnailHealth.
 * Throws TemplateNotFoundError if missing, access denied, or soft-deleted.
 */
export async function getTemplate(input: GetTemplateInput): Promise<ITemplate> {
  const { templateId, ownerId } = input || {};

  if (!ownerId || typeof ownerId !== 'string' || ownerId.trim() === '') {
    throw new TemplateValidationError('Missing or invalid ownerId', 'INVALID_OWNER_ID');
  }

  if (!templateId || !mongoose.isValidObjectId(templateId)) {
    throw new TemplateNotFoundError('Template not found or access denied');
  }

  const template = await Template.findOne({
    _id: templateId,
    ownerId,
    deletedAt: null,
  }).populate('currentVersionId');

  if (!template) {
    throw new TemplateNotFoundError('Template not found or access denied');
  }

  ensureThumbnailHealth(template);

  return template;
}

/**
 * Soft-deletes a template by setting deletedAt timestamp.
 * Throws TemplateNotFoundError if not found or already deleted.
 */
export async function deleteTemplate(input: DeleteTemplateInput): Promise<DeleteTemplateResult> {
  const { templateId, ownerId } = input || {};

  if (!ownerId || typeof ownerId !== 'string' || ownerId.trim() === '') {
    throw new TemplateValidationError('Missing or invalid ownerId', 'INVALID_OWNER_ID');
  }

  if (!templateId || !mongoose.isValidObjectId(templateId)) {
    throw new TemplateNotFoundError('Template not found or already deleted');
  }

  const template = await Template.findOneAndUpdate(
    { _id: templateId, ownerId, deletedAt: null },
    { deletedAt: new Date() },
    { new: true }
  );

  if (!template) {
    throw new TemplateNotFoundError('Template not found or already deleted');
  }

  return {
    success: true,
    message: 'Template deleted',
  };
}

/**
 * Streams the PDF asset for a specific template version.
 * Attempts authenticated download URL with 'image' resource type first,
 * falling back to 'raw' resource type if 'image' fails.
 * Throws StorageAssetError if both attempts fail.
 */
export async function streamAsset(input: StreamAssetInput): Promise<StreamAssetResult> {
  const { templateId, versionId, ownerId } = input || {};

  if (!ownerId || typeof ownerId !== 'string' || ownerId.trim() === '') {
    throw new TemplateValidationError('Missing or invalid ownerId', 'INVALID_OWNER_ID');
  }

  if (!templateId || !mongoose.isValidObjectId(templateId)) {
    throw new TemplateNotFoundError('Template not found or access denied');
  }

  if (!versionId || !mongoose.isValidObjectId(versionId)) {
    throw new TemplateNotFoundError('Template version not found or access denied');
  }

  const template = await Template.findOne({
    _id: templateId,
    ownerId,
    deletedAt: null,
  });

  if (!template) {
    throw new TemplateNotFoundError('Template not found or access denied');
  }

  const version = await TemplateVersion.findOne({
    _id: versionId,
    templateId: template._id,
    ownerId,
  });

  if (!version) {
    throw new TemplateNotFoundError('Template version not found or access denied');
  }

  let response: any = null;

  if (version.resourceType === 'raw') {
    const downloadUrl = cloudinary.url(version.sourceObjectKey, {
      resource_type: 'raw',
      type: 'authenticated',
      sign_url: true,
    });
    try {
      const res = await fetch(downloadUrl);
      if (res && res.ok && res.body) {
        response = res;
      }
    } catch {
      // Failed
    }
  } else {
    // Attempt 1: Authenticated URL with 'image' resource type
    let downloadUrl = cloudinary.url(version.sourceObjectKey, {
      resource_type: 'image',
      format: 'pdf',
      type: 'authenticated',
      sign_url: true,
    });

    try {
      const res = await fetch(downloadUrl);
      if (res && res.ok && res.body) {
        response = res;
      }
    } catch {
      // Fall back to raw
    }

    // Attempt 2: Fallback with 'raw' resource type
    if (!response) {
      downloadUrl = cloudinary.url(version.sourceObjectKey, {
        resource_type: 'raw',
        type: 'authenticated',
        sign_url: true,
      });
      try {
        const res = await fetch(downloadUrl);
        if (res && res.ok && res.body) {
          response = res;
        }
      } catch {
        // Both attempts failed
      }
    }
  }

  if (!response || !response.body) {
    throw new StorageAssetError(
      `Failed to fetch PDF asset for version ${version.version} from storage`,
      'STORAGE_ASSET_FETCH_FAILED'
    );
  }

  return {
    body: response.body,
    filename: `template-v${version.version}.pdf`,
    versionNumber: version.version,
  };
}

export const TemplateLifecycle = {
  computeMappingHash,
  publishVersion,
  listVersions,
  getVersion,
  signUploadParams,
  generateThumbnailUrl,
  repairThumbnailUrl,
  ensureThumbnailHealth,
  createTemplate,
  listTemplates,
  getTemplate,
  deleteTemplate,
  streamAsset,
};
