/**
 * @file ClaimPortalWorkspace.tsx
 * @description Master organizer workspace assembling tabs (Overview, Credentials, Preflight, Recipients, Settings) and lifecycle actions.
 */

import { useState, useEffect, useCallback } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Alert } from "@/components/ui/Alert";
import { toast } from "@/components/ui/toast";
import { ClaimPortalStatusHeader } from "./ClaimPortalStatusHeader";
import { CredentialModeSelector } from "./CredentialModeSelector";
import { ImportedCredentialColumnMapper } from "./ImportedCredentialColumnMapper";
import { CredentialStrengthReport } from "./CredentialStrengthReport";
import { DuplicateCredentialTable } from "./DuplicateCredentialTable";
import { GeneratedTokenExportPanel } from "./GeneratedTokenExportPanel";
import { TokenRotationConfirmDialog } from "./TokenRotationConfirmDialog";
import { CredentialModeSwitchDialog } from "./CredentialModeSwitchDialog";
import { ClaimEligibilitySummary } from "./ClaimEligibilitySummary";
import { ExcludedRecipientReviewTable } from "./ExcludedRecipientReviewTable";
import { ClaimPortalLifecycleControls } from "./ClaimPortalLifecycleControls";
import { ClaimAnalyticsSummary } from "./ClaimAnalyticsSummary";
import { RecipientClaimStatusTable } from "./RecipientClaimStatusTable";

export interface ClaimPortalWorkspaceProps {
  batchId: string;
}

export function ClaimPortalWorkspace({ batchId }: ClaimPortalWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "credentials" | "preflight" | "recipients" | "settings">("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [batch, setBatch] = useState<any>(null);
  const [portal, setPortal] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>({
    totalEligible: 0,
    uniqueClaimedCount: 0,
    unclaimedCount: 0,
    claimRatePercent: 0,
  });
  const [preflight, setPreflight] = useState<any>(null);

  // Column mapper state
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [primaryFieldKey, setPrimaryFieldKey] = useState<string>("");
  const [secondaryFieldKey, setSecondaryFieldKey] = useState<string | undefined>(undefined);
  const [strengthReport, setStrengthReport] = useState<any>(null);

  // Recipient table state
  const [recipients, setRecipients] = useState<any[]>([]);
  const [recipientTotal, setRecipientTotal] = useState(0);
  const [recPage, setRecPage] = useState(1);
  const [recSearch, setRecSearch] = useState("");
  const [recStatusFilter, setRecStatusFilter] = useState("");

  // Dialog states
  const [rotationDialogOpen, setRotationDialogOpen] = useState(false);
  const [modeSwitchTarget, setModeSwitchTarget] = useState<any>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Fetch batch
      const bRes = await fetch(`/api/batches/${batchId}`, { credentials: "include" });
      if (!bRes.ok) throw new Error("Failed to load batch metadata");
      const bData = await bRes.json();
      setBatch(bData.batch);

      // 2. Fetch or create portal
      let currentPortal: any = null;
      const pRes = await fetch(`/api/batches/${batchId}/claim-portal`, { credentials: "include" });
      if (pRes.status === 404) {
        // Create initial draft
        const createRes = await fetch(`/api/batches/${batchId}/claim-portal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ label: bData.batch.name || "Certificate Claim Portal" }),
        });
        if (!createRes.ok) throw new Error("Failed to initialize portal");
        const createData = await createRes.json();
        currentPortal = createData.portal;
        setPortal(createData.portal);
      } else if (pRes.ok) {
        const pData = await pRes.json();
        currentPortal = pData.portal;
        setPortal(pData.portal);
      }

      // 3. Fetch preflight & analytics if portal exists
      if (currentPortal?._id) {
        const [preRes, anRes] = await Promise.all([
          fetch(`/api/claim-portals/${currentPortal._id}/preflight`, { credentials: "include" }),
          fetch(`/api/claim-portals/${currentPortal._id}/analytics`, { credentials: "include" }),
        ]);
        if (preRes.ok) {
          const preData = await preRes.json();
          setPreflight(preData);
          setStrengthReport(preData.strengthReport || null);
        }
        if (anRes.ok) {
          const anData = await anRes.json();
          setAnalytics(anData);
        }
      }

      // 4. Sample columns from snapshot
      const snapRes = await fetch(`/api/batches/${batchId}/snapshot/recipients?page=1&limit=1`, { credentials: "include" });
      if (snapRes.ok) {
        const snapData = await snapRes.json();
        if (snapData.recipients && snapData.recipients[0]?.effectiveData) {
          setAvailableColumns(Object.keys(snapData.recipients[0].effectiveData));
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load claim portal");
    } finally {
      setIsLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Load recipients
  const loadRecipients = useCallback(async () => {
    if (!portal?._id) return;
    try {
      const q = new URLSearchParams({
        page: String(recPage),
        limit: "50",
        search: recSearch,
        status: recStatusFilter,
      });
      const res = await fetch(`/api/claim-portals/${portal._id}/recipients?${q}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setRecipients(data.recipients || []);
        setRecipientTotal(data.total || 0);
      }
    } catch {
      // Ignore background error
    }
  }, [portal?._id, recPage, recSearch, recStatusFilter]);

  useEffect(() => {
    if (activeTab === "recipients") {
      void loadRecipients();
    }
  }, [activeTab, loadRecipients]);

  // Lifecycle action handlers
  const handleActivate = async () => {
    const res = await fetch(`/api/claim-portals/${portal._id}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ expectedVersion: portal.version }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Activation failed");
    }
    toast.success("Portal Activated", "Participants can now access the portal.");
    await loadData();
  };

  const handlePause = async () => {
    const res = await fetch(`/api/claim-portals/${portal._id}/pause`, { method: "POST", credentials: "include" });
    if (!res.ok) throw new Error("Pause failed");
    toast.info("Portal Paused", "Public claims halted.");
    await loadData();
  };

  const handleResume = async () => {
    const res = await fetch(`/api/claim-portals/${portal._id}/resume`, { method: "POST", credentials: "include" });
    if (!res.ok) throw new Error("Resume failed");
    toast.success("Portal Resumed", "Claims active.");
    await loadData();
  };

  const handleDisable = async () => {
    const res = await fetch(`/api/claim-portals/${portal._id}/disable`, { method: "POST", credentials: "include" });
    if (!res.ok) throw new Error("Disable failed");
    toast.warning("Portal Disabled");
    await loadData();
  };

  const handleClose = async () => {
    const res = await fetch(`/api/claim-portals/${portal._id}/close`, { method: "POST", credentials: "include" });
    if (!res.ok) throw new Error("Close failed");
    toast.error("Portal Closed", "Credentials revoked.");
    await loadData();
  };

  const handleGenerateTokens = async () => {
    const res = await fetch(`/api/claim-portals/${portal._id}/credentials/generate`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Failed to generate tokens");
    }
    const data = await res.json();
    return data.exportTokens || [];
  };

  const handleAcknowledgeExport = async (revision: number) => {
    const res = await fetch(`/api/claim-portals/${portal._id}/credentials/export-ack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ revision }),
    });
    if (!res.ok) throw new Error("Failed to acknowledge export");
    await loadData();
  };

  const handleRevokeRecipient = async (recipientId: string) => {
    const res = await fetch(`/api/claim-portals/${portal._id}/recipients/${recipientId}/revoke`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) throw new Error("Revocation failed");
    toast.success("Recipient Revoked");
    await loadRecipients();
  };

  return (
    <PageShell
      title="Claim Portal Workspace"
      subtitle="Public participant self-service certificate claim portal"
      backTo={`/app/batches/${batchId}/results`}
      backLabel="Back to Results"
      maxWidth="5xl"
      isLoading={isLoading}
    >
      <div className="space-y-6 pb-12">
        {error && (
          <Alert variant="error" title="Claim Portal Error">
            <p>{error}</p>
          </Alert>
        )}

        {portal && (
          <ClaimPortalStatusHeader
            portal={portal}
            batchName={batch?.name || "Batch"}
          />
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
          {(["overview", "credentials", "preflight", "recipients", "settings"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && portal && (
          <div className="space-y-6">
            <ClaimAnalyticsSummary analytics={analytics} />
            <ClaimPortalLifecycleControls
              status={portal.status}
              isReady={preflight?.isReady ?? false}
              hasBlockers={(preflight?.blockers?.length ?? 0) > 0}
              onActivate={handleActivate}
              onPause={handlePause}
              onResume={handleResume}
              onDisable={handleDisable}
              onClose={handleClose}
            />
          </div>
        )}

        {/* Credentials Tab */}
        {activeTab === "credentials" && portal && (
          <div className="space-y-6">
            <CredentialModeSelector
              mode={portal.credentialMode || "generated_token"}
              onChange={(m) => setModeSwitchTarget(m)}
              isExistingPortal={portal.status !== "draft"}
            />

            {portal.credentialMode === "generated_token" ? (
              <GeneratedTokenExportPanel
                portalId={portal._id}
                revision={portal.credentialSetRevision || 1}
                status={portal.credentialSetStatus || "preparing"}
                onGenerate={handleGenerateTokens}
                onAcknowledge={handleAcknowledgeExport}
                onRotatePrompt={() => setRotationDialogOpen(true)}
              />
            ) : (
              <div className="space-y-4">
                <ImportedCredentialColumnMapper
                  availableColumns={availableColumns}
                  primaryFieldKey={primaryFieldKey}
                  secondaryFieldKey={secondaryFieldKey}
                  onPrimaryChange={setPrimaryFieldKey}
                  onSecondaryChange={setSecondaryFieldKey}
                  requiresSecondary={strengthReport && !strengthReport.strong}
                />
                <CredentialStrengthReport
                  strength={strengthReport}
                  hasSecondaryField={!!secondaryFieldKey}
                />
                {preflight?.duplicateCollisions && (
                  <DuplicateCredentialTable collisions={preflight.duplicateCollisions} />
                )}
              </div>
            )}
          </div>
        )}

        {/* Preflight Tab */}
        {activeTab === "preflight" && (
          <div className="space-y-6">
            <ClaimEligibilitySummary
              snapshotTotal={batch?.totalRows || 0}
              eligibleCount={preflight?.eligibleCount || 0}
              excludedCount={preflight?.excludedCount || 0}
              missingOutputCount={preflight?.missingOutputCount || 0}
              isReady={preflight?.isReady ?? false}
            />
            {preflight?.excludedRecipients && (
              <ExcludedRecipientReviewTable excludedRecipients={preflight.excludedRecipients} />
            )}
          </div>
        )}

        {/* Recipients Tab */}
        {activeTab === "recipients" && portal && (
          <RecipientClaimStatusTable
            portalId={portal._id}
            recipients={recipients}
            totalCount={recipientTotal}
            page={recPage}
            limit={50}
            search={recSearch}
            statusFilter={recStatusFilter}
            onPageChange={setRecPage}
            onSearchChange={setRecSearch}
            onStatusFilterChange={setRecStatusFilter}
            onRevokeRecipient={handleRevokeRecipient}
          />
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && portal && (
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Portal Metadata &amp; Instructions
            </h4>
            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Portal Title / Safe Label:
              </label>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono">
                {portal.label}
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Retention Expiry (Inherited from Batch):
              </label>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono">
                {portal.expiresAt ? new Date(portal.expiresAt).toLocaleString() : "—"}
              </div>
            </div>
          </div>
        )}

        {/* Rotation Dialog */}
        <TokenRotationConfirmDialog
          open={rotationDialogOpen}
          onOpenChange={setRotationDialogOpen}
          onConfirm={async () => {
            const res = await fetch(`/api/claim-portals/${portal._id}/credentials/rotate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ mode: "generated_token" }),
            });
            if (!res.ok) throw new Error("Rotation failed");
            toast.success("Tokens Rotated", "Old credentials invalidated.");
            await loadData();
          }}
        />

        {/* Mode Switch Dialog */}
        {modeSwitchTarget && (
          <CredentialModeSwitchDialog
            open={!!modeSwitchTarget}
            onOpenChange={(open) => !open && setModeSwitchTarget(null)}
            targetMode={modeSwitchTarget}
            onConfirm={async () => {
              const res = await fetch(`/api/claim-portals/${portal._id}/credentials/rotate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ mode: modeSwitchTarget }),
              });
              if (!res.ok) throw new Error("Mode switch failed");
              toast.success("Mode Switched", "Portal paused for configuration.");
              setModeSwitchTarget(null);
              await loadData();
            }}
          />
        )}
      </div>
    </PageShell>
  );
}
