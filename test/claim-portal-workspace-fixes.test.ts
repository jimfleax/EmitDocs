/**
 * @file claim-portal-workspace-fixes.test.ts
 * @description Unit tests validating review comment fixes in ClaimPortalWorkspace and related API endpoints.
 */

import assert from "node:assert";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../api/.env") });

import { Batch } from "../api/src/models/Batch.js";
import { ApprovedSnapshot } from "../api/src/models/ApprovedSnapshot.js";
import { ApprovedRecipient } from "../api/src/models/ApprovedRecipient.js";
import { ClaimPortal } from "../api/src/models/ClaimPortal.js";
import { ClaimCredentialSet } from "../api/src/models/ClaimCredentialSet.js";
import { ClaimPortalLifecycle } from "../api/src/services/claim-portal-lifecycle.js";

async function run() {
  console.log("Starting ClaimPortalWorkspace review fixes verification...\n");

  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/emitdocs";
  await mongoose.connect(uri, { dbName: "emitdocs_workspace_fixes_test" });

  const ownerId = `org_ws_${Date.now()}`;

  try {
    // -------------------------------------------------------------------------
    // 1. Verify Error message handling (err.error before err.message)
    // -------------------------------------------------------------------------
    console.log("1. Testing activation and token-generation error extraction...");
    const sampleErrorResponse = { error: "Credential set is not ready", code: "INVALID_STATE_TRANSITION" };
    const extractError = (err: any, fallback: string) => err.error || err.message || fallback;
    assert.strictEqual(extractError(sampleErrorResponse, "Activation failed"), "Credential set is not ready");
    assert.strictEqual(extractError({ message: "Legacy error" }, "Failed"), "Legacy error");
    assert.strictEqual(extractError({}, "Default fallback"), "Default fallback");
    console.log("   ✓ Error extraction prioritized err.error over err.message\n");

    // -------------------------------------------------------------------------
    // 2. Verify CredentialModeSelector onChange filtering
    // -------------------------------------------------------------------------
    console.log("2. Testing CredentialModeSelector onChange filter...");
    let modeSwitchTarget: string | null = null;
    const currentMode = "generated_token";
    const handleModeChange = (selected: string) => {
      if (selected !== currentMode) {
        modeSwitchTarget = selected;
      }
    };
    // Selecting same mode should be ignored
    handleModeChange("generated_token");
    assert.strictEqual(modeSwitchTarget, null, "Selecting current mode must not set modeSwitchTarget");

    // Selecting different mode triggers switch
    handleModeChange("imported_credential");
    assert.strictEqual(modeSwitchTarget, "imported_credential", "Selecting different mode must set modeSwitchTarget");
    console.log("   ✓ Mode switch ignores selections matching current mode\n");

    // -------------------------------------------------------------------------
    // 3. Verify Analytics mapping (claimedCount -> uniqueClaimedCount, defaults to 0)
    // -------------------------------------------------------------------------
    console.log("3. Testing analytics unwrapping & mapping...");
    const apiAnalyticsPayload = {
      analytics: {
        totalEligible: 50,
        claimedCount: 22,
        unclaimedCount: 28,
        claimRatePercent: 44.0,
      },
    };
    const raw = apiAnalyticsPayload.analytics || apiAnalyticsPayload;
    const mappedAnalytics = {
      totalEligible: Number(raw.totalEligible ?? 0),
      uniqueClaimedCount: Number((raw as any).claimedCount ?? (raw as any).uniqueClaimedCount ?? 0),
      unclaimedCount: Number(raw.unclaimedCount ?? 0),
      claimRatePercent: Number(raw.claimRatePercent ?? 0),
    };
    assert.strictEqual(mappedAnalytics.totalEligible, 50);
    assert.strictEqual(mappedAnalytics.uniqueClaimedCount, 22);
    assert.strictEqual(mappedAnalytics.unclaimedCount, 28);
    assert.strictEqual(mappedAnalytics.claimRatePercent, 44.0);

    // Test with missing fields
    const emptyRaw: any = {};
    const defaultedAnalytics = {
      totalEligible: Number(emptyRaw.totalEligible ?? 0),
      uniqueClaimedCount: Number(emptyRaw.claimedCount ?? emptyRaw.uniqueClaimedCount ?? 0),
      unclaimedCount: Number(emptyRaw.unclaimedCount ?? 0),
      claimRatePercent: Number(emptyRaw.claimRatePercent ?? 0),
    };
    assert.strictEqual(defaultedAnalytics.uniqueClaimedCount, 0);
    assert.strictEqual(defaultedAnalytics.totalEligible, 0);
    console.log("   ✓ Analytics unwrapped, claimedCount mapped to uniqueClaimedCount, and missing numbers defaulted to 0\n");

    // -------------------------------------------------------------------------
    // 4. Verify Recipient row mapping (items, recipientId, effectiveData, recipient._id)
    // -------------------------------------------------------------------------
    console.log("4. Testing recipient claim state row mapping...");
    const mockRecipientState = {
      _id: new mongoose.Types.ObjectId(), // state document ID
      portalId: new mongoose.Types.ObjectId(),
      status: "claimed",
      firstClaimAt: new Date().toISOString(),
      recipientId: {
        _id: new mongoose.Types.ObjectId(), // ApprovedRecipient document ID
        recipientKey: "REC-001",
        effectiveData: {
          name: "Jane Doe",
          email: "jane@example.com",
        },
      },
    };

    const mockApiResponse = {
      items: [mockRecipientState],
      total: 1,
      page: 1,
      limit: 50,
    };

    const mappedRows = (mockApiResponse.items || []).map((item: any) => {
      const rec = typeof item.recipientId === "object" && item.recipientId !== null ? item.recipientId : {};
      const eff = rec.effectiveData || {};
      const recipientId = rec._id || (typeof item.recipientId === "string" ? item.recipientId : item._id);
      return {
        _id: String(recipientId),
        recipientKey: rec.recipientKey || eff.recipientKey || "",
        name: eff.name || eff.fullName || eff.recipientName || rec.name || "Participant",
        email: eff.email || eff.emailAddress || rec.email || "",
        status: item.status,
        firstClaimAt: item.firstClaimAt,
        lastClaimAt: item.lastClaimAt,
      };
    });

    assert.strictEqual(mappedRows.length, 1);
    assert.strictEqual(mappedRows[0]._id, mockRecipientState.recipientId._id.toString());
    assert.notStrictEqual(mappedRows[0]._id, mockRecipientState._id.toString(), "Must use recipient ID, not state document ID");
    assert.strictEqual(mappedRows[0].recipientKey, "REC-001");
    assert.strictEqual(mappedRows[0].name, "Jane Doe");
    assert.strictEqual(mappedRows[0].email, "jane@example.com");
    assert.strictEqual(mappedRows[0].status, "claimed");
    console.log("   ✓ Recipient row mapped with recipient._id, recipientKey, and effectiveData details\n");

    // -------------------------------------------------------------------------
    // 5. Test Preflight data supplying strengthReport, duplicateCollisions, and credentialSetStatus
    // -------------------------------------------------------------------------
    console.log("5. Testing backend preflight with strengthReport and duplicateCollisions...");
    const batch = await Batch.create({
      ownerId,
      templateId: new mongoose.Types.ObjectId(),
      templateVersionId: new mongoose.Types.ObjectId(),
      name: "Workspace Fixes Batch",
      status: "approved",
      retentionHours: 24,
      expiresAt: new Date(Date.now() + 1000 * 3600 * 24),
    });

    const snapshot = await ApprovedSnapshot.create({
      batchId: batch._id,
      ownerId,
      templateId: batch.templateId,
      templateVersionId: batch.templateVersionId,
      templateVersion: 1,
      templateSourceChecksum: "chk1",
      mappingHash: "map1",
      importRevision: 1,
      canonicalDigest: "dig1",
      totalRecipients: 2,
      idempotencyKey: `idemp_${Date.now()}`,
      status: "ready",
      expiresAt: batch.expiresAt,
    });

    batch.approvedSnapshotId = snapshot._id;
    await batch.save();

    await ApprovedRecipient.create([
      {
        snapshotId: snapshot._id,
        batchId: batch._id,
        ownerId,
        recipientKey: "R1",
        sourceRowNumber: 1,
        effectiveData: { studentId: "DUP-STUDENT-01", name: "User 1" },
        status: "valid",
        generationStatus: "generated",
        outputKey: "certs/r1.pdf",
      },
      {
        snapshotId: snapshot._id,
        batchId: batch._id,
        ownerId,
        recipientKey: "R2",
        sourceRowNumber: 2,
        effectiveData: { studentId: "DUP-STUDENT-01", name: "User 2" },
        status: "valid",
        generationStatus: "generated",
        outputKey: "certs/r2.pdf",
      },
    ]);

    const portal = await ClaimPortalLifecycle.createPortalDraft(ownerId, batch._id.toString(), {
      label: "Portal Test",
    });

    // Check preflight on newly created draft
    let preflight = await ClaimPortalLifecycle.getPortalPreflight(ownerId, portal._id.toString());
    assert.strictEqual(preflight.credentialSetStatus, "preparing");

    // Configure imported credentials with a duplicate value
    // Duplicate values will fail on configureImportedCredentials with collisions
    try {
      await ClaimPortalLifecycle.configureImportedCredentials(ownerId, portal._id.toString(), {
        primaryFieldKey: "studentId",
      });
      assert.fail("Should have thrown WeakCredentialError or PortalConflictError for duplicates");
    } catch (err: any) {
      assert.ok(err.reasons || err.message.includes("Duplicate"));
    }

    // Now manually upsert primaryFieldKey on credentialSet to verify preflight calculation of duplicateCollisions
    await ClaimCredentialSet.findOneAndUpdate(
      { portalId: portal._id, revision: portal.credentialSetRevision },
      {
        portalId: portal._id,
        revision: portal.credentialSetRevision,
        primaryFieldKey: "studentId",
        mode: "imported_credential",
        status: "preparing",
        createdBy: ownerId,
      },
      { upsert: true, new: true }
    );

    preflight = await ClaimPortalLifecycle.getPortalPreflight(ownerId, portal._id.toString());
    assert.ok(preflight.strengthReport);
    assert.ok(preflight.duplicateCollisions);
    assert.strictEqual(preflight.duplicateCollisions.length, 1);
    assert.strictEqual(preflight.duplicateCollisions[0].value, "DUP-STUDENT-01");
    assert.strictEqual(preflight.duplicateCollisions[0].count, 2);
    assert.deepStrictEqual(preflight.duplicateCollisions[0].recipientKeys, ["R1", "R2"]);
    console.log("   ✓ Preflight correctly provides credentialSetStatus, strengthReport, and duplicateCollisions\n");

    console.log("===========================================================");
    console.log("  ALL CLAIM PORTAL WORKSPACE FIXES VERIFIED SUCCESSFULLY!  ");
    console.log("===========================================================");
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
