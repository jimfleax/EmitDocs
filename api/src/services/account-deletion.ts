/**
 * @file account-deletion.ts
 * @description Domain service orchestrating full cascading user account deletion and Cloudinary purge (PRD-CORE-09).
 * @architecture Cascades deletion across all MongoDB collections (Batches, DraftRows, Imports, Snapshots,
 *               Recipients, Templates, TemplateVersions), purges authenticated Cloudinary storage folder,
 *               and revokes active Better-Auth sessions and account records.
 */

import mongoose from 'mongoose';
import cloudinary from '../lib/cloudinary.js';
import { Batch } from '../models/Batch.js';
import { BatchImport } from '../models/BatchImport.js';
import { DraftRow } from '../models/DraftRow.js';
import { ApprovedSnapshot } from '../models/ApprovedSnapshot.js';
import { ApprovedRecipient } from '../models/ApprovedRecipient.js';
import { Template } from '../models/Template.js';
import { TemplateVersion } from '../models/TemplateVersion.js';
import { isTransactionUnsupportedError } from '../lib/transactions.js';

function isNotFoundOrEmptyFolderError(err: any): boolean {
  if (!err) return false;
  const httpCode = err.http_code || err.error?.http_code;
  if (httpCode === 404) return true;
  const msg = (err.message || err.error?.message || (typeof err === 'string' ? err : '')).toLowerCase();
  return (
    msg.includes('not found') ||
    msg.includes('not_found') ||
    msg.includes("can't find") ||
    msg.includes("cant find") ||
    msg.includes('cannot find') ||
    msg.includes('does not exist')
  );
}

export interface DeleteAccountResult {
  success: boolean;
  userId: string;
  deletedBatches: number;
  deletedTemplates: number;
  cloudinaryPurged: boolean;
  errors?: string[];
}

export async function deleteUserAccount(userId: string): Promise<DeleteAccountResult> {
  if (!userId) {
    throw new Error('User ID is required for account deletion');
  }

  const errors: string[] = [];
  let deletedBatches = 0;
  let deletedTemplates = 0;

  let session: mongoose.ClientSession | null = null;
  let transactionCommitted = false;
  let cascadeError: any = null;

  try {
    session = await mongoose.startSession();
    session.startTransaction();

    await BatchImport.deleteMany({ ownerId: userId }, { session });
    await DraftRow.deleteMany({ ownerId: userId }, { session });
    await ApprovedSnapshot.deleteMany({ ownerId: userId }, { session });
    await ApprovedRecipient.deleteMany({ ownerId: userId }, { session });
    await TemplateVersion.deleteMany({ ownerId: userId }, { session });

    const batchRes = await Batch.deleteMany({ ownerId: userId }, { session });
    deletedBatches = batchRes.deletedCount || 0;

    const tplRes = await Template.deleteMany({ ownerId: userId }, { session });
    deletedTemplates = tplRes.deletedCount || 0;

    await session.commitTransaction();
    transactionCommitted = true;
  } catch (err: any) {
    cascadeError = err;
    if (session && session.inTransaction()) {
      try {
        await session.abortTransaction();
      } catch {
        // Transaction abort failed or unsupported
      }
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
    if (cascadeError && !isTransactionUnsupportedError(cascadeError)) {
      errors.push(`MongoDB cascade deletion error: ${cascadeError?.message || cascadeError}`);
      return {
        success: false,
        userId,
        deletedBatches,
        deletedTemplates,
        cloudinaryPurged: false,
        errors,
      };
    }

    try {
      await Promise.all([
        BatchImport.deleteMany({ ownerId: userId }),
        DraftRow.deleteMany({ ownerId: userId }),
        ApprovedSnapshot.deleteMany({ ownerId: userId }),
        ApprovedRecipient.deleteMany({ ownerId: userId }),
        TemplateVersion.deleteMany({ ownerId: userId }),
      ]);

      const batchRes = await Batch.deleteMany({ ownerId: userId });
      deletedBatches = batchRes.deletedCount || 0;

      const tplRes = await Template.deleteMany({ ownerId: userId });
      deletedTemplates = tplRes.deletedCount || 0;
    } catch (err: any) {
      errors.push(`MongoDB cascade deletion error: ${err?.message || err}`);
      return {
        success: false,
        userId,
        deletedBatches,
        deletedTemplates,
        cloudinaryPurged: false,
        errors,
      };
    }
  }

  let cloudinaryPurged = false;
  let hasPurgeErrors = false;
  try {
    if (!cloudinary.config().cloud_name && process.env.CLOUDINARY_CLOUD_NAME) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }

    const folderPrefix = `templates/${userId}/`;
    for (const resourceType of ['image', 'raw'] as const) {
      let nextCursor: string | undefined = undefined;
      while (true) {
        try {
          const res: any = await cloudinary.api.delete_resources_by_prefix(folderPrefix, {
            type: 'authenticated',
            resource_type: resourceType,
            ...(nextCursor ? { next_cursor: nextCursor } : {}),
          });
          if (res?.partial || res?.next_cursor) {
            nextCursor = res.next_cursor;
            if (!res.next_cursor && (!res.deleted || Object.keys(res.deleted).length === 0)) {
              break;
            }
          } else {
            break;
          }
        } catch (err: any) {
          if (!isNotFoundOrEmptyFolderError(err)) {
            hasPurgeErrors = true;
            errors.push(
              `Cloudinary delete_resources_by_prefix error (${resourceType}): ${err?.message || err?.error?.message || err}`
            );
          }
          break;
        }
      }
    }

    try {
      await cloudinary.api.delete_folder(`templates/${userId}`);
    } catch (err: any) {
      if (!isNotFoundOrEmptyFolderError(err)) {
        hasPurgeErrors = true;
        errors.push(`Cloudinary delete_folder error: ${err?.message || err?.error?.message || err}`);
      }
    }

    if (!hasPurgeErrors) {
      cloudinaryPurged = true;
    }
  } catch (err: any) {
    hasPurgeErrors = true;
    errors.push(`Cloudinary purge error: ${err?.message || err?.error?.message || err}`);
  }

  try {
    const userDb = mongoose.connection.db;
    if (userDb) {
      const userIdFilter = {
        $or: [
          { userId },
          ...(mongoose.Types.ObjectId.isValid(userId) ? [{ userId: new mongoose.Types.ObjectId(userId) }] : []),
        ],
      };

      await Promise.all([
        userDb.collection('session').deleteMany(userIdFilter),
        userDb.collection('account').deleteMany(userIdFilter),
        userDb.collection('user').deleteMany({
          $or: [
            { _id: userId as any },
            { id: userId },
            ...(mongoose.Types.ObjectId.isValid(userId) ? [{ _id: new mongoose.Types.ObjectId(userId) }] : []),
          ],
        }),
      ]);
    }
  } catch (err: any) {
    errors.push(`Auth session/user cleanup warning: ${err?.message || err}`);
  }

  return {
    success: errors.length === 0,
    userId,
    deletedBatches,
    deletedTemplates,
    cloudinaryPurged,
    ...(errors.length > 0 ? { errors } : {}),
  };
}

export const AccountDeletion = {
  deleteUserAccount,
};
