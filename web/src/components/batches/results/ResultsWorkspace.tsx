/**
 * @file ResultsWorkspace.tsx
 * @description Master results workspace orchestrating batch generation, live stats, controls, and recipient delivery (PRD-CORE-07).
 * @architecture Feature container managing the client-side PDF rendering worker, streaming ZIP packaging, and recipient inspection.
 * @agent_note Coordinates Web Worker generation lifecycle via useBatchGeneratorWorker, volume partitioning, and blob downloads.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "@tanstack/react-router";
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
  ShareNetwork,
  ArrowRight,
} from "@phosphor-icons/react";
import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { toast } from "@/components/ui/toast";
import { GenerationProgressCard } from "./GenerationProgressCard";
import { GenerationControls } from "./GenerationControls";
import { RecipientStatusTable } from "./RecipientStatusTable";
import { StreamingZipControls } from "./StreamingZipControls";
import { StreamingProgressModal } from "./StreamingProgressModal";
import type { BatchVolumeInfo } from "@/lib/pdf-engine/volume-partitioner";
import { formatBytes } from "@/lib/pdf-engine/volume-partitioner";
import { useBatchGeneratorWorker } from "@/hooks/useBatchGeneratorWorker";
import { ExpiryCountdownBadge } from "./ExpiryCountdownBadge";
import { ExpiredBatchNotice } from "./ExpiredBatchNotice";

export interface ResultsWorkspaceProps {
  batchId: string;
}

/**
 * @component ResultsWorkspace
 * @description Main results view coordinating Web Worker PDF generation, live progress tracking, ZIP export, and recipient tables.
 * @param {ResultsWorkspaceProps} props - Component properties.
 * @param {string} props.batchId - Unique batch identifier.
 * @state {boolean} isLoading - Loading state during initial snapshot and template version fetch.
 * @state {string | null} error - Error message string if data retrieval or worker init fails.
 * @state {any} batch - Batch document entity.
 * @state {any} snapshot - Sealed immutable snapshot data.
 * @state {any} templateVersion - Active template version and layout schema.
 * @state {Uint8Array | null} basePdfBytes - Binary array of base template PDF loaded for rendering.
 * @state {any[]} recipients - Current page of approved recipients.
 * @state {number} totalRecipients - Total recipient count in the approved snapshot.
 * @state {number} page - Active recipient table page index.
 * @state {boolean} copiedDigest - Feedback state for canonical digest clipboard copy.
 * @state {boolean} copiedId - Feedback state for batch ID clipboard copy.
 * @state {boolean} showAuditDetails - Toggle state for expanding cryptographic verification details.
 * @state {boolean} hasStartedGeneration - Tracking flag for whether generation has been kicked off.
 * @state {boolean} isStarting - Loading flag during initial base PDF fetch and worker spin-up.
 * @api {GET} /api/batches/:batchId - Fetches batch metadata.
 * @api {GET} /api/batches/:batchId/snapshot - Retrieves frozen immutable snapshot.
 * @api {GET} /api/templates/:templateId/versions/:version - Retrieves locked template version and layout schema.
 * @api {GET} /api/batches/:batchId/recipients - Retrieves paginated approved recipient records.
 * @returns {JSX.Element} Results dashboard wrapped in PageShell with generation controls and download tools.
 */
export function ResultsWorkspace({ batchId }: ResultsWorkspaceProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [batch, setBatch] = useState<any>(null);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [templateVersion, setTemplateVersion] = useState<any>(null);
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
  const [isExpired, setIsExpired] = useState(false);

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
    isZipping,
    zipProgress,
    startZipExport,
    cancelZipExport,
  } = useBatchGeneratorWorker({ isExpired });

  const [currentZippingVolume, setCurrentZippingVolume] = useState<number | undefined>(undefined);
  const [currentZippingFilename, setCurrentZippingFilename] = useState<string>("documents.zip");
  const [currentZippingLabel, setCurrentZippingLabel] = useState<string>("");

  const handleDownloadVolume = async (volume: BatchVolumeInfo) => {
    let fileHandleOrWritable: any = null;

    if (
      typeof window !== "undefined" &&
      "showSaveFilePicker" in window &&
      typeof (window as any).showSaveFilePicker === "function"
    ) {
      try {
        fileHandleOrWritable = await (window as any).showSaveFilePicker({
          suggestedName: volume.filename,
          types: [
            {
              description: "ZIP Archive",
              accept: { "application/zip": [".zip"] },
            },
          ],
        });
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return;
        }
        toast.error("ZIP Export Error", err.message || "Failed to open save file picker");
        return;
      }
    }

    try {
      setCurrentZippingVolume(volume.volumeIndex);
      setCurrentZippingFilename(volume.filename);
      setCurrentZippingLabel(volume.label);

      let volumeRecipients: any[] = [];
      const fetchLimit = 100;
      const startPage = Math.floor(volume.startIndex / fetchLimit) + 1;
      const endPage = Math.ceil(volume.endIndex / fetchLimit);

      for (let p = startPage; p <= endPage; p++) {
        const res = await fetch(
          `/api/batches/${batchId}/snapshot/recipients?page=${p}&limit=${fetchLimit}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          throw new Error(`Failed to load recipients for volume ${volume.volumeIndex}`);
        }
        const data = await res.json();
        const pageRecipients = data.recipients || [];
        volumeRecipients = volumeRecipients.concat(pageRecipients);
      }

      const pageOffset = (startPage - 1) * fetchLimit;
      const sliceStart = volume.startIndex - pageOffset;
      const sliceEnd = sliceStart + volume.documentCount;
      const targetRecipients = volumeRecipients.slice(sliceStart, sliceEnd);

      if (targetRecipients.length === 0) {
        toast.warning("No Recipients", "No recipients found for this volume partition.");
        return;
      }

      const result = await startZipExport(
        targetRecipients,
        volume.volumeIndex,
        volume.totalVolumes,
        volume.filename,
        fileHandleOrWritable
      );

      if (result.success) {
        const failureDetails =
          result.failedCount && result.failedCount > 0
            ? ` (${result.failedCount} failed: ${result.failedRecipientKeys?.join(", ") || ""})`
            : "";
        toast.success(
          "Download Complete",
          `Successfully packaged ${result.totalBytes ? formatBytes(result.totalBytes) : ""} into ${volume.filename}.${failureDetails}`
        );
      }
    } catch (err: any) {
      toast.error("ZIP Export Error", err.message || "Failed to download ZIP volume");
    } finally {
      setCurrentZippingVolume(undefined);
    }
  };

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

      if (
        batchData.batch.status === "expired" ||
        (batchData.batch.expiresAt && new Date() >= new Date(batchData.batch.expiresAt))
      ) {
        setIsExpired(true);
        setIsLoading(false);
        return;
      }

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
      if (recRes.status === 410) {
        setIsExpired(true);
        toast.warning("Batch Expired", "This batch has passed its retention window. Recipient data has been pruned.");
        return;
      }
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
      if (res.status === 410) {
        setIsExpired(true);
        toast.warning("Batch Expired", "This batch has passed its retention window.");
        return;
      }
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

  // Keep the volume plan stable across part downloads: derive boundaries
  // strictly from stable inputs (template size, field count) so generatedMap changes cannot shift startIndex or endIndex.
  const samplePdfSizes = useMemo<number[]>(() => [], []);

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
      {isExpired ? (
        <Badge variant="error" size="md" shape="pill" mono>
          Expired
        </Badge>
      ) : (
        <Badge variant="success" size="md" shape="pill" mono>
          Approved Snapshot
        </Badge>
      )}
      <ExpiryCountdownBadge expiresAt={batch?.expiresAt || snapshot?.expiresAt} />
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
      actions={
        snapshot && !isExpired ? (
          <Link
            to={`/app/batches/${batchId}/claim-portal` as any}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer select-none"
          >
            <ShareNetwork className="w-3.5 h-3.5" weight="bold" />
            <span>Claim Portal</span>
          </Link>
        ) : undefined
      }
      maxWidth="5xl"
      isLoading={isLoading}
    >
      <div className="space-y-5 pb-12">
        {isExpired && (
          <ExpiredBatchNotice
            expiresAt={batch?.expiresAt || snapshot?.expiresAt}
            totalRecipients={totalRecipients || batch?.totalRows}
          />
        )}

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

        {/* Certificate Claim Portal Banner (PRD-CORE-11) */}
        {snapshot && !isExpired && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-blue-50/50 to-slate-50 dark:from-indigo-950/40 dark:via-blue-950/20 dark:to-slate-900 border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ShareNetwork className="w-5 h-5" weight="bold" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Self-Service Certificate Claim Portal
                  </h3>
                  <Badge variant="primary" size="sm">Online Distribution</Badge>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl">
                  Share certificates directly with recipients via a public claim link. Issue CSPRNG tokens or verify with existing IDs, enforce Turnstile bot protection, and track claims in real time.
                </p>
              </div>
            </div>

            <Link
              to={`/app/batches/${batchId}/claim-portal` as any}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all shrink-0 cursor-pointer"
            >
              <ShareNetwork className="w-3.5 h-3.5" weight="bold" />
              <span>Configure &amp; Share</span>
              <ArrowRight className="w-3.5 h-3.5" weight="bold" />
            </Link>
          </div>
        )}

        {/* Streaming ZIP Controls (PRD-CORE-08) */}
        {snapshot && (
          <StreamingZipControls
            batchName={batch?.name || "batch"}
            totalRecipients={totalRecipients}
            basePdfBytesLength={basePdfBytes?.byteLength}
            fieldCount={templateVersion?.fieldMappings?.length}
            samplePdfSizes={samplePdfSizes}
            isZipping={isZipping}
            currentZippingVolume={currentZippingVolume}
            currentZipPercent={zipProgress.percent}
            onDownloadVolume={handleDownloadVolume}
            disabled={isExpired || isLoading || isStarting || !basePdfBytes}
          />
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
          disabled={isExpired || isLoading || isStarting || !basePdfBytes}
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

        {/* Streaming Progress Modal (PRD-CORE-08) */}
        <StreamingProgressModal
          isOpen={isZipping}
          progress={zipProgress}
          zipFilename={currentZippingFilename}
          volumeLabel={currentZippingLabel}
          onCancel={cancelZipExport}
        />
      </div>
    </PageShell>
  );
}
