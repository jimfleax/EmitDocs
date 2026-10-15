/**
 * @file ResultsWorkspace.tsx
 * @description Master results workspace orchestrating batch generation, live stats, controls, and recipient delivery (PRD-CORE-07).
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FilePdf,
  Hash,
  ClockCountdown,
  Users,
  Copy,
  Check,
  ShieldCheck,
  CaretRight,
  CaretDown,
} from "@phosphor-icons/react";
import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { toast } from "@/components/ui/toast";
import { GenerationProgressCard } from "./GenerationProgressCard";
import { GenerationControls } from "./GenerationControls";
import { RecipientStatusTable } from "./RecipientStatusTable";
import { useBatchGeneratorWorker } from "@/hooks/useBatchGeneratorWorker";

export interface ResultsWorkspaceProps {
  batchId: string;
}

export function ResultsWorkspace({ batchId }: ResultsWorkspaceProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [batch, setBatch] = useState<any>(null);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [, setTemplateVersion] = useState<any>(null);
  const [basePdfBytes, setBasePdfBytes] = useState<Uint8Array | null>(null);

  // Recipient rows
  const [recipients, setRecipients] = useState<any[]>([]);
  const [totalRecipients, setTotalRecipients] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const limit = 100;

  const [copiedDigest, setCopiedDigest] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [showAuditDetails, setShowAuditDetails] = useState(false);
  const [hasStartedGeneration, setHasStartedGeneration] = useState(false);

  const [isStarting, setIsStarting] = useState(false);

  // Worker hook
  const {
    status: workerStatus,
    progress,
    error: workerError,
    warningsMap,
    generatedMap,
    errorsMap,
    initializeWorker,
    generateSingle,
    startBatch,
    pause,
    resume,
    cancel,
  } = useBatchGeneratorWorker();

  // Load Batch & Snapshot
  const loadWorkspaceData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Fetch batch metadata
      const batchRes = await fetch(`/api/batches/${batchId}`, {
        credentials: "include",
      });
      if (!batchRes.ok) throw new Error("Failed to load batch metadata");
      const batchData = await batchRes.json();
      setBatch(batchData.batch);

      // 2. Fetch approved snapshot
      const snapRes = await fetch(`/api/batches/${batchId}/snapshot`, {
        credentials: "include",
      });
      if (!snapRes.ok) {
        throw new Error(
          "No approved snapshot found. Batch must be approved before generating results."
        );
      }
      const snapData = await snapRes.json();
      const activeSnapshot = snapData.snapshot;
      if (!activeSnapshot || activeSnapshot.status !== "ready") {
        throw new Error(
          "No approved snapshot found. Batch must be approved before generating results."
        );
      }
      setSnapshot(activeSnapshot);

      // 3. Fetch template version mappings
      const versionRes = await fetch(
        `/api/templates/${activeSnapshot.templateId}/versions/${activeSnapshot.templateVersionId}`,
        { credentials: "include" }
      );
      if (!versionRes.ok) throw new Error("Failed to fetch template version details");
      const versionData = await versionRes.json();
      const version = versionData.version;
      setTemplateVersion(version);

      // 4. Fetch base template PDF file as arrayBuffer
      const fileRes = await fetch(
        `/api/templates/${activeSnapshot.templateId}/versions/${activeSnapshot.templateVersionId}/file`,
        { credentials: "include" }
      );
      if (!fileRes.ok) throw new Error("Failed to download base template PDF");
      const fileAb = await fileRes.arrayBuffer();
      const bytes = new Uint8Array(fileAb);
      setBasePdfBytes(bytes);

      // 5. Initialize Web Worker
      await initializeWorker(fileAb, version.fieldMappings || []);

      // 6. Fetch approved recipients page 1
      const recRes = await fetch(
        `/api/batches/${batchId}/snapshot/recipients?page=1&limit=${limit}`,
        { credentials: "include" }
      );
      if (recRes.ok) {
        const recData = await recRes.json();
        setRecipients(recData.recipients || []);
        setTotalRecipients(recData.total || activeSnapshot.totalRecipients || 0);
      }
    } catch (err: any) {
      setError(err.message || "Failed to initialize Results workspace");
    } finally {
      setIsLoading(false);
    }
  }, [batchId, initializeWorker]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  // Load paginated recipients
  const handlePageChange = async (newPage: number) => {
    try {
      setPage(newPage);
      const res = await fetch(
        `/api/batches/${batchId}/snapshot/recipients?page=${newPage}&limit=${limit}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setRecipients(data.recipients || []);
      }
    } catch {
      toast.error("Failed to load recipients page");
    }
  };

  // Trigger batch generation
  const handleStartGeneration = async () => {
    try {
      setHasStartedGeneration(true);
      setIsStarting(true);
      let allRecipients: any[] = [];
      let currentPage = 1;
      let totalPages = 1;
      const fetchLimit = 100;

      do {
        const res = await fetch(
          `/api/batches/${batchId}/snapshot/recipients?page=${currentPage}&limit=${fetchLimit}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          throw new Error("Failed to load approved recipients for generation");
        }
        const data = await res.json();
        const pageRecipients = data.recipients || [];
        allRecipients = allRecipients.concat(pageRecipients);
        totalPages =
          typeof data.totalPages === "number"
            ? data.totalPages
            : typeof data.total === "number" && typeof fetchLimit === "number"
              ? Math.ceil(data.total / fetchLimit)
              : 1;
        currentPage++;
      } while (currentPage <= totalPages);

      if (allRecipients.length === 0) {
        toast.warning("No Recipients", "No approved recipients found to generate.");
        return;
      }

      startBatch(allRecipients);
    } catch (err: any) {
      toast.error("Generation Error", err.message || "Failed to load all recipients");
    } finally {
      setIsStarting(false);
    }
  };

  const handleCopyDigest = () => {
    if (!snapshot?.canonicalDigest) return;
    navigator.clipboard.writeText(snapshot.canonicalDigest);
    setCopiedDigest(true);
    toast.success("Digest Copied", "Canonical SHA-256 digest copied to clipboard.");
    setTimeout(() => setCopiedDigest(false), 2000);
  };

  const handleCopyId = () => {
    if (!snapshot?._id) return;
    navigator.clipboard.writeText(snapshot._id);
    setCopiedId(true);
    toast.success("Snapshot ID Copied", "Snapshot ID copied to clipboard.");
    setTimeout(() => setCopiedId(false), 2000);
  };

  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const expirationText = useMemo(() => {
    if (!snapshot?.expiresAt) return "—";
    const diffMs = new Date(snapshot.expiresAt).getTime() - currentTime;
    if (diffMs <= 0) return "Expired";
    const hours = Math.floor(diffMs / (3600 * 1000));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h remaining`;
    return `${hours}h remaining`;
  }, [snapshot, currentTime]);

  const isGenerationVisible =
    hasStartedGeneration ||
    workerStatus === "generating" ||
    workerStatus === "paused" ||
    workerStatus === "completed" ||
    workerStatus === "cancelled" ||
    progress.current > 0;

  const titleSlot = (
    <div className="flex flex-wrap items-center gap-2.5">
      <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
        {batch?.name || "Results & Delivery"}
      </h1>
      <Badge variant="success" size="md" shape="pill" mono>
        Approved Snapshot
      </Badge>
    </div>
  );

  const subtitleSlot = (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      <span className="text-xs text-slate-500 dark:text-slate-400">
        On-demand deterministic PDF generation with instant preview &amp; single recipient delivery.
      </span>
    </div>
  );

  return (
    <PageShell
      title={titleSlot}
      subtitle={subtitleSlot}
      backTo={`/app/batches/${batchId}/review`}
      backLabel="Back to Review"
      maxWidth="5xl"
      isLoading={isLoading}
    >
      <div className="space-y-5 pb-12">
        {(error || workerError) && (
          <Alert variant="error" title="Results Stage Error">
            {error && <p>{error}</p>}
            {workerError && <p>{workerError}</p>}
          </Alert>
        )}

        {/* Snapshot Summary Banner */}
        {snapshot && (
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Operational Metrics */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                {/* Total Recipients */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Recipients
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {totalRecipients.toLocaleString()} records
                    </span>
                  </div>
                </div>

                <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-800" />

                {/* Expiration Countdown */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <ClockCountdown className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Retention Expiry
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {expirationText}
                    </span>
                  </div>
                </div>

                <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-800" />

                {/* Template Version */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <FilePdf className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Template
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Version {snapshot.templateVersion || 1}
                    </span>
                  </div>
                </div>
              </div>

              {/* Collapsible Audit Drawer Toggle */}
              <button
                type="button"
                onClick={() => setShowAuditDetails((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors cursor-pointer select-none"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                <span>{showAuditDetails ? "Hide Audit Details" : "Audit Details"}</span>
                {showAuditDetails ? (
                  <CaretDown className="w-3 h-3 text-slate-400" />
                ) : (
                  <CaretRight className="w-3 h-3 text-slate-400" />
                )}
              </button>
            </div>

            {/* Collapsible Audit Details */}
            {showAuditDetails && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Snapshot ID */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Snapshot ID
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5 select-all">
                        {snapshot._id}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors shrink-0 cursor-pointer"
                      title="Copy Snapshot ID"
                    >
                      {copiedId ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Cryptographic SHA-256 Digest */}
                  <div className="md:col-span-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Hash className="w-4 h-4 text-slate-500 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Canonical Snapshot Digest (SHA-256)
                        </span>
                        <code className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate block select-all mt-0.5">
                          {snapshot.canonicalDigest}
                        </code>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyDigest}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors shrink-0 cursor-pointer"
                      title="Copy SHA-256 digest"
                    >
                      {copiedDigest ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress Card (hidden until batch generation is started) */}
        {isGenerationVisible && (
          <GenerationProgressCard
            current={progress.current}
            total={progress.total || totalRecipients}
            percent={progress.percent}
            itemsPerSec={progress.itemsPerSec}
            etaSeconds={progress.etaSeconds}
            warningsCount={progress.warningsCount}
            status={workerStatus}
          />
        )}

        {/* Controls */}
        <GenerationControls
          status={workerStatus}
          onStart={handleStartGeneration}
          onPause={pause}
          onResume={resume}
          onCancel={cancel}
          disabled={isLoading || isStarting || !basePdfBytes}
          totalRecipients={totalRecipients}
        />

        {/* Recipient Status Table */}
        <RecipientStatusTable
          recipients={recipients}
          generatedMap={generatedMap}
          warningsMap={warningsMap}
          errorsMap={errorsMap}
          onGenerateSingle={generateSingle}
          totalCount={totalRecipients}
          page={page}
          limit={limit}
          onPageChange={handlePageChange}
          isLoading={isLoading}
        />
      </div>
    </PageShell>
  );
}
