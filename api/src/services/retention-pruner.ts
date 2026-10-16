/**
 * @file retention-pruner.ts
 * @description Domain service for batch expiration lifecycle management and MongoDB PII pruning (PRD-CORE-09).
 * @architecture Enforces logical expiry when now() >= expiresAt, updates Batch.status to 'expired',
 *               and prunes DraftRow and ApprovedRecipient PII collections while preserving
 *               aggregate Batch audit metrics with zero Cloudinary sweeps.
 */

import mongoose from 'mongoose';
import { Batch, IBatch } from '../models/Batch.js';
import { DraftRow } from '../models/DraftRow.js';
import { ApprovedRecipient } from '../models/ApprovedRecipient.js';

export interface PruneAllResult {
  checkedCount: number;
  expiredBatchesCount: number;
  prunedRecipientsCount: number;
  prunedDraftRowsCount: number;
}

/**
 * Checks whether a batch has exceeded its expiration deadline and transitions it to 'expired'.
 * Prunes associated DraftRow records and ApprovedRecipient records while retaining the Batch audit record.
 */
export async function expireBatchIfDue(
  batchId: string | mongoose.Types.ObjectId,
  ownerId?: string
): Promise<{ expired: boolean; batch: IBatch | null }> {
  const query: any = { _id: batchId };
  if (ownerId) {
    query.ownerId = ownerId;
  }

  const batch = await Batch.findOne(query);
  if (!batch) {
    return { expired: false, batch: null };
  }

  const now = new Date();
  const isPastDue = batch.expiresAt ? now >= new Date(batch.expiresAt) : false;

  if (batch.status === 'expired' || isPastDue) {
    if (batch.status !== 'expired') {
      batch.status = 'expired';
      await batch.save();
    }

    await Promise.all([
      ApprovedRecipient.deleteMany({ batchId: batch._id }),
      DraftRow.deleteMany({ batchId: batch._id }),
    ]);

    return { expired: true, batch };
  }

  return { expired: false, batch };
}

/**
 * Scans all active unexpired batches across the system where now() >= expiresAt.
 * Transitions their status to 'expired' and cleans up recipient PII.
 */
export async function pruneAllExpiredBatches(): Promise<PruneAllResult> {
  const now = new Date();
  const expiredBatches = await Batch.find({
    status: { $ne: 'expired' },
    expiresAt: { $ne: null, $lte: now },
  });

  let prunedRecipientsCount = 0;
  let prunedDraftRowsCount = 0;

  for (const batch of expiredBatches) {
    batch.status = 'expired';
    await batch.save();

    const [recRes, draftRes] = await Promise.all([
      ApprovedRecipient.deleteMany({ batchId: batch._id }),
      DraftRow.deleteMany({ batchId: batch._id }),
    ]);

    prunedRecipientsCount += recRes.deletedCount || 0;
    prunedDraftRowsCount += draftRes.deletedCount || 0;
  }

  return {
    checkedCount: expiredBatches.length,
    expiredBatchesCount: expiredBatches.length,
    prunedRecipientsCount,
    prunedDraftRowsCount,
  };
}

export const RetentionPruner = {
  expireBatchIfDue,
  pruneAllExpiredBatches,
};
