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

  // Worker hook
  const {
    status: workerStatus,
    progress,
    warningsMap,
    generatedMap,
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
  const handleStartGeneration = () => {
    if (recipients.length === 0) {
      toast.warning("No Recipients", "No approved recipients found to generate.");
      return;
    }
    startBatch(recipients);
  };

  const handleCopyDigest = () => {
    if (!snapshot?.canonicalDigest) return;
    navigator.clipboard.writeText(snapshot.canonicalDigest);
    setCopiedDigest(true);
    toast.success("Digest Copied", "Canonical SHA-256 digest copied to clipboard.");
    setTimeout(() => setCopiedDigest(false), 2000);
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
        {error && (
          <Alert variant="error" title="Results Stage Error">
            {error}
          </Alert>
        )}

        {/* Snapshot Summary Banner */}
        {snapshot && (
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Snapshot ID */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Snapshot ID
                </span>
                <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                  {snapshot._id}
                </span>
              </div>

              {/* Total Recipients */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Total Recipients
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {totalRecipients.toLocaleString()} records
                  </span>
                </div>
              </div>

              {/* Expiration Countdown */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Snapshot Expiry
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <ClockCountdown className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {expirationText}
                  </span>
                </div>
              </div>

              {/* Template Version */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Template Version
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <FilePdf className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Version {snapshot.templateVersion || 1}
                  </span>
                </div>
              </div>
            </div>

            {/* Cryptographic SHA-256 Digest Bar */}
            <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Hash className="w-4 h-4 text-slate-500 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Canonical Snapshot Digest (SHA-256)
                  </span>
                  <code className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate block select-all">
                    {snapshot.canonicalDigest}
                  </code>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyDigest}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shrink-0 cursor-pointer"
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
        )}

        {/* Progress Card */}
        <GenerationProgressCard
          current={progress.current}
          total={progress.total || totalRecipients}
          percent={progress.percent}
          itemsPerSec={progress.itemsPerSec}
          etaSeconds={progress.etaSeconds}
          warningsCount={progress.warningsCount}
          status={workerStatus}
        />

        {/* Controls */}
        <GenerationControls
          status={workerStatus}
          onStart={handleStartGeneration}
          onPause={pause}
          onResume={resume}
          onCancel={cancel}
          disabled={isLoading || !basePdfBytes}
        />

        {/* Recipient Status Table */}
        <RecipientStatusTable
          recipients={recipients}
          generatedMap={generatedMap}
          warningsMap={warningsMap}
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
