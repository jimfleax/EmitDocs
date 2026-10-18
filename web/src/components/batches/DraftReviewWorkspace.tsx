/**
 * @file DraftReviewWorkspace.tsx
 * @description Master-detail review studio allowing certificate reviewers to inspect drafts, edit row fields, and trigger batch generation.
 * @architecture Central review coordinator linking DraftGallery with live RecipientPreviewPanel and RowEditor.
 * @agent_note Fetches batch, template, and PDF binary assets; toggles between preview and inline editor panels; and manages reimport flows.
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Eye,
  PencilSimple,
  ArrowClockwise,
  Check,
  ArrowRight,
} from "@phosphor-icons/react";
import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/Badge";
import { DraftGallery } from "./DraftGallery";
import { RecipientPreviewPanel } from "./RecipientPreviewPanel";
import { RowEditor, type DraftRowItem } from "./RowEditor";
import { ReimportModal } from "./ReimportModal";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { DraftReviewSkeleton } from "@/components/skeletons/DraftReviewSkeleton";

export interface DraftReviewWorkspaceProps {
  batchId: string;
}

/**
 * @component DraftReviewWorkspace
 * @description Master-detail workspace for inspecting, editing, overriding, and approving draft records prior to document issuance.
 * @param {DraftReviewWorkspaceProps} props - Component properties.
 * @param {string} props.batchId - Target batch ID for draft review.
 * @state {any} batch - Batch document loaded from backend.
 * @state {any} template - Template entity associated with the batch.
 * @state {any} templateVersion - Active version configuration and field mappings.
 * @state {Uint8Array | null} sourcePdfBytes - Binary array of template PDF asset.
 * @state {boolean} isLoading - Loading state during initial batch and PDF download.
 * @state {string | null} error - Error message string if data retrieval fails.
 * @state {DraftRowItem | null} selectedRow - Currently selected draft row for preview/editing.
 * @state {"preview" | "edit"} rightPanelMode - Mode toggle between canvas PDF preview and inline row editor.
 * @state {number} refreshTrigger - Counter triggering child list refetch after edits.
 * @state {boolean} isReimportModalOpen - Visibility of the reimport spreadsheet modal.
 * @api {GET} /api/batches/:batchId - Fetches batch details and template configuration.
 * @api {GET} /api/templates/:templateId/versions/:version - Fetches template version details.
 * @returns {JSX.Element} Review interface with left draft list and right-hand preview/editor pane.
 */
export function DraftReviewWorkspace({ batchId }: DraftReviewWorkspaceProps) {
  const navigate = useNavigate();
  const [batch, setBatch] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [templateVersion, setTemplateVersion] = useState<any>(null);
  const [sourcePdfBytes, setSourcePdfBytes] = useState<Uint8Array | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRow, setSelectedRow] = useState<DraftRowItem | null>(null);
  const [rightPanelMode, setRightPanelMode] = useState<"preview" | "edit">(
    "preview",
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isReimportModalOpen, setIsReimportModalOpen] = useState(false);

  // Load batch metadata and PDF bytes
  const loadBatchDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(`/api/batches/${batchId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load batch metadata");

      const data = await res.json();
      setBatch(data.batch);
      setTemplate(data.template);
      setTemplateVersion(data.templateVersion);

      if (data.templateVersion) {
        const fileRes = await fetch(
          `/api/templates/${data.templateVersion.templateId}/versions/${data.templateVersion._id}/file`,
          { credentials: "include" },
        );
        if (fileRes.ok) {
          const ab = await fileRes.arrayBuffer();
          setSourcePdfBytes(new Uint8Array(ab));
        }
      }
    } catch (err: any) {
      setError(err.message || "Error loading review workspace");
    } finally {
      setIsLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const res = await fetch(`/api/batches/${batchId}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load batch metadata");

        const data = await res.json();
        if (!isMounted) return;

        setBatch(data.batch);
        setTemplate(data.template);
        setTemplateVersion(data.templateVersion);

        if (data.templateVersion) {
          const fileRes = await fetch(
            `/api/templates/${data.templateVersion.templateId}/versions/${data.templateVersion._id}/file`,
            { credentials: "include" },
          );
          if (fileRes.ok && isMounted) {
            const ab = await fileRes.arrayBuffer();
            if (isMounted) {
              setSourcePdfBytes(new Uint8Array(ab));
            }
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Error loading review workspace");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [batchId]);

  const handleRowUpdated = (updatedRow: DraftRowItem, batchSummary?: any) => {
    setSelectedRow(updatedRow);
    if (batchSummary) {
      setBatch((prev: any) => ({
        ...prev,
        ...batchSummary,
      }));
    }
    setRefreshTrigger((n) => n + 1);
  };

  const handleReconciled = () => {
    loadBatchDetails();
    setRefreshTrigger((n) => n + 1);
  };

  const handleApproveBatch = () => {
    if (!batch || (batch.validRows === 0 && batch.totalRows > 0)) {
      toast.warning(
        "No Valid Rows",
        "At least one valid recipient is required to approve the batch."
      );
      return;
    }
    navigate({
      to: "/app/batches/$batchId/approve",
      params: { batchId },
    });
  };

  const titleSlot = (
    <div className="flex flex-wrap items-center gap-2.5">
      <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
        {batch?.name || "Draft Review"}
      </h1>
      {batch && (
        <Badge variant="primary" size="md" shape="pill" mono>
          Rev {batch.currentImportRevision}
        </Badge>
      )}
    </div>
  );

  const subtitleSlot = (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      <span className="text-xs text-slate-400">
        Template:{" "}
        <strong className="text-slate-600 dark:text-slate-300">
          {template?.name || "Default"}
        </strong>
      </span>
      {batch && (
        <>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <Badge variant="neutral" size="sm">
            {batch.totalRows?.toLocaleString()} Total
          </Badge>
          <Badge variant="success" size="sm">
            {batch.validRows?.toLocaleString()} Valid
          </Badge>
          {batch.invalidRows > 0 && (
            <Badge variant="error" size="sm">
              {batch.invalidRows?.toLocaleString()} Invalid
            </Badge>
          )}
          {batch.duplicateRows > 0 && (
            <Badge variant="warning" size="sm">
              {batch.duplicateRows?.toLocaleString()} Duplicates
            </Badge>
          )}
        </>
      )}
    </div>
  );

  const isApproved =
    batch?.status === "approved" ||
    batch?.status === "ready_for_download" ||
    batch?.status === "generating" ||
    batch?.status === "paused";

  const actionsSlot = (
    <div className="flex items-center gap-2">
      {!isApproved && (
        <button
          type="button"
          onClick={() => setIsReimportModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-xs transition-colors cursor-pointer select-none"
        >
          <ArrowClockwise className="w-3.5 h-3.5" />
          Re-import Spreadsheet
        </button>
      )}

      {isApproved ? (
        <button
          type="button"
          onClick={() => navigate({ to: `/app/batches/${batchId}/results` })}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold shadow-xs shadow-blue-500/20 transition-all select-none bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white cursor-pointer active:scale-[0.98]"
        >
          <span>View Results & Generation</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleApproveBatch}
          disabled={!batch || batch.validRows === 0}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all select-none",
            batch && batch.validRows > 0
              ? "bg-slate-950 dark:bg-slate-100 hover:bg-slate-900 text-white dark:text-slate-950 cursor-pointer active:scale-[0.98]"
              : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed",
          )}
        >
          <Check className="w-4 h-4" />
          Approve Batch
        </button>
      )}
    </div>
  );

  return (
    <PageShell
      title={titleSlot}
      subtitle={subtitleSlot}
      backTo="/app"
      backLabel="Back to batches"
      actions={actionsSlot}
      maxWidth="full"
      isLoading={isLoading}
      skeleton={<DraftReviewSkeleton />}
    >
      {error ? (
        <div className="p-8 text-center text-rose-600 text-sm font-semibold">
          {error}
        </div>
      ) : (
        <>
          {isApproved && (
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/80 text-emerald-950 text-xs shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <div>
                  <p className="font-bold text-emerald-900">
                    Batch Approved & Sealed into Immutable Snapshot
                  </p>
                  <p className="text-emerald-700 text-[11px] mt-0.5">
                    This batch has been signed off. You can preview single recipients, run Web Worker generation, and download PDFs on the Results page.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate({ to: `/app/batches/${batchId}/results` })}
                className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-xs shrink-0 cursor-pointer select-none"
              >
                <span>Go to Results</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Draft Gallery (5 cols) */}
          <div className="lg:col-span-5 h-[calc(100vh-225px)] min-h-[500px]">
            <DraftGallery
              batchId={batchId}
              selectedRowId={selectedRow?._id || null}
              onSelectRow={setSelectedRow}
              refreshTrigger={refreshTrigger}
            />
          </div>

          {/* Right Column: Preview & Inspector (7 cols) */}
          <div className="lg:col-span-7 h-[calc(100vh-225px)] min-h-[500px] flex flex-col space-y-3 lg:sticky lg:top-4">
            {/* View Mode Switcher */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl shadow-xs shrink-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRightPanelMode("preview")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none",
                    rightPanelMode === "preview"
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
                  )}
                >
                  <Eye className="w-3.5 h-3.5" />
                  PDF Preview
                </button>

                <button
                  type="button"
                  onClick={() => setRightPanelMode("edit")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none",
                    rightPanelMode === "edit"
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
                  )}
                >
                  <PencilSimple className="w-3.5 h-3.5" />
                  Edit Fields & Overrides
                </button>
              </div>

              {selectedRow && (
                <span className="text-xs text-slate-400 px-2 font-mono">
                  Row #{selectedRow.sourceRowNumber} selected
                </span>
              )}
            </div>

            {/* Main Panel Viewport */}
            <div
              className={cn(
                "flex-1 min-h-0",
                rightPanelMode === "preview"
                  ? "flex flex-col"
                  : "overflow-y-auto pr-1",
              )}
            >
              {rightPanelMode === "preview" ? (
                <RecipientPreviewPanel
                  batch={batch}
                  templateVersion={templateVersion}
                  sourcePdfBytes={sourcePdfBytes}
                  selectedRow={selectedRow}
                  hasPrev={Boolean(
                    selectedRow && selectedRow.sourceRowNumber > 1,
                  )}
                  hasNext={Boolean(
                    selectedRow &&
                    batch &&
                    selectedRow.sourceRowNumber < batch.totalRows,
                  )}
                />
              ) : selectedRow ? (
                <RowEditor
                  batchId={batchId}
                  batchRevision={batch?.currentImportRevision || 1}
                  row={selectedRow}
                  fieldMappings={templateVersion?.fieldMappings || []}
                  onRowUpdated={handleRowUpdated}
                  onRefreshBatch={loadBatchDetails}
                />
              ) : (
                <div className="p-12 text-center text-xs text-slate-400">
                  Select a row on the left to edit fields.
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    )}

      {/* Re-import Modal */}
      {isReimportModalOpen && (
        <ReimportModal
          isOpen={isReimportModalOpen}
          onClose={() => setIsReimportModalOpen(false)}
          batchId={batchId}
          templateVersion={templateVersion}
          currentRevision={batch?.currentImportRevision || 1}
          onReconciled={handleReconciled}
        />
      )}
    </PageShell>
  );
}
