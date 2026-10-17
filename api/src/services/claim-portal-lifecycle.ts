/**
 * @file claim-portal-lifecycle.ts
 * @description Organizer portal lifecycle, token generation, and credential configuration (PRD-CORE-11 Slice 2).
 * @architecture Enforces zero raw credential persistence, CSPRNG token generation, length-prefixed HMAC verifiers,
 *               fail-closed state machine transitions, and atomic concurrency version control.
 */

import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Batch } from '../models/Batch.js';
import { ApprovedSnapshot } from '../models/ApprovedSnapshot.js';
import { ApprovedRecipient } from '../models/ApprovedRecipient.js';
import { ClaimPortal, IClaimPortal, ClaimCredentialMode } from '../models/ClaimPortal.js';
import { ClaimCredentialSet, IClaimCredentialSet } from '../models/ClaimCredentialSet.js';
import { ClaimCredential } from '../models/ClaimCredential.js';
import { ClaimRecipientState } from '../models/ClaimRecipientState.js';
import { ClaimSession } from '../models/ClaimSession.js';
import {
  generateSecureTokens,
  canonicalizeCredential,
  canonicalizePair,
  computeCredentialVerifier,
  evaluateImportedCredentialStrength,
} from './keyed-verifier.js';

const CLAIM_PORTAL_HMAC_SECRET =
  process.env.CLAIM_PORTAL_HMAC_SECRET || 'emitdocs_default_portal_hmac_secret_for_dev_test_mode_minimum_32_bytes_long';

/* -------------------------------------------------------------------------- */
/*                               Typed Domain Errors                          */
/* -------------------------------------------------------------------------- */

export class PortalConflictError extends Error {
  code: string;
  constructor(message: string, code = 'PORTAL_CONFLICT') {
    super(message);
    this.name = 'PortalConflictError';
    this.code = code;
    Object.setPrototypeOf(this, PortalConflictError.prototype);
  }
}

export class PortalNotFoundError extends Error {
  code: string;
  constructor(message: string, code = 'PORTAL_NOT_FOUND') {
    super(message);
    this.name = 'PortalNotFoundError';
    this.code = code;
    Object.setPrototypeOf(this, PortalNotFoundError.prototype);
  }
}

export class BatchNotEligibleError extends Error {
  code: string;
  constructor(message: string, code = 'BATCH_NOT_ELIGIBLE') {
    super(message);
    this.name = 'BatchNotEligibleError';
    this.code = code;
    Object.setPrototypeOf(this, BatchNotEligibleError.prototype);
  }
}

export class ExportAlreadyAcknowledgedError extends Error {
  code: string;
  constructor(message: string, code = 'EXPORT_ALREADY_ACKNOWLEDGED') {
    super(message);
    this.name = 'ExportAlreadyAcknowledgedError';
    this.code = code;
    Object.setPrototypeOf(this, ExportAlreadyAcknowledgedError.prototype);
  }
}

export class InvalidStateTransitionError extends Error {
  code: string;
  constructor(message: string, code = 'INVALID_STATE_TRANSITION') {
    super(message);
    this.name = 'InvalidStateTransitionError';
    this.code = code;
    Object.setPrototypeOf(this, InvalidStateTransitionError.prototype);
  }
}

export class WeakCredentialError extends Error {
  code: string;
  reasons: string[];
  constructor(message: string, reasons: string[] = [], code = 'WEAK_CREDENTIAL') {
    super(message);
    this.name = 'WeakCredentialError';
    this.code = code;
    this.reasons = reasons;
    Object.setPrototypeOf(this, WeakCredentialError.prototype);
  }
}

/* -------------------------------------------------------------------------- */
/*                        Claim Portal Lifecycle Service                      */
/* -------------------------------------------------------------------------- */

export class ClaimPortalLifecycle {
  /**
   * Creates a draft claim portal for an approved batch.
   */
  static async createPortalDraft(
    ownerId: string,
    batchId: string,
    input: { label: string; instructions?: string }
  ): Promise<IClaimPortal> {
    const batch = await Batch.findOne({ _id: batchId, ownerId });
    if (!batch) {
      throw new PortalNotFoundError(`Batch ${batchId} not found or not owned by user`);
    }

    if (!['approved', 'ready_for_download'].includes(batch.status)) {
      throw new BatchNotEligibleError(
        `Batch status must be 'approved' or 'ready_for_download', currently '${batch.status}'`
      );
    }

    if (!batch.approvedSnapshotId) {
      throw new BatchNotEligibleError('Batch does not have an approved snapshot');
    }

    const existing = await ClaimPortal.findOne({ ownerId, batchId });
    if (existing) {
      throw new PortalConflictError(`Claim portal already exists for batch ${batchId}`);
    }

    const publicSlug = crypto.randomBytes(9).toString('base64url').slice(0, 12);
    const expiresAt = batch.expiresAt || new Date(Date.now() + 7 * 24 * 3600 * 1000);

    const portal = await ClaimPortal.create({
      publicSlug,
      ownerId,
      batchId: batch._id,
      snapshotId: batch.approvedSnapshotId,
      credentialMode: 'generated_token',
      credentialSetRevision: 1,
      status: 'draft',
      label: input.label.trim(),
      instructions: input.instructions?.trim(),
      expiresAt,
      eligibleRecipientCount: 0,
      excludedRecipientCount: 0,
      uniqueClaimedCount: 0,
      version: 0,
    });

    return portal;
  }

  /**
   * Updates portal metadata with optimistic concurrency check.
   */
  static async updatePortalConfig(
    ownerId: string,
    portalId: string,
    input: { label?: string; instructions?: string; expectedVersion?: number }
  ): Promise<IClaimPortal> {
    const query: any = { _id: portalId, ownerId };
    if (input.expectedVersion !== undefined) {
      query.version = input.expectedVersion;
    }

    const updateDoc: any = { $inc: { version: 1 } };
    const setFields: any = {};
    if (input.label !== undefined) setFields.label = input.label.trim();
    if (input.instructions !== undefined) setFields.instructions = input.instructions.trim();
    if (Object.keys(setFields).length > 0) updateDoc.$set = setFields;

    const portal = await ClaimPortal.findOneAndUpdate(query, updateDoc, { new: true });
    if (!portal) {
      const check = await ClaimPortal.findOne({ _id: portalId, ownerId });
      if (!check) throw new PortalNotFoundError(`Portal ${portalId} not found`);
      throw new PortalConflictError(
        `Version conflict on portal ${portalId}. Expected version ${input.expectedVersion}, found ${check.version}`
      );
    }
    return portal;
  }

  /**
   * Generates CSPRNG tokens, computes HMAC verifiers, and prepares one-time export tokens.
   */
  static async generateTokenSet(
    ownerId: string,
    portalId: string
  ): Promise<{ revision: number; exportTokens: Array<{ recipientKey: string; name: string; email: string; token: string }> }> {
    const portal = await ClaimPortal.findOne({ _id: portalId, ownerId });
    if (!portal) throw new PortalNotFoundError(`Portal ${portalId} not found`);
    if (['closed', 'expired'].includes(portal.status)) {
      throw new InvalidStateTransitionError('Cannot generate tokens for closed or expired portal');
    }

    const revision = portal.credentialSetRevision;
    const existingSet = await ClaimCredentialSet.findOne({ portalId: portal._id, revision });
    if (existingSet && (existingSet.status === 'awaiting_export_ack' || existingSet.status === 'ready')) {
      throw new ExportAlreadyAcknowledgedError(
        `Token set revision ${revision} has already been generated. Use rotateCredentials to issue fresh tokens.`
      );
    }

    const recipients = await ApprovedRecipient.find({ snapshotId: portal.snapshotId, status: 'valid' });
    const tokens = generateSecureTokens(recipients.length);

    await ClaimCredentialSet.findOneAndUpdate(
      { portalId: portal._id, revision },
      {
        portalId: portal._id,
        revision,
        mode: 'generated_token',
        status: 'awaiting_export_ack',
        generatedAt: new Date(),
        createdBy: ownerId,
      },
      { upsert: true, new: true }
    );

    await ClaimCredential.deleteMany({ portalId: portal._id, credentialSetRevision: revision });

    const credDocs = recipients.map((r, i) => {
      const token = tokens[i];
      const verifier = computeCredentialVerifier(CLAIM_PORTAL_HMAC_SECRET, portal._id.toString(), revision, token);
      return {
        ownerId,
        portalId: portal._id,
        credentialSetId: portal._id,
        credentialSetRevision: revision,
        recipientId: r._id,
        credentialVerifier: verifier,
        credentialKind: 'single',
        verifierKeyVersion: 1,
        strengthClass: 'generated',
        status: 'active',
      };
    });

    if (credDocs.length > 0) {
      await ClaimCredential.insertMany(credDocs, { ordered: false });
    }

    for (const r of recipients) {
      await ClaimRecipientState.findOneAndUpdate(
        { portalId: portal._id, recipientId: r._id },
        {
          portalId: portal._id,
          snapshotId: portal.snapshotId,
          recipientId: r._id,
          credentialSetRevision: revision,
          status: 'eligible',
        },
        { upsert: true }
      );
    }

    portal.eligibleRecipientCount = recipients.length;
    portal.credentialMode = 'generated_token';
    await portal.save();

    const exportTokens = recipients.map((r, i) => {
      const data = r.effectiveData || {};
      const name = data.name || data.fullName || data.recipientName || '';
      const email = data.email || data.emailAddress || '';
      return {
        recipientKey: r.recipientKey,
        name,
        email,
        token: tokens[i],
      };
    });

    return { revision, exportTokens };
  }

  /**
   * Confirms organizer downloaded the CSV export and transitions credential set to ready.
   */
  static async acknowledgeTokenExport(
    ownerId: string,
    portalId: string,
    revision: number
  ): Promise<IClaimCredentialSet> {
    const portal = await ClaimPortal.findOne({ _id: portalId, ownerId });
    if (!portal) throw new PortalNotFoundError(`Portal ${portalId} not found`);

    const credSet = await ClaimCredentialSet.findOne({ portalId: portal._id, revision });
    if (!credSet) throw new PortalNotFoundError(`Credential set revision ${revision} not found`);

    if (credSet.status === 'ready') {
      return credSet;
    }

    if (credSet.status !== 'awaiting_export_ack') {
      throw new InvalidStateTransitionError(
        `Credential set is in '${credSet.status}' state, cannot acknowledge export`
      );
    }

    credSet.status = 'ready';
    credSet.exportAcknowledgedAt = new Date();
    await credSet.save();

    if (portal.status === 'draft') {
      portal.status = 'ready';
      await portal.save();
    }

    return credSet;
  }

  /**
   * Configures imported credentials from snapshot recipient columns with strength checks.
   */
  static async configureImportedCredentials(
    ownerId: string,
    portalId: string,
    input: { primaryFieldKey: string; secondaryFieldKey?: string }
  ): Promise<IClaimCredentialSet> {
    const portal = await ClaimPortal.findOne({ _id: portalId, ownerId });
    if (!portal) throw new PortalNotFoundError(`Portal ${portalId} not found`);
    if (['closed', 'expired'].includes(portal.status)) {
      throw new InvalidStateTransitionError('Cannot configure credentials for closed or expired portal');
    }

    const recipients = await ApprovedRecipient.find({ snapshotId: portal.snapshotId, status: 'valid' });
    if (recipients.length === 0) {
      throw new PortalConflictError('No valid recipients found in approved snapshot to configure credentials');
    }

    const primaryValues = recipients.map(
      (r) => String(r.effectiveData?.[input.primaryFieldKey] ?? (r as any)[input.primaryFieldKey] ?? '')
    );

    if (!input.secondaryFieldKey) {
      const strength = evaluateImportedCredentialStrength(primaryValues);
      if (!strength.strong) {
        throw new WeakCredentialError(
          strength.reason || 'Primary credential is weak; secondary credential factor required',
          strength.collisions
        );
      }
    } else {
      const pairs = recipients.map((r) =>
        canonicalizePair(
          String(r.effectiveData?.[input.primaryFieldKey] ?? ''),
          String(r.effectiveData?.[input.secondaryFieldKey!] ?? '')
        )
      );
      const seen = new Set<string>();
      const collisions: string[] = [];
      for (const pair of pairs) {
        if (seen.has(pair)) collisions.push(pair);
        seen.add(pair);
      }
      if (collisions.length > 0) {
        throw new PortalConflictError(
          `Duplicate credential collisions detected: ${collisions.slice(0, 5).join(', ')}`
        );
      }
    }

    const revision = portal.credentialSetRevision;

    const credSet = await ClaimCredentialSet.findOneAndUpdate(
      { portalId: portal._id, revision },
      {
        portalId: portal._id,
        revision,
        mode: 'imported_credential',
        primaryFieldKey: input.primaryFieldKey,
        secondaryFieldKey: input.secondaryFieldKey,
        status: 'ready',
        createdBy: ownerId,
      },
      { upsert: true, new: true }
    );

    await ClaimCredential.deleteMany({ portalId: portal._id, credentialSetRevision: revision });

    const credDocs = recipients.map((r) => {
      const pVal = String(r.effectiveData?.[input.primaryFieldKey] ?? '');
      const canonical = input.secondaryFieldKey
        ? canonicalizePair(pVal, String(r.effectiveData?.[input.secondaryFieldKey] ?? ''))
        : canonicalizeCredential(pVal);

      const verifier = computeCredentialVerifier(CLAIM_PORTAL_HMAC_SECRET, portal._id.toString(), revision, canonical);

      return {
        ownerId,
        portalId: portal._id,
        credentialSetId: portal._id,
        credentialSetRevision: revision,
        recipientId: r._id,
        credentialVerifier: verifier,
        credentialKind: input.secondaryFieldKey ? 'pair' : 'single',
        verifierKeyVersion: 1,
        strengthClass: input.secondaryFieldKey ? 'two_field_import' : 'strong_import',
        status: 'active',
      };
    });

    if (credDocs.length > 0) {
      await ClaimCredential.insertMany(credDocs, { ordered: false });
    }

    for (const r of recipients) {
      await ClaimRecipientState.findOneAndUpdate(
        { portalId: portal._id, recipientId: r._id },
        {
          portalId: portal._id,
          snapshotId: portal.snapshotId,
          recipientId: r._id,
          credentialSetRevision: revision,
          status: 'eligible',
        },
        { upsert: true }
      );
    }

    portal.eligibleRecipientCount = recipients.length;
    portal.credentialMode = 'imported_credential';
    if (portal.status === 'draft') {
      portal.status = 'ready';
    }
    await portal.save();

    return credSet;
  }

  /**
   * Preflight review of portal readiness, missing outputs, exclusions, and blockers.
   */
  static async getPortalPreflight(
    ownerId: string,
    portalId: string
  ): Promise<{
    eligibleCount: number;
    excludedCount: number;
    duplicateCount: number;
    missingOutputCount: number;
    isReady: boolean;
    blockers: string[];
  }> {
    const portal = await ClaimPortal.findOne({ _id: portalId, ownerId });
    if (!portal) throw new PortalNotFoundError(`Portal ${portalId} not found`);

    const recipients = await ApprovedRecipient.find({ snapshotId: portal.snapshotId });
    const credSet = await ClaimCredentialSet.findOne({
      portalId: portal._id,
      revision: portal.credentialSetRevision,
    });

    const missingOutputs = recipients.filter((r) => !r.outputKey || r.generationStatus !== 'generated');
    const blockers: string[] = [];

    if (!credSet || credSet.status !== 'ready') {
      blockers.push('Credential set is not ready (credentials unconfigured or export unacknowledged)');
    }
    if (recipients.length === 0) {
      blockers.push('No recipients found in approved snapshot');
    }
    if (missingOutputs.length > 0) {
      blockers.push(`${missingOutputs.length} recipient(s) are missing generated certificate outputs`);
    }
    if (Date.now() >= new Date(portal.expiresAt).getTime()) {
      blockers.push('Portal has passed its expiration deadline');
    }

    const eligibleCount = recipients.filter((r) => r.status === 'valid').length;
    const excludedCount = missingOutputs.length;
    const isReady = blockers.length === 0 && eligibleCount > 0;

    return {
      eligibleCount,
      excludedCount,
      duplicateCount: 0,
      missingOutputCount: missingOutputs.length,
      isReady,
      blockers,
    };
  }

  /**
   * Activates portal.
   */
  static async activatePortal(
    ownerId: string,
    portalId: string,
    expectedVersion?: number,
    ackExclusions = false
  ): Promise<IClaimPortal> {
    const portal = await ClaimPortal.findOne({ _id: portalId, ownerId });
    if (!portal) throw new PortalNotFoundError(`Portal ${portalId} not found`);

    if (portal.status === 'active') return portal;
    if (['closed', 'expired'].includes(portal.status)) {
      throw new InvalidStateTransitionError('Closed or expired portal cannot be activated');
    }

    const preflight = await this.getPortalPreflight(ownerId, portalId);
    if (!preflight.isReady) {
      if (!ackExclusions && preflight.missingOutputCount > 0) {
        throw new InvalidStateTransitionError(
          `Cannot activate portal with blockers: ${preflight.blockers.join('; ')}`
        );
      }
      const fatalBlockers = preflight.blockers.filter((b) => !b.includes('missing generated certificate outputs'));
      if (fatalBlockers.length > 0) {
        throw new InvalidStateTransitionError(`Cannot activate portal: ${fatalBlockers.join('; ')}`);
      }
    }

    const query: any = { _id: portalId, ownerId };
    if (expectedVersion !== undefined) query.version = expectedVersion;

    const updated = await ClaimPortal.findOneAndUpdate(
      query,
      {
        $set: { status: 'active', activatedAt: new Date() },
        $inc: { version: 1 },
      },
      { new: true }
    );

    if (!updated) {
      throw new PortalConflictError(`Version conflict while activating portal ${portalId}`);
    }

    return updated;
  }

  /**
   * Pauses active portal.
   */
  static async pausePortal(ownerId: string, portalId: string): Promise<IClaimPortal> {
    const portal = await ClaimPortal.findOne({ _id: portalId, ownerId });
    if (!portal) throw new PortalNotFoundError(`Portal ${portalId} not found`);
    if (portal.status === 'paused') return portal;
    if (portal.status !== 'active') {
      throw new InvalidStateTransitionError(`Can only pause active portal, currently '${portal.status}'`);
    }

    portal.status = 'paused';
    portal.pausedAt = new Date();
    portal.version += 1;
    await portal.save();
    return portal;
  }

  /**
   * Resumes paused portal.
   */
  static async resumePortal(ownerId: string, portalId: string): Promise<IClaimPortal> {
    const portal = await ClaimPortal.findOne({ _id: portalId, ownerId });
    if (!portal) throw new PortalNotFoundError(`Portal ${portalId} not found`);
    if (portal.status === 'active') return portal;
    if (portal.status !== 'paused') {
      throw new InvalidStateTransitionError(`Can only resume paused portal, currently '${portal.status}'`);
    }
    if (Date.now() >= new Date(portal.expiresAt).getTime()) {
      throw new InvalidStateTransitionError('Cannot resume expired portal');
    }

    portal.status = 'active';
    portal.version += 1;
    await portal.save();
    return portal;
  }

  /**
   * Disables portal.
   */
  static async disablePortal(ownerId: string, portalId: string): Promise<IClaimPortal> {
    const portal = await ClaimPortal.findOne({ _id: portalId, ownerId });
    if (!portal) throw new PortalNotFoundError(`Portal ${portalId} not found`);
    if (portal.status === 'closed') {
      throw new InvalidStateTransitionError('Cannot disable closed portal');
    }

    portal.status = 'disabled';
    portal.disabledAt = new Date();
    portal.version += 1;
    await portal.save();
    return portal;
  }

  /**
   * Closes portal permanently and revokes all credentials and active sessions.
   */
  static async closePortal(ownerId: string, portalId: string): Promise<IClaimPortal> {
    const portal = await ClaimPortal.findOne({ _id: portalId, ownerId });
    if (!portal) throw new PortalNotFoundError(`Portal ${portalId} not found`);

    portal.status = 'closed';
    portal.closedAt = new Date();
    portal.version += 1;
    await portal.save();

    await ClaimCredential.updateMany(
      { portalId: portal._id },
      { $set: { status: 'revoked', revokedAt: new Date() } }
    );

    await ClaimSession.updateMany(
      { portalId: portal._id },
      { $set: { revokedAt: new Date() } }
    );

    return portal;
  }

  /**
   * Rotates credentials or switches credential mode.
   */
  static async rotateCredentials(
    ownerId: string,
    portalId: string,
    mode?: ClaimCredentialMode
  ): Promise<{ portal: IClaimPortal; credentialSet: IClaimCredentialSet; revision: number }> {
    const portal = await ClaimPortal.findOne({ _id: portalId, ownerId });
    if (!portal) throw new PortalNotFoundError(`Portal ${portalId} not found`);
    if (portal.status === 'closed') {
      throw new InvalidStateTransitionError('Cannot rotate credentials on closed portal');
    }

    const oldRevision = portal.credentialSetRevision;
    const newRevision = oldRevision + 1;
    const targetMode = mode || portal.credentialMode;

    await ClaimCredentialSet.updateMany(
      { portalId: portal._id, revision: oldRevision },
      { $set: { status: 'revoked', revokedAt: new Date() } }
    );

    await ClaimCredential.updateMany(
      { portalId: portal._id, credentialSetRevision: oldRevision },
      { $set: { status: 'revoked', revokedAt: new Date() } }
    );

    await ClaimSession.updateMany(
      { portalId: portal._id },
      { $set: { revokedAt: new Date() } }
    );

    portal.credentialSetRevision = newRevision;
    portal.credentialMode = targetMode;
    portal.status = 'paused';
    portal.pausedAt = new Date();
    portal.version += 1;
    await portal.save();

    const newCredSet = await ClaimCredentialSet.create({
      portalId: portal._id,
      revision: newRevision,
      mode: targetMode,
      status: 'preparing',
      createdBy: ownerId,
    });

    return { portal, credentialSet: newCredSet, revision: newRevision };
  }

  /**
   * Paginated recipient claim states with filtering.
   */
  static async getPortalRecipients(
    ownerId: string,
    portalId: string,
    query: { page?: number; limit?: number; status?: string }
  ): Promise<{ items: any[]; total: number; page: number; limit: number; totalPages: number }> {
    const portal = await ClaimPortal.findOne({ _id: portalId, ownerId });
    if (!portal) throw new PortalNotFoundError(`Portal ${portalId} not found`);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const match: any = { portalId: portal._id };
    if (query.status) {
      match.status = query.status;
    }

    const [items, total] = await Promise.all([
      ClaimRecipientState.find(match)
        .populate('recipientId')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ClaimRecipientState.countDocuments(match),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Revokes individual recipient claim.
   */
  static async revokeRecipientClaim(
    ownerId: string,
    portalId: string,
    recipientId: string
  ): Promise<any> {
    const portal = await ClaimPortal.findOne({ _id: portalId, ownerId });
    if (!portal) throw new PortalNotFoundError(`Portal ${portalId} not found`);

    const state = await ClaimRecipientState.findOneAndUpdate(
      { portalId: portal._id, recipientId },
      { $set: { status: 'revoked' } },
      { new: true }
    );
    if (!state) throw new PortalNotFoundError(`Recipient ${recipientId} not found in portal`);

    await ClaimCredential.updateMany(
      { portalId: portal._id, recipientId },
      { $set: { status: 'revoked', revokedAt: new Date() } }
    );

    await ClaimSession.updateMany(
      { portalId: portal._id, recipientId },
      { $set: { revokedAt: new Date() } }
    );

    return state;
  }

  /**
   * Aggregates real-time claim metrics and analytics.
   */
  static async getPortalAnalytics(
    ownerId: string,
    portalId: string
  ): Promise<{
    portalId: any;
    label: string;
    status: string;
    totalEligible: number;
    claimedCount: number;
    unclaimedCount: number;
    revokedCount: number;
    excludedCount: number;
    claimRatePercent: number;
    expiresAt: Date;
  }> {
    const portal = await ClaimPortal.findOne({ _id: portalId, ownerId });
    if (!portal) throw new PortalNotFoundError(`Portal ${portalId} not found`);

    const [claimedCount, eligibleCount, revokedCount, excludedCount] = await Promise.all([
      ClaimRecipientState.countDocuments({ portalId: portal._id, status: 'claimed' }),
      ClaimRecipientState.countDocuments({ portalId: portal._id, status: 'eligible' }),
      ClaimRecipientState.countDocuments({ portalId: portal._id, status: 'revoked' }),
      ClaimRecipientState.countDocuments({ portalId: portal._id, status: 'excluded' }),
    ]);

    const totalEligible = claimedCount + eligibleCount;
    const claimRatePercent = totalEligible > 0 ? Math.round((claimedCount / totalEligible) * 1000) / 10 : 0;

    return {
      portalId: portal._id,
      label: portal.label,
      status: portal.status,
      totalEligible,
      claimedCount,
      unclaimedCount: eligibleCount,
      revokedCount,
      excludedCount,
      claimRatePercent,
      expiresAt: portal.expiresAt,
    };
  }
}
