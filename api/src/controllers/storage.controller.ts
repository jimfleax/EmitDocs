/**
 * @file storage.controller.ts
 * @description Controller and calculation engine for user cloud storage metrics.
 * @architecture Computes cloud storage consumption across Cloudinary Admin API assets and MongoDB TemplateVersion records.
 * @agent_note When computing storage metrics, assets are correlated with MongoDB templates and versions to enrich document names.
 */

import { Context } from 'hono';
import cloudinary from '../lib/cloudinary.js';
import { Template } from '../models/Template.js';
import { TemplateVersion } from '../models/TemplateVersion.js';
import { cleanupUnreferencedCloudinaryAssets } from '../services/cloudinary-cleanup.js';

/**
 * @interface StoredDocumentItem
 * @description Detail record of an individual stored asset in user storage.
 * @property {string} id - Asset public ID or version key.
 * @property {string} name - Associated template or filename.
 * @property {number} bytes - Raw byte size.
 * @property {string} formattedSize - Human-readable size string (e.g. "2.4 MB").
 * @property {string} [format] - File extension format (e.g. 'pdf').
 * @property {string} [resourceType] - Cloudinary resource type ('image' or 'raw').
 * @property {string} [createdAt] - Upload timestamp.
 */
export interface StoredDocumentItem {
  id: string;
  name: string;
  bytes: number;
  formattedSize: string;
  format?: string;
  resourceType?: string;
  createdAt?: string;
  templateId?: string;
}

/**
 * @interface UserStorageSummary
 * @description Aggregated storage consumption payload returned to the frontend.
 * @property {boolean} success - Operation success flag.
 * @property {number} totalBytes - Aggregated total byte size.
 * @property {string} formattedTotal - Human-readable total (e.g. "12.8 MB").
 * @property {number} documentCount - Count of stored document assets.
 * @property {StoredDocumentItem[]} documents - List of detailed stored assets.
 * @property {'cloudinary' | 'database'} source - Data source indicating whether live cloud probe succeeded.
 */
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
 * 
 * @desc Converts numeric bytes into a human-readable string with units.
 * @param {number} bytes - Number of bytes to format.
 * @param {number} [decimals=1] - Decimal precision to retain.
 * @returns {string} Formatted size string.
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
 * 
 * @desc Evaluates total user storage consumption using hybrid Cloudinary API probe and MongoDB fallback.
 * @param {string} userId - Target Better-Auth user ID.
 * @returns {Promise<UserStorageSummary>} Detailed breakdown of stored documents and aggregated bytes.
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

  const validSourceKeys = new Set<string>();
  const sourceKeyMap = new Map<string, { templateName: string; templateId: string }>();
  for (const v of versions) {
    const tmpl = templateMap.get(String(v.templateId));
    if (v.sourceObjectKey) {
      const clean = v.sourceObjectKey.replace(/\.[^/.]+$/, '');
      validSourceKeys.add(v.sourceObjectKey);
      validSourceKeys.add(clean);
      validSourceKeys.add(`${clean}.pdf`);

      const entry = {
        templateName: tmpl?.name || v.sourceObjectKey.split('/').pop() || 'Document',
        templateId: String(v.templateId),
      };
      sourceKeyMap.set(v.sourceObjectKey, entry);
      sourceKeyMap.set(clean, entry);
      sourceKeyMap.set(`${clean}.pdf`, entry);
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
      const fetchResources = async (resourceType: 'image' | 'raw') => {
        const resources: any[] = [];
        let nextCursor: string | undefined = undefined;
        do {
          const res: any = await cloudinary.api.resources({
            type: 'authenticated',
            resource_type: resourceType,
            prefix,
            max_results: 500,
            ...(nextCursor ? { next_cursor: nextCursor } : {}),
          });
          if (res?.resources && Array.isArray(res.resources)) {
            resources.push(...res.resources);
          }
          nextCursor = res?.next_cursor;
        } while (nextCursor);
        return resources;
      };

      const [imageRes, rawRes] = await Promise.allSettled([
        fetchResources('image'),
        fetchResources('raw'),
      ]);

      if (imageRes.status === 'rejected') {
        console.warn('[Storage] Cloudinary image query rejected:', imageRes.reason);
      }
      if (rawRes.status === 'rejected') {
        console.warn('[Storage] Cloudinary raw query rejected:', rawRes.reason);
      }

      usedCloudinary = imageRes.status === 'fulfilled' || rawRes.status === 'fulfilled';

      const collected: any[] = [];
      if (imageRes.status === 'fulfilled' && Array.isArray(imageRes.value)) {
        collected.push(...imageRes.value);
      }
      if (rawRes.status === 'fulfilled' && Array.isArray(rawRes.value)) {
        collected.push(...rawRes.value);
      }

      // Deduplicate by public_id
      const seenIds = new Set<string>();
      for (const item of collected) {
        if (!seenIds.has(item.public_id)) {
          seenIds.add(item.public_id);
          cloudinaryAssets.push(item);
        }
      }
    } catch (cloudinaryErr) {
      console.warn('[Storage] Cloudinary API query failed, falling back to database metadata:', cloudinaryErr);
      usedCloudinary = false;
    }
  }

  // 3. Short-circuit: If user has 0 templates and 0 versions in MongoDB, storage is strictly 0 B
  if (templates.length === 0 && versions.length === 0) {
    // If residual/orphaned files exist in Cloudinary, purge them in the background
    if (usedCloudinary && cloudinaryAssets.length > 0) {
      cleanupUnreferencedCloudinaryAssets({ ownerId: userId }).catch((err) => {
        console.warn('[Storage] Background cleanup of orphaned Cloudinary assets failed:', err);
      });
    }

    return {
      success: true,
      totalBytes: 0,
      formattedTotal: '0 B',
      documentCount: 0,
      documents: [],
      source: usedCloudinary && cloudinaryAssets.length > 0 ? 'cloudinary' : 'database',
    };
  }

  // 4. Build documents map starting with MongoDB versions
  const docMap = new Map<string, StoredDocumentItem>();

  for (const ver of versions) {
    const tmpl = templateMap.get(String(ver.templateId));
    const key = ver.sourceObjectKey || String(ver._id);
    const cleanKey = ver.sourceObjectKey ? ver.sourceObjectKey.replace(/\.[^/.]+$/, '') : key;
    const name = tmpl?.name || ver.sourceObjectKey?.split('/').pop() || 'Template Document';
    const bytes = ver.bytes || 0;

    docMap.set(cleanKey, {
      id: ver.sourceObjectKey || cleanKey,
      name,
      bytes,
      formattedSize: formatBytes(bytes),
      format: 'pdf',
      resourceType: ver.resourceType || 'image',
      createdAt: ver.createdAt ? new Date(ver.createdAt).toISOString() : undefined,
      templateId: String(ver.templateId),
    });
  }

  // If Cloudinary returned assets, update live sizes for active documents only
  let hasOrphanedCloudinaryAssets = false;
  if (usedCloudinary) {
    for (const asset of cloudinaryAssets) {
      const cleanId = asset.public_id.replace(/\.[^/.]+$/, '');
      const isReferenced = validSourceKeys.has(asset.public_id) || validSourceKeys.has(cleanId);

      if (!isReferenced) {
        hasOrphanedCloudinaryAssets = true;
        continue;
      }

      const keyInfo = sourceKeyMap.get(asset.public_id) || sourceKeyMap.get(cleanId);
      const fileName = asset.public_id.split('/').pop() || asset.public_id;
      const name = keyInfo?.templateName || fileName;
      const bytes = asset.bytes || 0;

      docMap.set(cleanId, {
        id: asset.public_id,
        name,
        bytes,
        formattedSize: formatBytes(bytes),
        format: asset.format || 'pdf',
        resourceType: asset.resource_type || 'image',
        createdAt: asset.created_at,
        templateId: keyInfo?.templateId,
      });
    }

    if (hasOrphanedCloudinaryAssets) {
      cleanupUnreferencedCloudinaryAssets({ ownerId: userId }).catch((err) => {
        console.warn('[Storage] Background cleanup of unreferenced Cloudinary assets failed:', err);
      });
    }
  }

  const documents = Array.from(docMap.values());

  // 5. Calculate total storage consumed
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
 * @desc    Retrieves total cloud storage consumption metrics, asset details, and byte counts for the authenticated user.
 * @route   GET /api/storage
 * @access  Private (Authenticated User)
 * @returns {Promise<Response>} 200 JSON UserStorageSummary payload, 401 if unauthorized, or 500 on failure.
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
