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
} from '../services/template-lifecycle.js';

// Re-export utility functions for backwards compatibility with tests and callers
export { computeMappingHash, generateThumbnailUrl, repairThumbnailUrl };

/**
 * Generates signed parameters for direct client-to-Cloudinary authenticated uploads.
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
    console.error('Error creating template:', error);
    return c.json({ error: 'Failed to create template', details: error.message }, 500);
  }
};

/**
 * Lists templates for the current user, optionally filtered to mapped templates.
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
 * Soft-deletes a template.
 */
export const deleteTemplate = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');

  try {
    const result = await TemplateLifecycle.deleteTemplate({
      templateId: id,
      ownerId: user.id,
    });

    return c.json(result);
  } catch (error: any) {
    if (error instanceof TemplateNotFoundError) {
      return c.json({ error: 'Template not found' }, 404);
    }
    return c.json({ error: error.message || 'Failed to delete template' }, 500);
  }
};

/**
 * Lists all versions for a template in descending order.
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
