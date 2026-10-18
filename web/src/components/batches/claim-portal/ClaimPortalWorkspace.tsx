/**
 * @file ClaimPortalWorkspace.tsx
 * @description Master organizer workspace assembling tabs (Overview, Credentials, Preflight, Recipients, Settings) and lifecycle actions.
 */

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck } from "@phosphor-icons/react";
import { PageShell } from "@/components/layout/PageShell";
import { Alert } from "@/components/ui/Alert";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/Spinner";
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
import { ClaimPortalSettingsPanel } from "./ClaimPortalSettingsPanel";

export interface ClaimPortalWorkspaceProps {
  batchId: string;
}

export function ClaimPortalWorkspace({ batchId }: ClaimPortalWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "credentials" | "preflight" | "recipients" | "settings">("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [batch, setBatch] = useState<any>(null);
  const [portal, setPortal] = useState<any>(null);
  const [credentialSetStatus, setCredentialSetStatus] = useState<
    "preparing" | "awaiting_export_ack" | "ready" | "revoked" | "expired"
  >("preparing");
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
  const [isSavingImport, setIsSavingImport] = useState(false);
  const [importConfigError, setImportConfigError] = useState<string | null>(null);
  const [weakReasons, setWeakReasons] = useState<string[]>([]);

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
      if (!pRes.ok) {
        throw new Error("Failed to load claim portal");
      }
      const pData = await pRes.json();
      if (!pData.portal) {
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
        if (createData.portal?.credentialSetStatus) {
          setCredentialSetStatus(createData.portal.credentialSetStatus);
        }
      } else {
        currentPortal = pData.portal;
        setPortal(pData.portal);
        if (pData.portal?.credentialSetStatus) {
          setCredentialSetStatus(pData.portal.credentialSetStatus);
        }
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
          if (preData.credentialSetStatus) {
            setCredentialSetStatus(preData.credentialSetStatus);
          }
          if (preData.primaryFieldKey) {
            setPrimaryFieldKey((prev) => prev || preData.primaryFieldKey);
          }
          if (preData.secondaryFieldKey) {
            setSecondaryFieldKey((prev) => prev || preData.secondaryFieldKey);
          }
        }
        if (anRes.ok) {
          const anData = await anRes.json();
          const raw = anData.analytics || anData;
          setAnalytics({
            totalEligible: Number(raw.totalEligible ?? 0),
            uniqueClaimedCount: Number(raw.claimedCount ?? raw.uniqueClaimedCount ?? 0),
            unclaimedCount: Number(raw.unclaimedCount ?? 0),
            claimRatePercent: Number(raw.claimRatePercent ?? 0),
          });
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
  const portalId = portal?._id;
  const loadRecipients = useCallback(async () => {
    if (!portalId) return;
    try {
      const q = new URLSearchParams({
        page: String(recPage),
        limit: "50",
        search: recSearch,
        status: recStatusFilter,
      });
      const res = await fetch(`/api/claim-portals/${portalId}/recipients?${q}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.items || []).map((item: any) => {
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
        setRecipients(mapped);
        setRecipientTotal(data.total || 0);
      }
    } catch {
      // Ignore background error
    }
  }, [portalId, recPage, recSearch, recStatusFilter]);

  useEffect(() => {
    if (activeTab === "recipients") {
      void loadRecipients();
    }
  }, [activeTab, loadRecipients]);

  // Lifecycle action handlers
  const handleActivate = async (ackExclusions = true) => {
    const res = await fetch(`/api/claim-portals/${portal._id}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ expectedVersion: portal.version, ackExclusions }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || "Activation failed");
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
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || "Failed to generate tokens");
    }
    const data = await res.json();
    setCredentialSetStatus("awaiting_export_ack");
    return data.exportTokens || [];
  };

  const handleAcknowledgeExport = async (revision: number) => {
    const res = await fetch(`/api/claim-portals/${portal._id}/credentials/export-ack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ revision }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || "Failed to acknowledge export");
    }
    setCredentialSetStatus("ready");
    await loadData();
  };

  const handleRevokeRecipient = async (recipientId: string) => {
    const res = await fetch(`/api/claim-portals/${portal._id}/recipients/${recipientId}/revoke`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || "Revocation failed");
    }
    toast.success("Recipient Revoked");
    await loadRecipients();
  };

  const handleConfigureImport = async () => {
    if (!portal?._id || !primaryFieldKey) return;
    try {
      setIsSavingImport(true);
      setImportConfigError(null);
      setWeakReasons([]);
      const res = await fetch(`/api/claim-portals/${portal._id}/credentials/import-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          primaryFieldKey,
          secondaryFieldKey: secondaryFieldKey || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 400 && (err.code === "WEAK_CREDENTIAL" || err.reasons)) {
          const reasons = Array.isArray(err.reasons) ? err.reasons : [];
          setWeakReasons(reasons);
          setImportConfigError(err.error || "Weak credential: secondary factor required");
          setStrengthReport({
            strong: false,
            reason: err.error,
            collisions: reasons,
          });
          return;
        }
        if (res.status === 409) {
          setImportConfigError(err.error || "Duplicate credential collisions detected");
          return;
        }
        throw new Error(err.error || err.message || "Failed to configure imported credentials");
      }

      toast.success("Credential Mapping Saved", "Imported credentials configured successfully.");
      await loadData();
    } catch (err: any) {
      setImportConfigError(err.message || "Failed to configure credentials");
    } finally {
      setIsSavingImport(false);
    }
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

        {/* Ready to launch alert */}
        {portal?.status === "ready" && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
            <div className="text-xs">
              <span className="font-bold text-blue-900 dark:text-blue-100 block">
                Portal is Ready to Launch
              </span>
              <span className="text-blue-700 dark:text-blue-300 block">
                Your credentials have been set up. Click Activate Portal to make this link live for participants.
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => handleActivate(true)}
              className="text-xs font-bold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Activate Portal Now</span>
            </Button>
          </div>
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
              missingOutputCount={preflight?.missingOutputCount || 0}
              fatalBlockers={(preflight?.blockers || []).filter(
                (b: string) => !/missing generated certificate outputs/i.test(b)
              )}
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
              onChange={(m) => {
                if (m !== (portal.credentialMode || "generated_token")) {
                  setModeSwitchTarget(m);
                }
              }}
              isExistingPortal={portal.status !== "draft"}
            />

            {portal.credentialMode === "generated_token" ? (
              <GeneratedTokenExportPanel
                portalId={portal._id}
                revision={portal.credentialSetRevision || 1}
                status={credentialSetStatus}
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
                  onPrimaryChange={(f) => {
                    setPrimaryFieldKey(f);
                    setImportConfigError(null);
                    setWeakReasons([]);
                  }}
                  onSecondaryChange={(f) => {
                    setSecondaryFieldKey(f);
                    setImportConfigError(null);
                    setWeakReasons([]);
                  }}
                  requiresSecondary={strengthReport && !strengthReport.strong}
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleConfigureImport}
                    disabled={!primaryFieldKey || isSavingImport}
                    size="sm"
                    className="text-xs font-bold gap-2 cursor-pointer"
                  >
                    {isSavingImport && <Spinner size="sm" />}
                    <span>Save Credential Mapping</span>
                  </Button>
                </div>
                {importConfigError && (
                  <Alert variant="error" title="Credential Configuration Error">
                    <p className="text-xs">{importConfigError}</p>
                    {weakReasons.length > 0 && (
                      <ul className="list-disc pl-4 mt-1.5 space-y-0.5 text-xs">
                        {weakReasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </Alert>
                )}
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
            {portal && (
              <ClaimPortalLifecycleControls
                status={portal.status}
                isReady={preflight?.isReady ?? false}
                hasBlockers={(preflight?.blockers?.length ?? 0) > 0}
                missingOutputCount={preflight?.missingOutputCount || 0}
                fatalBlockers={(preflight?.blockers || []).filter(
                  (b: string) => !/missing generated certificate outputs/i.test(b)
                )}
                onActivate={handleActivate}
                onPause={handlePause}
                onResume={handleResume}
                onDisable={handleDisable}
                onClose={handleClose}
              />
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
          <ClaimPortalSettingsPanel
            portal={portal}
            onUpdatePortal={(updatedPortal) => {
              setPortal(updatedPortal);
            }}
          />
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
            setCredentialSetStatus("preparing");
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
              setCredentialSetStatus("preparing");
              await loadData();
            }}
          />
        )}
      </div>
    </PageShell>
  );
}
