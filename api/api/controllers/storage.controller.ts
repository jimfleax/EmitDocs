import { Context } from 'hono';
import cloudinary from '../lib/cloudinary.js';
import { Template } from '../models/Template.js';
import { TemplateVersion } from '../models/TemplateVersion.js';

export interface StoredDocumentItem {
  id: string;
  name: string;
  bytes: number;
  formattedSize: string;
  format?: string;
  resourceType?: string;
  createdAt?: string;
  isSoftDeleted?: boolean;
  templateId?: string;
}

export interface UserStorageSummary {
  success: boolean;
  totalBytes: number;
  formattedTotal: string;
  documentCount: number;
  documents: StoredDocumentItem[];
  source: 'cloudinary' | 'database';
}

/**
 * Format bytes into human-readable strings (e.g. 14.2 MB, 850 KB, 0 B).
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i <= 0) return `${bytes} B`;
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  return `${val} ${sizes[i]}`;
}

/**
 * Calculate user cloud storage consumption using a hybrid approach:
 * 1. Checks Cloudinary Admin API for live assets under templates/{userId}/*
 * 2. Correlates with MongoDB templates to enrich names and soft-delete statuses
 * 3. Falls back smoothly to MongoDB TemplateVersion byte records if Cloudinary is unavailable or rate-limited.
 */
export async function calculateUserStorage(userId: string): Promise<UserStorageSummary> {
  // 1. Fetch metadata from MongoDB
  const [templates, versions] = await Promise.all([
    Template.find({ ownerId: userId }).lean(),
    TemplateVersion.find({ ownerId: userId }).lean(),
  ]);

  const templateMap = new Map<string, any>();
  for (const t of templates) {
    templateMap.set(String(t._id), t);
  }

  const sourceKeyMap = new Map<string, { templateName: string; isSoftDeleted: boolean; templateId: string }>();
  for (const v of versions) {
    const tmpl = templateMap.get(String(v.templateId));
    if (v.sourceObjectKey) {
      sourceKeyMap.set(v.sourceObjectKey, {
        templateName: tmpl?.name || v.sourceObjectKey.split('/').pop() || 'Document',
        isSoftDeleted: Boolean(tmpl?.deletedAt),
        templateId: String(v.templateId),
      });
    }
  }

  // 2. Query Cloudinary Admin API
  let cloudinaryAssets: any[] = [];
  let usedCloudinary = false;

  const hasCloudinaryCredentials = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

  if (hasCloudinaryCredentials) {
    try {
      const prefix = `templates/${userId}/`;
      const [imageRes, rawRes] = await Promise.allSettled([
        cloudinary.api.resources({
          type: 'authenticated',
          resource_type: 'image',
          prefix,
          max_results: 500,
        }),
        cloudinary.api.resources({
          type: 'authenticated',
          resource_type: 'raw',
          prefix,
          max_results: 500,
        }),
      ]);

      const collected: any[] = [];
      if (imageRes.status === 'fulfilled' && (imageRes.value as any)?.resources) {
        collected.push(...(imageRes.value as any).resources);
      }
      if (rawRes.status === 'fulfilled' && (rawRes.value as any)?.resources) {
        collected.push(...(rawRes.value as any).resources);
      }

      // Deduplicate by public_id
      const seenIds = new Set<string>();
      for (const item of collected) {
        if (!seenIds.has(item.public_id)) {
          seenIds.add(item.public_id);
          cloudinaryAssets.push(item);
        }
      }

      usedCloudinary = true;
    } catch (cloudinaryErr) {
      console.warn('[Storage] Cloudinary API query failed, falling back to database metadata:', cloudinaryErr);
      usedCloudinary = false;
    }
  }

  // 3. Build documents map starting with MongoDB versions
  const docMap = new Map<string, StoredDocumentItem>();

  for (const ver of versions) {
    const tmpl = templateMap.get(String(ver.templateId));
    const key = ver.sourceObjectKey || String(ver._id);
    const name = tmpl?.name || ver.sourceObjectKey?.split('/').pop() || 'Template Document';
    const bytes = ver.bytes || 0;

    docMap.set(key, {
      id: key,
      name,
      bytes,
      formattedSize: formatBytes(bytes),
      format: 'pdf',
      resourceType: 'image',
      createdAt: ver.createdAt ? new Date(ver.createdAt).toISOString() : undefined,
      isSoftDeleted: Boolean(tmpl?.deletedAt),
      templateId: String(ver.templateId),
    });
  }

  // If Cloudinary returned assets, update live sizes and include any additional cloud assets
  if (usedCloudinary) {
    for (const asset of cloudinaryAssets) {
      const keyInfo = sourceKeyMap.get(asset.public_id);
      const fileName = asset.public_id.split('/').pop() || asset.public_id;
      const name = keyInfo?.templateName || fileName;
      const bytes = asset.bytes || 0;

      docMap.set(asset.public_id, {
        id: asset.public_id,
        name,
        bytes,
        formattedSize: formatBytes(bytes),
        format: asset.format || 'pdf',
        resourceType: asset.resource_type || 'image',
        createdAt: asset.created_at,
        isSoftDeleted: Boolean(keyInfo?.isSoftDeleted),
        templateId: keyInfo?.templateId,
      });
    }
  }

  const documents = Array.from(docMap.values());

  // 4. Calculate total storage consumed
  const totalBytes = documents.reduce((sum, doc) => sum + (doc.bytes || 0), 0);
  const formattedTotal = formatBytes(totalBytes);
  const documentCount = documents.length;

  return {
    success: true,
    totalBytes,
    formattedTotal,
    documentCount,
    documents,
    source: usedCloudinary && cloudinaryAssets.length > 0 ? 'cloudinary' : 'database',
  };
}

/**
 * Controller handler for GET /api/storage and GET /api/storage/summary
 */
export const getUserStorage = async (c: Context) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const storageSummary = await calculateUserStorage(user.id);
    return c.json(storageSummary, 200);
  } catch (err: any) {
    console.error('[Storage] Error calculating storage for user:', user.id, err);
    return c.json(
      {
        error: 'Failed to retrieve storage metrics',
        details: err?.message || 'Unknown error',
      },
      500
    );
  }
};
