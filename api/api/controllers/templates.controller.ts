import { Context } from 'hono';
import cloudinary from '../lib/cloudinary';
import { Template } from '../models/Template';
import { TemplateVersion } from '../models/TemplateVersion';
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
    const asset = await cloudinary.api.resource(cloudinaryPublicId, {
      type: 'authenticated',
      resource_type: 'raw',
    });

    const bytes = asset.bytes;
    const pageCount = asset.pages || 1; // raw PDFs may not expose pages

    // Create Template
    const template = new Template({
      ownerId: user.id,
      name,
      thumbnailUrl: thumbnailUrl || null,
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
