/**
 * @file templates.controller.ts
 * @description HTTP controller endpoints handling PDF template management and version lifecycles.
 * @architecture Thin HTTP layer translating Hono Context requests into calls to `TemplateLifecycle`.
 *               Handles authentication validation, extracts JSON bodies via `getJsonBody`, maps typed domain
 *               errors to HTTP status codes (400, 404, 409, 502), and handles binary asset streaming.
 * @agent_note All routes mounted here require user authentication enforced by `requireAuth` middleware.
 */

import { Context } from 'hono';
import { getJsonBody } from '../lib/request.js';
import {
  TemplateLifecycle,
  computeMappingHash,
  generateThumbnailUrl,
  repairThumbnailUrl,
  TemplateNotFoundError,
  VersionConflictError,
  TemplateValidationError,
  StorageAssetError,
  TemplateCascadeConfirmationRequiredError,
} from '../services/template-lifecycle.js';

// Re-export utility functions for backwards compatibility with tests and callers
export { computeMappingHash, generateThumbnailUrl, repairThumbnailUrl };

/**
 * Generates signed parameters for direct client-to-Cloudinary authenticated uploads.
 * 
 * @desc Signs an authenticated upload request allowing frontend direct upload to Cloudinary.
 * @route POST /api/templates/sign-upload
 * @access Private
 * @returns {Promise<Response>} 200 JSON with signature, timestamp, folder, and API keys.
 */
export const signUpload = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const params = TemplateLifecycle.signUploadParams(user.id);
    return c.json({
      signature: params.signature,
      timestamp: params.timestamp,
      cloud_name: params.cloudName,
      api_key: params.apiKey,
      folder: params.folder,
    });
  } catch (err: any) {
    if (err instanceof StorageAssetError) {
      return c.json({ error: err.message }, 500);
    }
    return c.json({ error: err.message || 'Failed to sign upload' }, 500);
  }
};

/**
 * Registers an uploaded PDF asset as a new template with initial Version 1.
 * 
 * @desc Registers an authenticated template upload and initializes version 1.
 * @route POST /api/templates
 * @access Private
 * @body {Object} body
 * @body {string} body.name - Human-readable template name.
 * @body {string} body.cloudinaryPublicId - Cloudinary asset identifier.
 * @body {string} [body.thumbnailUrl] - Optional pre-generated thumbnail URL.
 * @returns {Promise<Response>} 201 Created JSON with template and initial version, or 400/404 error.
 */
export const createTemplate = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const body = await getJsonBody(c);
    const { name, cloudinaryPublicId, thumbnailUrl } = body || {};

    if (!name || !cloudinaryPublicId) {
      return c.json({ error: 'Missing required fields (name and cloudinaryPublicId)' }, 400);
    }

    const result = await TemplateLifecycle.createTemplate({
      ownerId: user.id,
      name,
      cloudinaryPublicId,
      thumbnailUrl,
    });

    return c.json({ template: result.template, version: result.version }, 201);
  } catch (error: any) {
    if (error instanceof TemplateValidationError) {
      return c.json({ error: error.message }, 400);
    }
    if (error instanceof StorageAssetError && error.code === 'STORAGE_ASSET_NOT_FOUND') {
      return c.json({ error: 'Template asset not found in storage' }, 404);
    }
    console.error('Error creating template:', error);
    return c.json({ error: 'Failed to create template', details: error.message }, 500);
  }
};

/**
 * Lists templates for the current user, optionally filtered to mapped templates.
 * 
 * @desc Lists all active templates owned by the current user with populated active versions.
 * @route GET /api/templates
 * @access Private
 * @returns {Promise<Response>} 200 JSON with `{ templates: ITemplate[] }`.
 */
export const getTemplates = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const mappedOnly = c.req.query('mappedOnly') === 'true' || c.req.query('mapped') === 'true';

  try {
    const templates = await TemplateLifecycle.listTemplates({
      ownerId: user.id,
      mappedOnly,
    });

    return c.json({ templates });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to fetch templates' }, 500);
  }
};

/**
 * Retrieves a single template by ID for the authorized owner.
 * 
 * @desc Fetches a specific template by ID with its active currentVersionId populated.
 * @route GET /api/templates/:id
 * @access Private
 * @returns {Promise<Response>} 200 JSON with `{ template: ITemplate }`, or 404 if not found.
 */
export const getTemplateById = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');

  try {
    const template = await TemplateLifecycle.getTemplate({
      templateId: id,
      ownerId: user.id,
    });

    return c.json({ template });
  } catch (error: any) {
    if (error instanceof TemplateNotFoundError) {
      return c.json({ error: 'Template not found' }, 404);
    }
    return c.json({ error: error.message || 'Failed to fetch template' }, 500);
  }
};

/**
 * Permanently deletes a template.
 * Checks for cascade confirmation if dependent batches exist.
 * Returns HTTP 409 CASCADE_CONFIRMATION_REQUIRED if confirmCascade is omitted.
 * Performs post-deletion mark-and-sweep cleanup of unreferenced Cloudinary assets for the owner.
 * 
 * @desc Permanently deletes a template and its versions, optionally cascading to batches and purging unreferenced assets.
 * @route DELETE /api/templates/:id
 * @access Private
 * @returns {Promise<Response>} 200 JSON with `{ success: true, message: 'Template deleted', cleanup?: CloudinaryCleanupSummary }`, or 409 if batches exist, or 404 if not found.
 */
export const deleteTemplate = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');

  let confirmCascade = c.req.query('confirmCascade') === 'true' || c.req.query('cascade') === 'true';
  const contentType = c.req.header('content-type') || '';
  if (!confirmCascade && contentType.includes('application/json')) {
    try {
      const body = await getJsonBody(c);
      if (body && (body.confirmCascade === true || body.cascade === true)) {
        confirmCascade = true;
      }
    } catch {
      // Ignored
    }
  }

  try {
    const result = await TemplateLifecycle.deleteTemplate({
      templateId: id,
      ownerId: user.id,
      confirmCascade,
    });

    return c.json(result);
  } catch (error: any) {
    if (error instanceof TemplateValidationError) {
      return c.json({ error: error.message }, 400);
    }
    if (error instanceof TemplateCascadeConfirmationRequiredError) {
      return c.json(
        {
          error: error.code,
          message: error.message,
          requiresConfirmation: true,
          dependentBatchesCount: error.dependentBatchesCount,
          dependentBatches: error.dependentBatches,
        },
        409
      );
    }
    if (error instanceof TemplateNotFoundError) {
      return c.json({ error: 'Template not found' }, 404);
    }
    return c.json({ error: error.message || 'Failed to delete template' }, 500);
  }
};

/**
 * Lists all versions for a template in descending order.
 * 
 * @desc Retrieves all historical and active versions for a given template.
 * @route GET /api/templates/:id/versions
 * @access Private
 * @returns {Promise<Response>} 200 JSON with `{ versions: ITemplateVersion[] }`, or 404/500 on failure.
 */
export const getTemplateVersions = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');

  try {
    const versions = await TemplateLifecycle.listVersions({
      templateId: id,
      ownerId: user.id,
    });

    return c.json({ versions });
  } catch (error: any) {
    if (error instanceof TemplateNotFoundError) {
      return c.json({ error: 'Template not found' }, 404);
    }
    return c.json({ error: error.message || 'Failed to fetch template versions' }, 500);
  }
};

/**
 * Retrieves a specific version of a template.
 * 
 * @desc Fetches an individual template version by version ID.
 * @route GET /api/templates/:id/versions/:versionId
 * @access Private
 * @returns {Promise<Response>} 200 JSON with `{ version: ITemplateVersion }`, or 404 if not found.
 */
export const getTemplateVersionById = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const versionId = c.req.param('versionId');

  try {
    const version = await TemplateLifecycle.getVersion({
      templateId: id,
      versionId,
      ownerId: user.id,
    });

    return c.json({ version });
  } catch (error: any) {
    if (error instanceof TemplateNotFoundError) {
      if (error.message.includes('version')) {
        return c.json({ error: 'Template version not found' }, 404);
      }
      return c.json({ error: 'Template not found' }, 404);
    }
    return c.json({ error: error.message || 'Failed to fetch template version' }, 500);
  }
};

/**
 * Streams the template version PDF asset with dual format fallback.
 * 
 * @desc Proxies a streaming binary download of the template's PDF document.
 * @route GET /api/templates/:id/versions/:versionId/file
 * @access Private
 * @returns {Promise<Response>} 200 Binary PDF stream with Content-Disposition inline header, 404 if missing, or 502 on storage failure.
 */
export const streamTemplateVersionPdf = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const versionId = c.req.param('versionId');

  try {
    const asset = await TemplateLifecycle.streamAsset({
      templateId: id,
      versionId,
      ownerId: user.id,
    });

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `inline; filename="${asset.filename}"`);
    c.header('Cache-Control', 'private, max-age=3600');

    return c.body(asset.body);
  } catch (error: any) {
    if (error instanceof TemplateNotFoundError) {
      if (error.message.includes('version')) {
        return c.json({ error: 'Template version not found' }, 404);
      }
      return c.json({ error: 'Template not found' }, 404);
    }
    if (error instanceof StorageAssetError) {
      return c.json({ error: 'Failed to fetch PDF asset from storage' }, 502);
    }
    return c.json({ error: error.message || 'Failed to stream template asset' }, 500);
  }
};

/**
 * Publishes a new template version with CAS concurrency checking.
 * 
 * @desc Publishes an updated version of a template with new visual field mappings.
 * @route POST /api/templates/:id/versions
 * @access Private
 * @body {Object} body
 * @body {number} body.expectedVersion - Current version number expected by caller for CAS check.
 * @body {IFieldMapping[]} body.fieldMappings - Updated field mappings array.
 * @returns {Promise<Response>} 201 Created JSON with template and new version, 400 validation error, or 409 conflict.
 */
export const createTemplateVersion = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');

  try {
    const body = await getJsonBody(c);
    const { expectedVersion, fieldMappings } = body || {};

    const result = await TemplateLifecycle.publishVersion({
      templateId: id,
      ownerId: user.id,
      expectedVersion,
      fieldMappings,
    });

    return c.json({ template: result.template, version: result.version }, 201);
  } catch (error: any) {
    if (error instanceof TemplateValidationError) {
      return c.json({ error: error.message }, 400);
    }
    if (error instanceof VersionConflictError) {
      return c.json(
        {
          error: 'VERSION_CONFLICT',
          message: error.message,
          currentVersion: error.currentVersion,
        },
        409
      );
    }
    if (error instanceof TemplateNotFoundError) {
      if (error.message.includes('version')) {
        return c.json({ error: 'No existing template version found' }, 404);
      }
      return c.json({ error: 'Template not found' }, 404);
    }
    console.error('Error creating template version:', error);
    return c.json({ error: 'Failed to create template version', details: error.message }, 500);
  }
};
