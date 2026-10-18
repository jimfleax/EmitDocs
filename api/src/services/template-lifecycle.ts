/**
 * @file template-lifecycle.ts
 * @description Core domain service orchestrating template CRUD, versioning, asset streaming, and thumbnail health.
 * @architecture Encapsulates business logic for PDF template publishing. Manages optimistic concurrency checks (CAS)
 *               when saving field mappings, computes deterministic SHA-256 mapping hashes, auto-heals authenticated Cloudinary
 *               thumbnail URLs, verifies storage asset accessibility, and coordinates version supersession.
 * @agent_note When modifying or updating field mappings, always use `publishVersion` to enforce version incrementing
 *             and concurrency protection rather than mutating `TemplateVersion` documents directly.
 */

import crypto from 'crypto';
import mongoose from 'mongoose';
import cloudinary from '../lib/cloudinary.js';
import { isTransactionUnsupportedError } from '../lib/transactions.js';
import { Template, ITemplate } from '../models/Template.js';
import { TemplateVersion, ITemplateVersion, IFieldMapping } from '../models/TemplateVersion.js';
import { Batch } from '../models/Batch.js';
import { BatchImport } from '../models/BatchImport.js';
import { DraftRow } from '../models/DraftRow.js';
import { ApprovedSnapshot } from '../models/ApprovedSnapshot.js';
import { ApprovedRecipient } from '../models/ApprovedRecipient.js';
import { ClaimPortal } from '../models/ClaimPortal.js';
import { ClaimCredentialSet } from '../models/ClaimCredentialSet.js';
import { ClaimCredential } from '../models/ClaimCredential.js';
import { ClaimSession } from '../models/ClaimSession.js';
import { ClaimRecipientState } from '../models/ClaimRecipientState.js';
import {
  cleanupUnreferencedCloudinaryAssets,
  type CloudinaryCleanupSummary,
} from './cloudinary-cleanup.js';
import { RESOURCE_LIMITS } from '../constants/limits.js';
import { calculateUserStorage } from '../controllers/storage.controller.js';

export type { CloudinaryCleanupSummary };

/* -------------------------------------------------------------------------- */
/*                               Typed Domain Errors                          */
/* -------------------------------------------------------------------------- */

/**
 * Thrown when a Template or TemplateVersion cannot be found or access is denied.
 * @class TemplateNotFoundError
 * @extends {Error}
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
 * @class VersionConflictError
 * @extends {Error}
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
 * @class TemplateValidationError
 * @extends {Error}
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
 * @class StorageAssetError
 * @extends {Error}
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

/**
 * Thrown when deleting a template that has dependent issuance batches without explicit cascade confirmation.
 * @class TemplateCascadeConfirmationRequiredError
 * @extends {Error}
 */
export class TemplateCascadeConfirmationRequiredError extends Error {
  code: string;
  dependentBatchesCount: number;
  dependentBatches: Array<{ _id: any; name: string; status: string; totalRows: number }>;
  constructor(dependentBatches: Array<{ _id: any; name: string; status: string; totalRows: number }>) {
    super(`Template has ${dependentBatches.length} dependent batch(es). Confirmation required to cascade deletion.`);
    this.name = 'TemplateCascadeConfirmationRequiredError';
    this.code = 'CASCADE_CONFIRMATION_REQUIRED';
    this.dependentBatchesCount = dependentBatches.length;
    this.dependentBatches = dependentBatches;
    Object.setPrototypeOf(this, TemplateCascadeConfirmationRequiredError.prototype);
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
  confirmCascade?: boolean;
}

export interface DeleteTemplateResult {
  success: boolean;
  message: string;
  deletedBatchesCount?: number;
  cleanup?: CloudinaryCleanupSummary;
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
 * 
 * @desc Calculates deterministic SHA-256 fingerprint for a list of visual field mappings.
 * @param {IFieldMapping[]} mappings - Field definitions to hash.
 * @returns {string} Hex-encoded SHA-256 hash.
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
 * 
 * @desc Atomically publishes a new immutable TemplateVersion with CAS verification against expectedVersion.
 * @param {PublishVersionInput} input - Parameters containing templateId, expectedVersion, and fieldMappings.
 * @returns {Promise<PublishVersionResult>} Updated parent template and created active version.
 * @throws {TemplateValidationError} If parameters or field mappings fail schema checks.
 * @throws {TemplateNotFoundError} If the template does not exist or access is unauthorized.
 * @throws {VersionConflictError} If the current version does not match expectedVersion (409 conflict).
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

  if (
    (input as any).bytes > RESOURCE_LIMITS.MAX_TEMPLATE_FILE_SIZE_BYTES ||
    latest.bytes > RESOURCE_LIMITS.MAX_TEMPLATE_FILE_SIZE_BYTES
  ) {
    throw new TemplateValidationError(
      `Template PDF exceeds maximum 15MB size limit (${latest.bytes} bytes)`,
      'TEMPLATE_SIZE_EXCEEDED'
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
 * 
 * @desc Retrieves all historical versions for an authorized template owner.
 * @param {ListVersionsInput} input - Object containing templateId and ownerId.
 * @returns {Promise<ITemplateVersion[]>} List of template versions sorted descending.
 * @throws {TemplateNotFoundError} If template is missing or access is unauthorized.
 */
export async function listVersions(input: ListVersionsInput): Promise<ITemplateVersion[]> {
  const { templateId, ownerId } = input;

  if (!templateId || !mongoose.isValidObjectId(templateId)) {
    throw new TemplateNotFoundError('Template not found or access denied');
  }

  const template = await Template.findOne({
    _id: templateId,
    ownerId,
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
 * 
 * @desc Fetches a single template version by its ObjectId.
 * @param {GetVersionInput} input - Object containing templateId, versionId, and ownerId.
 * @returns {Promise<ITemplateVersion>} The requested template version document.
 * @throws {TemplateNotFoundError} If the template or specific version is not found.
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
 * 
 * @desc Produces an HMAC-SHA1 upload signature for client-side uploads scoped to `templates/{ownerId}/`.
 * @param {string | SignUploadParamsInput} input - Owner ID or object with ownerId.
 * @returns {SignUploadParamsResult} Signature, timestamp, folder, and Cloudinary public keys.
 * @throws {TemplateValidationError} If ownerId is missing or empty.
 * @throws {StorageAssetError} If Cloudinary configuration is missing.
 */
export function signUploadParams(input: string | SignUploadParamsInput): Promise<SignUploadParamsResult> & SignUploadParamsResult {
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

  const syncResult: SignUploadParamsResult = {
    signature,
    timestamp,
    folder,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
  };

  const promise = (async () => {
    if (mongoose.connection.readyState !== 1) {
      throw new StorageAssetError(
        'Database connection is not ready to verify storage quota',
        'DATABASE_UNAVAILABLE'
      );
    }
    const storage = await calculateUserStorage(ownerId);
    if (storage && storage.totalBytes >= RESOURCE_LIMITS.MAX_USER_STORAGE_QUOTA_BYTES) {
      throw new StorageAssetError(
        'User storage quota exceeded (500MB ceiling). Delete unused templates to proceed.',
        'STORAGE_QUOTA_EXCEEDED'
      );
    }
    return syncResult;
  })();

  promise.catch(() => {});

  return Object.assign(promise, syncResult);
}

/**
 * Concurrency guard tracking per-owner execution locks to prevent racing storage registrations.
 */
const ownerRegistrationLocks = new Map<string, Promise<void>>();

async function acquireOwnerLock(ownerId: string): Promise<() => void> {
  while (ownerRegistrationLocks.has(ownerId)) {
    try {
      await ownerRegistrationLocks.get(ownerId);
    } catch {
      // Ignore errors from preceding registrations
    }
  }
  let release!: () => void;
  const lock = new Promise<void>((resolve) => {
    release = resolve;
  });
  ownerRegistrationLocks.set(ownerId, lock);
  return () => {
    if (ownerRegistrationLocks.get(ownerId) === lock) {
      ownerRegistrationLocks.delete(ownerId);
    }
    release();
  };
}

/**
 * Best-effort helper to purge rejected uploaded assets from Cloudinary.
 */
async function removeCloudinaryAsset(publicId: string, preferredType: 'image' | 'raw'): Promise<void> {
  try {
    if (cloudinary?.api?.delete_resources) {
      await cloudinary.api.delete_resources([publicId], {
        type: 'authenticated',
        resource_type: preferredType,
      });
    }
  } catch {
    try {
      if (cloudinary?.api?.delete_resources) {
        const fallbackType = preferredType === 'image' ? 'raw' : 'image';
        await cloudinary.api.delete_resources([publicId], {
          type: 'authenticated',
          resource_type: fallbackType,
        });
      }
    } catch {
      // Best-effort cleanup
    }
  }
}

/**
 * Generates a signed Cloudinary thumbnail URL for page 1 of an authenticated PDF document.
 * Safely strips any trailing extensions (e.g. .pdf) to avoid double extensions (.pdf.png).
 * 
 * @desc Creates a signed Cloudinary transformation URL for page 1 rendered as PNG thumbnail.
 * @param {string} publicId - Cloudinary asset public ID.
 * @returns {string} Signed thumbnail URL.
 * @throws {TemplateValidationError} If publicId is missing or empty.
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
 * 
 * @desc Sanitizes thumbnail URLs to ensure authenticated signing and valid Cloudinary endpoints.
 * @param {string | null | undefined} url - Current thumbnail URL.
 * @param {string} [publicId] - Underlying Cloudinary public ID for generation fallback.
 * @param {string} [resourceType] - Asset resource type ('image' or 'raw').
 * @returns {string | null} Repaired thumbnail URL, or null if unresolvable.
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
 * 
 * @desc Lazily detects broken thumbnail URLs and repairs them in-memory and asynchronously in MongoDB.
 * @param {*} inputOrTemplate - Template document or payload object.
 * @param {string} [sourceObjectKeyArg] - Explicit source asset key override.
 * @param {string} [resourceTypeArg] - Explicit resource type override.
 * @returns {string | null} Active valid thumbnail URL.
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
 * 
 * @desc Registers an authenticated Cloudinary asset into Template and TemplateVersion v1 records.
 * @param {CreateTemplateInput} input - Parameters containing ownerId, name, and cloudinaryPublicId.
 * @returns {Promise<CreateTemplateResult>} Newly created Template and initial active TemplateVersion v1.
 * @throws {TemplateValidationError} If ownerId, name, or public ID validation fails.
 * @throws {StorageAssetError} If probe of Cloudinary asset metadata fails or storage quota is exceeded.
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

  // Concurrency-safe lock per owner ensuring atomic quota checks and version reservations
  const releaseLock = await acquireOwnerLock(ownerId);

  try {
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

    if (bytes > RESOURCE_LIMITS.MAX_TEMPLATE_FILE_SIZE_BYTES) {
      const isReferenced = await TemplateVersion.exists({ sourceObjectKey: cloudinaryPublicId });
      if (!isReferenced) {
        await removeCloudinaryAsset(cloudinaryPublicId, isImageResource ? 'image' : 'raw');
      }
      throw new TemplateValidationError(
        `Template PDF exceeds maximum 15MB size limit (${bytes} bytes)`,
        'TEMPLATE_SIZE_EXCEEDED'
      );
    }

    // Enforce owner's quota against existing storage plus new asset size
    const storage = await calculateUserStorage(ownerId);
    const existingBytes = storage?.documents
      ? storage.documents
          .filter((d: any) => d.id !== cloudinaryPublicId)
          .reduce((sum: number, d: any) => sum + (d.bytes || 0), 0)
      : (storage?.totalBytes || 0);

    if (existingBytes + bytes > RESOURCE_LIMITS.MAX_USER_STORAGE_QUOTA_BYTES) {
      const isReferenced = await TemplateVersion.exists({ sourceObjectKey: cloudinaryPublicId });
      if (!isReferenced) {
        await removeCloudinaryAsset(cloudinaryPublicId, isImageResource ? 'image' : 'raw');
      }
      throw new StorageAssetError(
        `User storage quota exceeded (500MB ceiling). Existing: ${existingBytes} bytes, New asset: ${bytes} bytes. Delete unused templates to proceed.`,
        'STORAGE_QUOTA_EXCEEDED'
      );
    }

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
  } finally {
    releaseLock();
  }
}

/* -------------------------------------------------------------------------- */
/*                     Slice 3: Query, Deletion & Streaming                   */
/* -------------------------------------------------------------------------- */

/**
 * Lists active templates for an owner with populated currentVersionId.
 * Auto-heals legacy or missing thumbnail URLs via ensureThumbnailHealth.
 * Supports filtering to only templates with configured field mappings (mappedOnly: true).
 * 
 * @desc Retrieves all non-deleted templates for an owner with populated active versions.
 * @param {string | ListTemplatesInput} input - Owner ID string or options object with mappedOnly filter.
 * @returns {Promise<ITemplate[]>} List of active templates sorted by creation date descending.
 * @throws {TemplateValidationError} If ownerId is missing or empty.
 */
export async function listTemplates(input: string | ListTemplatesInput): Promise<ITemplate[]> {
  const ownerId = typeof input === 'string' ? input : input?.ownerId;
  const mappedOnly = typeof input === 'object' ? Boolean(input?.mappedOnly) : false;

  if (!ownerId || typeof ownerId !== 'string' || ownerId.trim() === '') {
    throw new TemplateValidationError('Missing or invalid ownerId', 'INVALID_OWNER_ID');
  }

  let templates = await Template.find({
    ownerId,
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
 * 
 * @desc Fetches an individual template document by ID for the authorized owner.
 * @param {GetTemplateInput} input - Object containing templateId and ownerId.
 * @returns {Promise<ITemplate>} Active template document with populated currentVersionId.
 * @throws {TemplateValidationError} If ownerId is invalid.
 * @throws {TemplateNotFoundError} If template is not found, unauthorized, or deleted.
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
  }).populate('currentVersionId');

  if (!template) {
    throw new TemplateNotFoundError('Template not found or access denied');
  }

  ensureThumbnailHealth(template);

  return template;
}

/**
 * Permanently deletes a template.
 * Validates dependencies against Batch collection; throws TemplateValidationError if any dependent batch is in 'generating' status.
 * Throws TemplateCascadeConfirmationRequiredError if dependent batches exist and confirmCascade is false or omitted.
 * When confirmCascade is true, permanently deletes all draft rows, batch imports, and batches.
 * Cascades to permanently delete all TemplateVersion documents and the root Template.
 * Runs cascade deletions in a Mongoose session transaction where supported.
 * 
 * @desc Permanently deletes a template and its versions, cascading to child batches and imports within a transaction.
 * @param {DeleteTemplateInput} input - Object containing templateId, ownerId, and confirmCascade.
 * @returns {Promise<DeleteTemplateResult>} Operation outcome and deleted batch count.
 * @throws {TemplateValidationError} If ownerId is missing or if any dependent batch is in 'generating' status.
 * @throws {TemplateNotFoundError} If template does not exist.
 * @throws {TemplateCascadeConfirmationRequiredError} If dependent batches exist and cascade is not confirmed.
 */
export async function deleteTemplate(input: DeleteTemplateInput): Promise<DeleteTemplateResult> {
  const { templateId, ownerId, confirmCascade } = input || {};

  if (!ownerId || typeof ownerId !== 'string' || ownerId.trim() === '') {
    throw new TemplateValidationError('Missing or invalid ownerId', 'INVALID_OWNER_ID');
  }

  if (!templateId || !mongoose.isValidObjectId(templateId)) {
    throw new TemplateNotFoundError('Template not found or access denied');
  }

  const template = await Template.findOne({ _id: templateId, ownerId });
  if (!template) {
    throw new TemplateNotFoundError('Template not found or access denied');
  }

  const dependentBatches = await Batch.find({ templateId: template._id, ownerId }).select('_id name status totalRows');

  const generatingBatch = dependentBatches.find((b) => b.status === 'generating');
  if (generatingBatch) {
    throw new TemplateValidationError(
      'Cannot delete template while dependent batch is generating',
      'BATCH_GENERATING'
    );
  }

  if (dependentBatches.length > 0 && !confirmCascade) {
    throw new TemplateCascadeConfirmationRequiredError(
      dependentBatches.map((b) => ({
        _id: b._id,
        name: b.name,
        status: b.status,
        totalRows: b.totalRows,
      }))
    );
  }

  let deletedBatchesCount = 0;
  const batchIds =
    dependentBatches.length > 0 && confirmCascade === true
      ? dependentBatches.map((b) => b._id)
      : [];

  const previousStatuses = new Map<string, string>();
  for (const b of dependentBatches) {
    previousStatuses.set(b._id.toString(), b.status);
  }

  const restoreClaimedBatches = async () => {
    if (batchIds.length > 0) {
      try {
        await Promise.all(
          batchIds.map((bId) => {
            const prev = previousStatuses.get(bId.toString());
            if (prev && prev !== 'deleting') {
              return Batch.updateOne(
                { _id: bId, status: 'deleting' },
                { $set: { status: prev } }
              );
            }
            return Promise.resolve();
          })
        );
      } catch {
        // Status restoration failed or unsupported
      }
    }
  };

  // Atomically claim dependent batches as 'deleting' before removal so they cannot transition to 'generating'
  if (batchIds.length > 0) {
    const claimResult = await Batch.updateMany(
      { _id: { $in: batchIds }, status: { $ne: 'generating' } },
      { $set: { status: 'deleting' } }
    );
    if (claimResult.matchedCount < batchIds.length) {
      await restoreClaimedBatches();
      throw new TemplateValidationError(
        'Cannot delete template while dependent batch is generating',
        'BATCH_GENERATING'
      );
    }
  }

  const userPortals =
    batchIds.length > 0
      ? await ClaimPortal.find({ batchId: { $in: batchIds } }).select('_id')
      : [];
  const portalIds = userPortals.map((p) => p._id);

  let session: mongoose.ClientSession | null = null;
  let transactionCommitted = false;

  try {
    session = await mongoose.startSession();
    session.startTransaction();

    if (batchIds.length > 0) {
      if (portalIds.length > 0) {
        await ClaimCredential.deleteMany({ portalId: { $in: portalIds } }, { session });
        await ClaimCredentialSet.deleteMany({ portalId: { $in: portalIds } }, { session });
        await ClaimSession.deleteMany({ portalId: { $in: portalIds } }, { session });
        await ClaimRecipientState.deleteMany({ portalId: { $in: portalIds } }, { session });
        await ClaimPortal.deleteMany({ _id: { $in: portalIds } }, { session });
      }

      await ApprovedRecipient.deleteMany({ batchId: { $in: batchIds } }, { session });
      await ApprovedSnapshot.deleteMany({ batchId: { $in: batchIds } }, { session });
      await DraftRow.deleteMany({ batchId: { $in: batchIds } }, { session });
      await BatchImport.deleteMany({ batchId: { $in: batchIds } }, { session });
      const deleteBatchesResult = await Batch.deleteMany(
        { _id: { $in: batchIds }, status: { $ne: 'generating' } },
        { session }
      );
      if (deleteBatchesResult.deletedCount < batchIds.length) {
        throw new TemplateValidationError(
          'Cannot delete template while dependent batch is generating',
          'BATCH_GENERATING'
        );
      }
    }

    await ApprovedSnapshot.deleteMany({ templateId: template._id }, { session });
    await TemplateVersion.deleteMany({ templateId: template._id }, { session });
    await Template.deleteOne({ _id: template._id }, { session });

    await session.commitTransaction();
    transactionCommitted = true;
    if (batchIds.length > 0) {
      deletedBatchesCount = batchIds.length;
    }
  } catch (error: any) {
    if (session && session.inTransaction()) {
      try {
        await session.abortTransaction();
      } catch {
        // Transaction abort failed or unsupported
      }
    }

    if (!isTransactionUnsupportedError(error)) {
      await restoreClaimedBatches();
      throw error;
    }
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch {
        // Session cleanup
      }
    }
  }

  if (!transactionCommitted) {
    try {
      if (batchIds.length > 0) {
        if (portalIds.length > 0) {
          await Promise.all([
            ClaimCredential.deleteMany({ portalId: { $in: portalIds } }),
            ClaimCredentialSet.deleteMany({ portalId: { $in: portalIds } }),
            ClaimSession.deleteMany({ portalId: { $in: portalIds } }),
            ClaimRecipientState.deleteMany({ portalId: { $in: portalIds } }),
          ]);
          await ClaimPortal.deleteMany({ _id: { $in: portalIds } });
        }

        await Promise.all([
          ApprovedRecipient.deleteMany({ batchId: { $in: batchIds } }),
          ApprovedSnapshot.deleteMany({ batchId: { $in: batchIds } }),
          DraftRow.deleteMany({ batchId: { $in: batchIds } }),
          BatchImport.deleteMany({ batchId: { $in: batchIds } }),
        ]);
        const deleteBatchesResult = await Batch.deleteMany({
          _id: { $in: batchIds },
          status: { $ne: 'generating' },
        });
        if (deleteBatchesResult.deletedCount < batchIds.length) {
          throw new TemplateValidationError(
            'Cannot delete template while dependent batch is generating',
            'BATCH_GENERATING'
          );
        }
        deletedBatchesCount = batchIds.length;
      }

      await Promise.all([
        ApprovedSnapshot.deleteMany({ templateId: template._id }),
        TemplateVersion.deleteMany({ templateId: template._id }),
      ]);
      await Template.deleteOne({ _id: template._id });
    } catch (fallbackError) {
      await restoreClaimedBatches();
      throw fallbackError;
    }
  }

  let cleanup: CloudinaryCleanupSummary | undefined;
  try {
    cleanup = await cleanupUnreferencedCloudinaryAssets({ ownerId: template.ownerId });
  } catch (cleanupErr) {
    console.error('Failed to run unreferenced Cloudinary cleanup after template delete:', cleanupErr);
  }

  return {
    success: true,
    message: 'Template deleted',
    ...(deletedBatchesCount > 0 ? { deletedBatchesCount } : {}),
    ...(cleanup ? { cleanup } : {}),
  };
}

/**
 * Streams the PDF asset for a specific template version.
 * Attempts authenticated download URL with 'image' resource type first,
 * falling back to 'raw' resource type if 'image' fails.
 * Throws StorageAssetError if both attempts fail.
 * 
 * @desc Retrieves an authorized binary stream of the template's underlying PDF asset from Cloudinary.
 * @param {StreamAssetInput} input - Object containing templateId, versionId, and ownerId.
 * @returns {Promise<StreamAssetResult>} Readable body stream, filename, and version number.
 * @throws {TemplateValidationError} If parameters fail validation.
 * @throws {TemplateNotFoundError} If template or version does not exist.
 * @throws {StorageAssetError} If download from cloud storage fails across all resource types.
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

/**
 * @module TemplateLifecycle
 * @description Domain service namespace packaging template lifecycle operations.
 */
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
  cleanupUnreferencedCloudinaryAssets,
};

