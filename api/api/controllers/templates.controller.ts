import crypto from 'crypto';
import { Context } from 'hono';
import cloudinary from '../lib/cloudinary';
import { Template } from '../models/Template';
import { TemplateVersion, IFieldMapping } from '../models/TemplateVersion';
import { getJsonBody } from '../lib/request';

export const signUpload = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const timestamp = Math.round(new Date().getTime() / 1000);
  const folder = `templates/${user.id}`;
  
  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder,
      type: 'authenticated',
    },
    process.env.CLOUDINARY_API_SECRET!
  );

  return c.json({
    signature,
    timestamp,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    folder,
  });
};

/**
 * Generate a signed Cloudinary thumbnail URL for page 1 of an authenticated PDF document.
 */
export function generateThumbnailUrl(publicId: string): string {
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
 * Auto-repair legacy or missing thumbnail URLs.
 * Converts legacy `/image/upload/` URLs (which 404 for authenticated assets) to `/image/authenticated/`.
 * Generates fresh authenticated thumbnail URLs if the URL is missing and sourceObjectKey is present.
 */
export function repairThumbnailUrl(url: string | null | undefined, publicId?: string): string | null {
  if (url && url.includes('/image/upload/') && url.includes('/templates/')) {
    return url.replace('/image/upload/', '/image/authenticated/');
  }
  if (url && url.includes('/image/authenticated/')) {
    return url;
  }
  if (!url && publicId) {
    return generateThumbnailUrl(publicId);
  }
  return url || null;
}

export const createTemplate = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const body = await getJsonBody(c);
    const { name, cloudinaryPublicId, thumbnailUrl } = body || {};

    if (!name || !cloudinaryPublicId) {
      return c.json({ error: 'Missing required fields (name and cloudinaryPublicId)' }, 400);
    }
    // Verify asset using Cloudinary Admin API
    // Attempt image resource first (allows multi-page document inspection & thumbnails)
    let asset: any;
    let isImageResource = true;
    try {
      asset = await cloudinary.api.resource(cloudinaryPublicId, {
        type: 'authenticated',
        resource_type: 'image',
      });
    } catch {
      isImageResource = false;
      asset = await cloudinary.api.resource(cloudinaryPublicId, {
        type: 'authenticated',
        resource_type: 'raw',
      });
    }

    const bytes = asset.bytes || 0;
    const pageCount = asset.pages || 1;

    // Generate signed page-1 thumbnail URL if available
    let finalThumbnailUrl = thumbnailUrl || null;
    if (!finalThumbnailUrl && isImageResource) {
      finalThumbnailUrl = generateThumbnailUrl(cloudinaryPublicId);
    }

    // Create Template
    const template = new Template({
      ownerId: user.id,
      name,
      thumbnailUrl: finalThumbnailUrl,
    });
    await template.save();

    // Create TemplateVersion
    const version = new TemplateVersion({
      templateId: template._id,
      ownerId: user.id,
      version: 1,
      sourceObjectKey: cloudinaryPublicId,
      bytes,
      pageCount,
      status: 'active',
    });
    await version.save();

    template.currentVersionId = version._id as any;
    await template.save();

    return c.json({ template, version }, 201);
  } catch (error: any) {
    console.error('Error creating template:', error);
    return c.json({ error: 'Failed to create template', details: error.message }, 500);
  }
};

export const getTemplates = async (c: Context) => {
  const user = c.get('user');
  
  const templates = await Template.find({ ownerId: user.id, deletedAt: null })
    .populate('currentVersionId')
    .sort({ createdAt: -1 });

  // Auto-heal thumbnails for existing templates
  for (const template of templates) {
    const originalUrl = template.thumbnailUrl;
    const version = template.currentVersionId as any;
    const sourceKey = version?.sourceObjectKey;
    const repaired = repairThumbnailUrl(originalUrl, sourceKey);
    if (repaired && repaired !== originalUrl) {
      template.thumbnailUrl = repaired;
      Template.updateOne({ _id: template._id }, { $set: { thumbnailUrl: repaired } }).exec().catch((err) => {
        console.error('Failed to update repaired thumbnail URL:', err);
      });
    }
  }

  return c.json({ templates });
};

export const getTemplateById = async (c: Context) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const template = await Template.findOne({ _id: id, ownerId: user.id, deletedAt: null })
    .populate('currentVersionId');

  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }

  const originalUrl = template.thumbnailUrl;
  const version = template.currentVersionId as any;
  const sourceKey = version?.sourceObjectKey;
  const repaired = repairThumbnailUrl(originalUrl, sourceKey);
  if (repaired && repaired !== originalUrl) {
    template.thumbnailUrl = repaired;
    Template.updateOne({ _id: template._id }, { $set: { thumbnailUrl: repaired } }).exec().catch((err) => {
      console.error('Failed to update repaired thumbnail URL:', err);
    });
  }

  return c.json({ template });
};

export const deleteTemplate = async (c: Context) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const template = await Template.findOneAndUpdate(
    { _id: id, ownerId: user.id, deletedAt: null },
    { deletedAt: new Date() },
    { new: true }
  );

  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }

  return c.json({ success: true, message: 'Template deleted' });
};

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

export const getTemplateVersions = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');

  const template = await Template.findOne({ _id: id, ownerId: user.id, deletedAt: null });
  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }

  const versions = await TemplateVersion.find({ templateId: id, ownerId: user.id }).sort({ version: -1 });
  return c.json({ versions });
};

export const getTemplateVersionById = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const versionId = c.req.param('versionId');

  const template = await Template.findOne({ _id: id, ownerId: user.id, deletedAt: null });
  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }

  const version = await TemplateVersion.findOne({
    _id: versionId,
    templateId: id,
    ownerId: user.id,
  });

  if (!version) {
    return c.json({ error: 'Template version not found' }, 404);
  }

  return c.json({ version });
};

export const streamTemplateVersionPdf = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const versionId = c.req.param('versionId');

  const template = await Template.findOne({ _id: id, ownerId: user.id, deletedAt: null });
  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }

  const version = await TemplateVersion.findOne({
    _id: versionId,
    templateId: id,
    ownerId: user.id,
  });

  if (!version) {
    return c.json({ error: 'Template version not found' }, 404);
  }

  let downloadUrl = cloudinary.url(version.sourceObjectKey, {
    resource_type: 'image',
    format: 'pdf',
    type: 'authenticated',
    sign_url: true,
  });

  let pdfResponse = await fetch(downloadUrl);
  if (!pdfResponse.ok) {
    downloadUrl = cloudinary.url(version.sourceObjectKey, {
      resource_type: 'raw',
      type: 'authenticated',
      sign_url: true,
    });
    pdfResponse = await fetch(downloadUrl);
  }

  if (!pdfResponse.ok || !pdfResponse.body) {
    return c.json({ error: 'Failed to fetch PDF asset from storage' }, 502);
  }

  c.header('Content-Type', 'application/pdf');
  c.header('Content-Disposition', `inline; filename="template-v${version.version}.pdf"`);
  c.header('Cache-Control', 'private, max-age=3600');

  return c.body(pdfResponse.body);
};

export const createTemplateVersion = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');

  try {
    const template = await Template.findOne({ _id: id, ownerId: user.id, deletedAt: null });
    if (!template) {
      return c.json({ error: 'Template not found' }, 404);
    }

    const body = await getJsonBody(c);
    const { expectedVersion, fieldMappings } = body || {};

    if (typeof expectedVersion !== 'number' || !Number.isInteger(expectedVersion)) {
      return c.json({ error: 'Missing or invalid expectedVersion (must be integer)' }, 400);
    }

    if (!Array.isArray(fieldMappings)) {
      return c.json({ error: 'fieldMappings must be an array' }, 400);
    }

    const latest = await TemplateVersion.findOne({ templateId: id }).sort({ version: -1 });
    if (!latest) {
      return c.json({ error: 'No existing template version found' }, 404);
    }

    // CAS Check
    if (latest.version !== expectedVersion) {
      return c.json(
        {
          error: 'VERSION_CONFLICT',
          message: `Version modified concurrently. Expected version ${expectedVersion}, but latest is ${latest.version}`,
          currentVersion: latest.version,
        },
        409
      );
    }

    const mappingHash = computeMappingHash(fieldMappings);

    // Mark previous version superseded
    latest.status = 'superseded';
    await latest.save();

    // Create new version
    const newVersion = new TemplateVersion({
      templateId: template._id,
      ownerId: user.id,
      version: latest.version + 1,
      sourceObjectKey: latest.sourceObjectKey,
      bytes: latest.bytes,
      pageCount: latest.pageCount,
      status: 'active',
      fieldMappings,
      mappingHash,
    });
    await newVersion.save();

    // Update template currentVersionId
    template.currentVersionId = newVersion._id as any;
    await template.save();

    return c.json({ template, version: newVersion }, 201);
  } catch (error: any) {
    console.error('Error creating template version:', error);
    return c.json({ error: 'Failed to create template version', details: error.message }, 500);
  }
};

