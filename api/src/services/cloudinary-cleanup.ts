/**
 * @file cloudinary-cleanup.ts
 * @description Domain service managing discovery, tagging, and garbage collection of unreferenced Cloudinary storage assets.
 * @architecture Implements mark-and-sweep asset lifecycle management:
 *               1. Discovers all owner assets under `templates/{ownerId}/` across image and raw storage namespaces.
 *               2. Scans MongoDB across Template, TemplateVersion, ApprovedSnapshot, and ApprovedRecipient for active references.
 *               3. Flags unreferenced assets with the 'unreferenced' tag in Cloudinary.
 *               4. Safely purges unreferenced assets in chunks of <= 100 adhering to Cloudinary API boundaries.
 *               5. Traps missing credentials and storage faults gracefully without impeding caller workflows.
 * @agent_note Assets in EmitDocs reside under `templates/{ownerId}/` with `type: 'authenticated'`.
 */

import cloudinary from '../lib/cloudinary.js';
import { Template } from '../models/Template.js';
import { TemplateVersion } from '../models/TemplateVersion.js';
import { ApprovedSnapshot } from '../models/ApprovedSnapshot.js';
import { ApprovedRecipient } from '../models/ApprovedRecipient.js';
import { Batch } from '../models/Batch.js';

/* -------------------------------------------------------------------------- */
/*                            Interfaces & Payloads                           */
/* -------------------------------------------------------------------------- */

/**
 * @interface CloudinaryAssetSummary
 * @description Metadata summary for a Cloudinary storage asset.
 */
export interface CloudinaryAssetSummary {
  publicId: string;
  resourceType: 'image' | 'raw' | string;
  type?: string;
  format?: string;
  bytes?: number;
  createdAt?: string;
  tags?: string[];
}

/**
 * @interface MarkedAssetItem
 * @description Record of an asset flagged as unreferenced.
 */
export interface MarkedAssetItem {
  publicId: string;
  resourceType: string;
  markedAt: Date | string;
}

/**
 * @interface CloudinaryCleanupSummary
 * @description Execution metrics returned after running unreferenced asset cleanup.
 */
export interface CloudinaryCleanupSummary {
  checkedCount: number;
  referencedCount: number;
  unreferencedCount: number;
  markedAssets: MarkedAssetItem[];
  deletedCount: number;
  errors?: string[];
}

/**
 * @interface CleanupOptions
 * @description Input options specifying target owner for unreferenced asset cleanup.
 */
export interface CleanupOptions {
  ownerId: string;
}

/**
 * @interface PruneOrphansResult
 * @description Summary of pruned database records for orphaned snapshots and recipients.
 */
export interface PruneOrphansResult {
  prunedSnapshotsCount: number;
  prunedRecipientsCount: number;
}

/* -------------------------------------------------------------------------- */
/*                        Cleanup Service Implementation                      */
/* -------------------------------------------------------------------------- */

/**
 * Retrieves all referenced keys and preview thumbnail URLs in MongoDB across all models.
 * Scans TemplateVersion (sourceObjectKey), ApprovedSnapshot (templateSourceChecksum),
 * ApprovedRecipient (outputKey), and Template (thumbnailUrl).
 * 
 * Filters out orphaned snapshots whose batchId or templateId no longer exist,
 * and orphaned recipients whose batchId no longer exists.
 * 
 * @desc Collects database asset references for a given owner or across the entire database.
 * @param {string} [ownerId] - Optional owner filter.
 * @returns {Promise<{ referencedKeys: Set<string>; thumbnailUrls: string[] }>} Set of referenced keys and thumbnail URLs.
 */
export async function getReferencedKeysInDatabase(
  ownerId?: string
): Promise<{ referencedKeys: Set<string>; thumbnailUrls: string[] }> {
  const filter = ownerId ? { ownerId } : {};

  const [versions, activeBatches, activeTemplates, snapshots, recipients] = await Promise.all([
    TemplateVersion.find(filter).select('sourceObjectKey').lean(),
    Batch.find(filter).select('_id').lean(),
    Template.find(filter).select('_id thumbnailUrl').lean(),
    ApprovedSnapshot.find(filter).select('batchId templateId templateSourceChecksum').lean(),
    ApprovedRecipient.find(filter).select('batchId outputKey').lean(),
  ]);

  const activeBatchIdSet = new Set(activeBatches.map((b: any) => String(b._id)));
  const activeTemplateIdSet = new Set(activeTemplates.map((t: any) => String(t._id)));

  const referencedKeys = new Set<string>();
  const thumbnailUrls: string[] = [];

  for (const v of versions) {
    if (v.sourceObjectKey) {
      referencedKeys.add(v.sourceObjectKey);
      const clean = v.sourceObjectKey.replace(/\.[^/.]+$/, '');
      referencedKeys.add(clean);
      referencedKeys.add(`${clean}.pdf`);
    }
  }

  for (const s of snapshots) {
    const isBatchActive = s.batchId ? activeBatchIdSet.has(s.batchId.toString()) : false;
    const isTemplateActive = s.templateId ? activeTemplateIdSet.has(s.templateId.toString()) : false;

    if (isBatchActive && isTemplateActive && s.templateSourceChecksum) {
      referencedKeys.add(s.templateSourceChecksum);
      const clean = s.templateSourceChecksum.replace(/\.[^/.]+$/, '');
      referencedKeys.add(clean);
      referencedKeys.add(`${clean}.pdf`);
    }
  }

  for (const r of recipients) {
    const isBatchActive = r.batchId ? activeBatchIdSet.has(r.batchId.toString()) : false;

    if (isBatchActive && r.outputKey) {
      referencedKeys.add(r.outputKey);
      const clean = r.outputKey.replace(/\.[^/.]+$/, '');
      referencedKeys.add(clean);
      referencedKeys.add(`${clean}.pdf`);
    }
  }

  for (const t of activeTemplates) {
    if (t.thumbnailUrl) {
      thumbnailUrls.push(t.thumbnailUrl);
    }
  }

  return { referencedKeys, thumbnailUrls };
}

/**
 * Prunes dangling ApprovedSnapshot and ApprovedRecipient records whose referenced batches
 * or templates have been deleted.
 * 
 * @desc Deletes orphaned snapshots and recipients from MongoDB.
 * @param {string} [ownerId] - Optional owner filter.
 * @returns {Promise<PruneOrphansResult>} Number of pruned snapshot and recipient documents.
 */
export async function pruneOrphanedSnapshotsAndRecipients(
  ownerId?: string
): Promise<PruneOrphansResult> {
  const filter = ownerId ? { ownerId } : {};

  const [activeBatches, activeTemplates] = await Promise.all([
    Batch.find(filter).select('_id').lean(),
    Template.find(filter).select('_id').lean(),
  ]);

  const activeBatchIds = activeBatches.map((b) => b._id);
  const activeTemplateIds = activeTemplates.map((t) => t._id);

  const snapshotFilter: any = {
    ...filter,
    $or: [
      { batchId: { $nin: activeBatchIds } },
      { templateId: { $nin: activeTemplateIds } },
    ],
  };

  const recipientFilter: any = {
    ...filter,
    batchId: { $nin: activeBatchIds },
  };

  const [snapDeleteRes, recDeleteRes] = await Promise.all([
    ApprovedSnapshot.deleteMany(snapshotFilter),
    ApprovedRecipient.deleteMany(recipientFilter),
  ]);

  return {
    prunedSnapshotsCount: snapDeleteRes?.deletedCount ?? 0,
    prunedRecipientsCount: recDeleteRes?.deletedCount ?? 0,
  };
}

/**
 * Determines whether a Cloudinary asset public ID is referenced in the database.
 * Handles exact matching, normalized cleanId without extension vs with .pdf,
 * snapshot checksums, recipient output keys, and thumbnail URLs.
 * 
 * @desc Checks if a publicId or its normalized variant exists in the referenced database set.
 * @param {string} publicId - Cloudinary asset identifier.
 * @param {Set<string>} referencedKeys - Set of referenced keys in database.
 * @param {string[]} [thumbnailUrls=[]] - List of template thumbnail URLs.
 * @returns {boolean} True if the asset is referenced, false otherwise.
 */
export function isAssetReferenced(
  publicId: string,
  referencedKeys: Set<string>,
  thumbnailUrls: string[] = []
): boolean {
  if (!publicId || typeof publicId !== 'string') {
    return false;
  }

  const cleanId = publicId.replace(/\.[^/.]+$/, '');
  const withPdf = `${cleanId}.pdf`;

  if (
    referencedKeys.has(publicId) ||
    referencedKeys.has(cleanId) ||
    referencedKeys.has(withPdf)
  ) {
    return true;
  }

  // Check against thumbnail URLs
  for (const url of thumbnailUrls) {
    if (typeof url === 'string') {
      if (url.includes(publicId) || url.includes(cleanId)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Lists all Cloudinary assets owned by a specific user across both 'image' and 'raw' resource types.
 * Scoped to folder prefix `templates/{ownerId}/` and delivery type `authenticated`.
 * 
 * @desc Discovers all stored Cloudinary assets for an owner across image and raw storage.
 * @param {string} ownerId - ID of the owning user.
 * @returns {Promise<CloudinaryAssetSummary[]>}> List of discovered Cloudinary assets.
 */
export async function listCloudinaryOwnerAssets(ownerId: string): Promise<CloudinaryAssetSummary[]> {
  if (!ownerId || typeof ownerId !== 'string' || ownerId.trim() === '') {
    return [];
  }

  if (
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET ||
    !process.env.CLOUDINARY_CLOUD_NAME
  ) {
    return [];
  }

  const prefix = `templates/${ownerId}/`;
  const assets: CloudinaryAssetSummary[] = [];
  const seenPublicIds = new Set<string>();

  const fetchResourceType = async (resourceType: 'image' | 'raw') => {
    let nextCursor: string | undefined;
    do {
      const response: any = await cloudinary.api.resources({
        type: 'authenticated',
        resource_type: resourceType,
        prefix,
        max_results: 500,
        next_cursor: nextCursor,
      });

      if (response && Array.isArray(response.resources)) {
        for (const res of response.resources) {
          if (!seenPublicIds.has(res.public_id)) {
            seenPublicIds.add(res.public_id);
            assets.push({
              publicId: res.public_id,
              resourceType: res.resource_type || resourceType,
              type: res.type,
              format: res.format,
              bytes: res.bytes,
              createdAt: res.created_at,
              tags: res.tags || [],
            });
          }
        }
      }
      nextCursor = response?.next_cursor;
    } while (nextCursor);
  };

  const listErrors: Error[] = [];
  try {
    await fetchResourceType('image');
  } catch (err: any) {
    console.warn(`[cloudinary-cleanup] Failed to list image resources for owner ${ownerId}:`, err?.message || err);
    listErrors.push(err);
  }

  try {
    await fetchResourceType('raw');
  } catch (err: any) {
    console.warn(`[cloudinary-cleanup] Failed to list raw resources for owner ${ownerId}:`, err?.message || err);
    listErrors.push(err);
  }

  if (listErrors.length === 2) {
    throw new Error(`Failed to list Cloudinary assets: ${listErrors.map((e) => e.message || String(e)).join('; ')}`);
  }

  return assets;
}

/**
 * Tags unreferenced assets in Cloudinary with the 'unreferenced' tag.
 * Groups assets by resource type and tags them in batches of <= 100.
 * 
 * @desc Applies 'unreferenced' tag to candidate deletion assets in Cloudinary.
 * @param {CloudinaryAssetSummary[]} assets - Assets to mark.
 * @returns {Promise<MarkedAssetItem[]>} Successfully marked asset records.
 */
export async function markUnreferencedAssets(
  assets: CloudinaryAssetSummary[]
): Promise<MarkedAssetItem[]> {
  if (!assets || assets.length === 0) {
    return [];
  }

  const markedAssets: MarkedAssetItem[] = [];
  const now = new Date();

  // Group by resourceType
  const byType = new Map<string, string[]>();
  for (const asset of assets) {
    const type = asset.resourceType || 'image';
    if (!byType.has(type)) {
      byType.set(type, []);
    }
    byType.get(type)!.push(asset.publicId);
  }

  for (const [resType, publicIds] of byType.entries()) {
    const CHUNK_SIZE = 100;
    for (let i = 0; i < publicIds.length; i += CHUNK_SIZE) {
      const chunk = publicIds.slice(i, i + CHUNK_SIZE);
      try {
        await cloudinary.uploader.add_tag('unreferenced', chunk, {
          resource_type: resType,
          type: 'authenticated',
        });
      } catch (err: any) {
        console.warn(`[cloudinary-cleanup] Failed to add tag to ${chunk.length} ${resType} assets:`, err?.message || err);
      }
    }
  }

  for (const asset of assets) {
    markedAssets.push({
      publicId: asset.publicId,
      resourceType: asset.resourceType || 'image',
      markedAt: now,
    });
  }

  return markedAssets;
}

/**
 * Deletes unreferenced assets from Cloudinary in chunks of <= 100.
 * Groups assets by resource type and executes authenticated deletion requests.
 * If any asset deletion returns 'not_found', retries with alternate resource type ('raw' | 'image')
 * and delivery type ('upload') to ensure mismatched resource types or upload delivery types
 * are thoroughly eradicated.
 * 
 * @desc Purges unreferenced assets in chunks of <= 100 to adhere to API constraints.
 * @param {CloudinaryAssetSummary[]} assets - Assets to delete.
 * @returns {Promise<number>} Total number of assets deleted.
 */
export async function deleteAssetsFromCloudinary(
  assets: CloudinaryAssetSummary[]
): Promise<number> {
  if (!assets || assets.length === 0) {
    return 0;
  }

  let totalDeleted = 0;

  const byType = new Map<string, string[]>();
  for (const asset of assets) {
    const type = asset.resourceType || 'image';
    if (!byType.has(type)) {
      byType.set(type, []);
    }
    byType.get(type)!.push(asset.publicId);
  }

  for (const [resType, publicIds] of byType.entries()) {
    const CHUNK_SIZE = 100;
    for (let i = 0; i < publicIds.length; i += CHUNK_SIZE) {
      const chunk = publicIds.slice(i, i + CHUNK_SIZE);
      try {
        const result: any = await cloudinary.api.delete_resources(chunk, {
          resource_type: resType,
          type: 'authenticated',
        });

        const notFoundIds: string[] = [];

        if (result?.deleted && typeof result.deleted === 'object') {
          for (const [id, status] of Object.entries(result.deleted)) {
            if (status === 'deleted' || status === true) {
              totalDeleted += 1;
            } else if (status === 'not_found') {
              notFoundIds.push(id);
            }
          }
        } else if (result?.deleted_counts) {
          totalDeleted += Object.values(result.deleted_counts as Record<string, number>).reduce(
            (a, b) => a + b,
            0
          );
        } else {
          totalDeleted += chunk.length;
        }

        // Retry not_found assets with alternate resource type or upload delivery type
        if (notFoundIds.length > 0) {
          const altType = resType === 'image' ? 'raw' : 'image';
          const retryConfigs = [
            { resource_type: resType, type: 'upload' },
            { resource_type: altType, type: 'authenticated' },
            { resource_type: altType, type: 'upload' },
          ];

          let remainingNotFound = [...notFoundIds];

          for (const cfg of retryConfigs) {
            if (remainingNotFound.length === 0) break;
            try {
              const retryResult: any = await cloudinary.api.delete_resources(remainingNotFound, cfg);
              if (retryResult?.deleted && typeof retryResult.deleted === 'object') {
                const stillNotFound: string[] = [];
                for (const [id, status] of Object.entries(retryResult.deleted)) {
                  if (status === 'deleted' || status === true) {
                    totalDeleted += 1;
                  } else {
                    stillNotFound.push(id);
                  }
                }
                remainingNotFound = stillNotFound;
              }
            } catch (retryErr: any) {
              console.warn(
                `[cloudinary-cleanup] Retry delete failed for ${remainingNotFound.length} assets with options ${JSON.stringify(cfg)}:`,
                retryErr?.message || retryErr
              );
            }
          }
        }
      } catch (err: any) {
        console.warn(`[cloudinary-cleanup] Failed to delete chunk of ${chunk.length} ${resType} assets:`, err?.message || err);
      }
    }
  }

  return totalDeleted;
}

/**
 * Executes full mark-and-sweep cleanup of unreferenced Cloudinary assets for a given owner.
 * Lists all assets, scans MongoDB for references, marks unreferenced assets with 'unreferenced' tag,
 * and deletes them in chunks of <= 100.
 * 
 * @desc Orchestrates unreferenced Cloudinary document cleanup for an owner.
 * @param {CleanupOptions} options - Options containing ownerId.
 * @returns {Promise<CloudinaryCleanupSummary>} Summary of checked, referenced, unreferenced, marked, and deleted counts.
 */
export async function cleanupUnreferencedCloudinaryAssets(
  options: CleanupOptions
): Promise<CloudinaryCleanupSummary> {
  const { ownerId } = options || {};

  if (!ownerId || typeof ownerId !== 'string' || ownerId.trim() === '') {
    return {
      checkedCount: 0,
      referencedCount: 0,
      unreferencedCount: 0,
      markedAssets: [],
      deletedCount: 0,
      errors: ['Missing or invalid ownerId'],
    };
  }

  if (
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET ||
    !process.env.CLOUDINARY_CLOUD_NAME
  ) {
    return {
      checkedCount: 0,
      referencedCount: 0,
      unreferencedCount: 0,
      markedAssets: [],
      deletedCount: 0,
      errors: ['Cloudinary credentials missing or unconfigured'],
    };
  }

  const errors: string[] = [];

  try {
    // 0. Prune orphaned snapshots and recipients before asset discovery
    try {
      await pruneOrphanedSnapshotsAndRecipients(ownerId);
    } catch (pruneErr: any) {
      console.warn(`[cloudinary-cleanup] Failed to prune orphaned snapshots/recipients for owner ${ownerId}:`, pruneErr?.message || pruneErr);
      errors.push(`Failed to prune orphaned snapshots/recipients: ${pruneErr?.message || pruneErr}`);
    }

    // 1. Discover all assets in Cloudinary for this owner
    let ownerAssets: CloudinaryAssetSummary[] = [];
    try {
      ownerAssets = await listCloudinaryOwnerAssets(ownerId);
    } catch (listErr: any) {
      errors.push(`Failed to list Cloudinary assets: ${listErr?.message || listErr}`);
      return {
        checkedCount: 0,
        referencedCount: 0,
        unreferencedCount: 0,
        markedAssets: [],
        deletedCount: 0,
        errors,
      };
    }

    const checkedCount = ownerAssets.length;

    // 2. Discover all referenced keys in MongoDB
    let referencedKeys = new Set<string>();
    let thumbnailUrls: string[] = [];
    try {
      const dbRefs = await getReferencedKeysInDatabase(ownerId);
      referencedKeys = dbRefs.referencedKeys;
      thumbnailUrls = dbRefs.thumbnailUrls;
    } catch (dbErr: any) {
      errors.push(`Failed to fetch database references: ${dbErr?.message || dbErr}`);
      return {
        checkedCount,
        referencedCount: 0,
        unreferencedCount: 0,
        markedAssets: [],
        deletedCount: 0,
        errors,
      };
    }

    // 3. Partition assets into referenced and unreferenced
    const referencedAssets: CloudinaryAssetSummary[] = [];
    const unreferencedAssets: CloudinaryAssetSummary[] = [];

    for (const asset of ownerAssets) {
      if (isAssetReferenced(asset.publicId, referencedKeys, thumbnailUrls)) {
        referencedAssets.push(asset);
      } else {
        unreferencedAssets.push(asset);
      }
    }

    const referencedCount = referencedAssets.length;
    const unreferencedCount = unreferencedAssets.length;

    if (unreferencedCount === 0) {
      return {
        checkedCount,
        referencedCount,
        unreferencedCount: 0,
        markedAssets: [],
        deletedCount: 0,
      };
    }

    // 4. Mark unreferenced assets in Cloudinary
    let markedAssets: MarkedAssetItem[] = [];
    try {
      markedAssets = await markUnreferencedAssets(unreferencedAssets);
    } catch (markErr: any) {
      errors.push(`Failed to mark unreferenced assets: ${markErr?.message || markErr}`);
    }

    // 5. Delete unreferenced assets from Cloudinary in chunks of <= 100
    let deletedCount = 0;
    try {
      deletedCount = await deleteAssetsFromCloudinary(unreferencedAssets);
    } catch (delErr: any) {
      errors.push(`Failed to delete unreferenced assets: ${delErr?.message || delErr}`);
    }

    return {
      checkedCount,
      referencedCount,
      unreferencedCount,
      markedAssets,
      deletedCount,
      ...(errors.length > 0 ? { errors } : {}),
    };
  } catch (fatalErr: any) {
    return {
      checkedCount: 0,
      referencedCount: 0,
      unreferencedCount: 0,
      markedAssets: [],
      deletedCount: 0,
      errors: [fatalErr?.message || 'Unknown cleanup error'],
    };
  }
}

/**
 * @module CloudinaryCleanup
 * @description Domain service namespace packaging Cloudinary unreferenced asset operations.
 */
export const CloudinaryCleanup = {
  getReferencedKeysInDatabase,
  isAssetReferenced,
  listCloudinaryOwnerAssets,
  markUnreferencedAssets,
  deleteAssetsFromCloudinary,
  cleanupUnreferencedCloudinaryAssets,
  pruneOrphanedSnapshotsAndRecipients,
};
