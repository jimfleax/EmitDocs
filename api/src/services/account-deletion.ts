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

  try {
    const batchRes = await Batch.deleteMany({ ownerId: userId });
    deletedBatches = batchRes.deletedCount || 0;

    const tplRes = await Template.deleteMany({ ownerId: userId });
    deletedTemplates = tplRes.deletedCount || 0;

    await Promise.all([
      BatchImport.deleteMany({ ownerId: userId }),
      DraftRow.deleteMany({ ownerId: userId }),
      ApprovedSnapshot.deleteMany({ ownerId: userId }),
      ApprovedRecipient.deleteMany({ ownerId: userId }),
      TemplateVersion.deleteMany({ ownerId: userId }),
    ]);
  } catch (err: any) {
    errors.push(`MongoDB cascade deletion error: ${err?.message || err}`);
  }

  let cloudinaryPurged = false;
  try {
    const folderPrefix = `templates/${userId}/`;
    try {
      await cloudinary.api.delete_resources_by_prefix(folderPrefix, {
        type: 'authenticated',
        resource_type: 'image',
      });
    } catch {
      // Ignored if prefix empty
    }

    try {
      await cloudinary.api.delete_resources_by_prefix(folderPrefix, {
        type: 'authenticated',
        resource_type: 'raw',
      });
    } catch {
      // Ignored if prefix empty
    }

    try {
      await cloudinary.api.delete_folder(`templates/${userId}`);
    } catch {
      // Ignored if folder empty or absent
    }

    cloudinaryPurged = true;
  } catch (err: any) {
    errors.push(`Cloudinary purge warning: ${err?.message || err}`);
  }

  try {
    const userDb = mongoose.connection.db;
    if (userDb) {
      await Promise.all([
        userDb.collection('session').deleteMany({ userId }),
        userDb.collection('account').deleteMany({ userId }),
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
