/**
 * @file ApprovalWorkspace.tsx
 * @description Master approval workspace for inspecting preflight metrics and freezing immutable snapshots (PRD-CORE-06).
 */

import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle,
  LockKey,
  ArrowRight,
  ShieldCheck,
  Hash,
  ArrowLeft,
} from "@phosphor-icons/react";
import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { toast } from "@/components/ui/toast";
import { ApprovalCountsSummary } from "./ApprovalCountsSummary";
import { TemplateVersionSummary } from "./TemplateVersionSummary";
import { RetentionPresetSelector } from "./RetentionPresetSelector";
import { InvalidRowsNotice } from "./InvalidRowsNotice";
import { ApprovalProgress } from "./ApprovalProgress";

interface ApprovalWorkspaceProps {
  batchId: string;
}

interface PreflightData {
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
  };
  canApprove: boolean;
  batch: {
    id: string;
    name: string;
    version: number;
    status: string;
  };
  templateVersion: {
    id: string;
    version: number;
    mappingHash: string;
    sourceObjectKey?: string;
  };
  importRevision: number;
  retentionPresets: Array<{ hours: number; label: string }>;
}

export function ApprovalWorkspace({ batchId }: ApprovalWorkspaceProps) {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<PreflightData | null>(null);
  const [selectedRetention, setSelectedRetention] = useState<number>(168);
  const [approvedSnapshot, setApprovedSnapshot] = useState<any | null>(null);

  // Fetch preflight metrics
  const loadPreflight = useCallback(async () => {
    try {
      setError(null);

      const res = await fetch(`/api/batches/${batchId}/approval-preflight`, {
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load approval preflight metrics");
      }

      const data: PreflightData = await res.json();
      setPreflight(data);

      // Check if batch already has an active snapshot
      const snapRes = await fetch(`/api/batches/${batchId}/snapshot`, {
        credentials: "include",
      });
      if (snapRes.ok) {
        const snapData = await snapRes.json();
        if (snapData.snapshot && snapData.snapshot.status === "ready") {
          setApprovedSnapshot(snapData.snapshot);
        }
      }
    } catch (err: any) {
      setError(err.message || "Error loading preflight data");
    } finally {
      setIsLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    void loadPreflight();
  }, [loadPreflight]);

  // Execute approval
  const handleApprove = async () => {
    if (!preflight) return;

    try {
      setIsApproving(true);
      setError(null);

      const idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const res = await fetch(`/api/batches/${batchId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          expectedBatchVersion: preflight.batch.version,
          expectedTemplateVersion: preflight.templateVersion.version,
          expectedImportRevision: preflight.importRevision,
          retentionHours: selectedRetention,
          idempotencyKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Approval failed");
      }

      setApprovedSnapshot(data.snapshot);
      toast.success(
        "Batch Approved & Sealed",
        `Created immutable snapshot ${data.snapshot._id.slice(-8)} with ${data.snapshot.totalRecipients} recipients.`
      );
    } catch (err: any) {
      setError(err.message || "Failed to approve batch");
      toast.error("Approval Failed", err.message || "Could not freeze batch revision");
    } finally {
      setIsApproving(false);
    }
  };

  const titleSlot = (
    <div className="flex flex-wrap items-center gap-2.5">
      <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
        {preflight?.batch.name || "Approve Batch"}
      </h1>
      <Badge variant="primary" size="md" shape="pill" mono>
        Approval Stage
      </Badge>
    </div>
  );

  const subtitleSlot = (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      <span className="text-xs text-slate-500 dark:text-slate-400">
        Freeze reviewed template mapping, checksums, and recipient rows into an immutable snapshot.
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
          <Alert variant="error" title="Approval Check Failed">
            {error}
          </Alert>
        )}

        {/* Success View: Snapshot Sealed */}
        {approvedSnapshot ? (
          <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  Snapshot Frozen & Ready
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This batch is locked and protected against mutation.
                </p>
              </div>
              <Badge variant="success" size="md" shape="pill" className="ml-auto">
                Status: Ready
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 mb-6">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Snapshot ID</span>
                <p className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                  {approvedSnapshot._id}
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Sealed Recipients</span>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {approvedSnapshot.totalRecipients?.toLocaleString()} valid records
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Scheduled Expiry</span>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {new Date(approvedSnapshot.expiresAt).toLocaleDateString()} ({approvedSnapshot.retentionHours}h)
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 mb-6 flex items-start gap-2.5">
              <Hash className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                  Cryptographic Canonical Digest (SHA-256)
                </span>
                <code className="text-xs font-mono text-slate-900 dark:text-slate-100 break-all select-all block mt-0.5">
                  {approvedSnapshot.canonicalDigest}
                </code>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Link
                to="/app/batches/$batchId/review"
                params={{ batchId }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Return to Draft Review
              </Link>

              <button
                type="button"
                onClick={() => navigate({ to: "/app" })}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-950 dark:bg-slate-100 text-white dark:text-slate-950 hover:bg-slate-900 text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                View Batches Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          preflight && (
            <>
              {/* Counts Breakdown */}
              <ApprovalCountsSummary
                totalRows={preflight.summary.totalRows}
                validRows={preflight.summary.validRows}
                invalidRows={preflight.summary.invalidRows}
                duplicateRows={preflight.summary.duplicateRows}
              />

              {/* Template & Mapping Info */}
              <TemplateVersionSummary
                templateVersion={preflight.templateVersion}
                importRevision={preflight.importRevision}
              />

              {/* Excluded Rows Notice (if any) */}
              <InvalidRowsNotice
                invalidRows={preflight.summary.invalidRows}
                validRows={preflight.summary.validRows}
              />

              {/* Retention Selector */}
              <RetentionPresetSelector
                presets={preflight.retentionPresets}
                selectedHours={selectedRetention}
                onChange={setSelectedRetention}
                disabled={isApproving}
              />

              {/* Approval Progress Animation */}
              {isApproving && <ApprovalProgress step="staging" />}

              {/* Actions Footer */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Sealing generates an immutable snapshot. Rows cannot be silently altered.</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <Link
                    to="/app/batches/$batchId/review"
                    params={{ batchId }}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    Cancel
                  </Link>

                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={!preflight.canApprove || isApproving}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                      preflight.canApprove && !isApproving
                        ? "bg-slate-950 dark:bg-slate-100 hover:bg-slate-900 text-white dark:text-slate-950 cursor-pointer active:scale-[0.98]"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    <LockKey className="w-4 h-4" />
                    {isApproving ? "Freezing Snapshot..." : "Approve & Seal Snapshot"}
                  </button>
                </div>
              </div>
            </>
          )
        )}
      </div>
    </PageShell>
  );
}
