/**
 * @file ReimportModal.tsx
 * @description Multi-step modal wizard for replacing or updating batch spreadsheet data while reconciling existing edits.
 * @architecture Orchestrating modal dialog for non-destructive data re-ingestion and conflict resolution.
 * @agent_note Guides users through 4 steps: upload file, map columns & reconciliation key, review diff, and resolve conflicting manual overrides.
 */

import { useState } from "react";
import { X, ArrowRight, ArrowLeft, GitMerge } from "@phosphor-icons/react";
import { DataFilePicker } from "./DataFilePicker";
import { ColumnMappingTable } from "./ColumnMappingTable";
import { ReimportDiffReview } from "./ReimportDiffReview";
import {
  MatchResolutionTable,
  type AmbiguousDecision,
} from "./MatchResolutionTable";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { ParsedSpreadsheetResult } from "@/lib/spreadsheet/spreadsheet-parser";
import type { ReimportDiffResult } from "@/types/diff";

export interface ReimportModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId: string;
  templateVersion: any;
  currentRevision: number;
  onReconciled: () => void;
}

/**
 * @component ReimportModal
 * @description Step-by-step modal for uploading an updated spreadsheet and reconciling changes against manual overrides.
 * @param {ReimportModalProps} props - Component properties.
 * @param {boolean} props.isOpen - Whether modal is visible.
 * @param {() => void} props.onClose - Modal close handler.
 * @param {string} props.batchId - Target batch ID.
 * @param {any} props.templateVersion - Bound template version and mappings.
 * @param {number} props.currentRevision - Current batch import revision counter.
 * @param {() => void} props.onReconciled - Success callback invoked after reconciliation completes.
 * @state {1 | 2 | 3 | 4} step - Active modal step (1: upload, 2: map, 3: diff review, 4: conflict resolution).
 * @state {ParsedSpreadsheetResult | null} parsedResult - Re-uploaded spreadsheet parsed data.
 * @state {string | null} newImportId - Newly initiated import session identifier.
 * @state {Record<string, string>} columnMap - Column mapping configuration for re-imported file.
 * @state {string} reconciliationKey - Unique identifier column used for record alignment.
 * @state {ReimportDiffResult | null} diffResult - Calculated diff between existing rows and new file rows.
 * @api {POST} /api/batches/:batchId/imports - Initializes a new import session for the re-uploaded file.
 * @api {POST} /api/batches/:batchId/reimport-diff - Computes row additions, removals, and modifications.
 * @api {POST} /api/batches/:batchId/reconcile - Commits reconciliation decisions and updates batch revision.
 * @returns {JSX.Element | null} Modal dialog overlay or null when closed.
 */
export function ReimportModal({
  isOpen,
  onClose,
  batchId,
  templateVersion,
  currentRevision,
  onReconciled,
}: ReimportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [parsedResult, setParsedResult] =
    useState<ParsedSpreadsheetResult | null>(null);
  const [newImportId, setNewImportId] = useState<string | null>(null);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [reconciliationKey, setReconciliationKey] = useState<string>(
    templateVersion?.fieldMappings?.[0]?.key || "studentId",
  );

  const [diffResult, setDiffResult] = useState<ReimportDiffResult | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [isSubmittingReconcile, setIsSubmittingReconcile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<
    string | undefined
  >();

  // Resolutions
  const [conflictDecisions, setConflictDecisions] = useState<
    Record<string, "keep_override" | "use_new_imported">
  >({});
  const [ambiguousDecisions, setAmbiguousDecisions] = useState<
    Record<string, AmbiguousDecision>
  >({});
  const [carryForwardOverrides, setCarryForwardOverrides] =
    useState<boolean>(true);

  if (!isOpen) return null;

  const fieldMappings = templateVersion?.fieldMappings || [];

  // Step 1: Upload file and ingest chunks into new revision
  const handleFileParsed = async (
    result: ParsedSpreadsheetResult,
    fileMeta: { name: string; size: number; type: string },
  ) => {
    try {
      setIsUploading(true);
      setParsedResult(result);
      setUploadProgressText("Initializing re-import session...");

      // Create new import revision
      const initRes = await fetch(`/api/batches/${batchId}/imports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sourceFileName: fileMeta?.name || "spreadsheet",
          sourceFileSize: fileMeta?.size ?? 0,
          worksheetName: result.selectedWorksheet,
          availableWorksheets: result.availableWorksheets,
          rawHeaders: result.rawHeaders,
          disambiguatedHeaders: result.disambiguatedHeaders,
          columnMap: {},
        }),
      });
      if (!initRes.ok) throw new Error("Failed to create re-import session");
      const initData = await initRes.json();
      const importId = initData.batchImport._id;
      setNewImportId(importId);

      // Chunked upload
      const rows = result.rows;
      const CHUNK_SIZE = 500;
      const totalChunks = Math.ceil(rows.length / CHUNK_SIZE);

      for (let i = 0; i < totalChunks; i++) {
        setUploadProgressText(`Uploading chunk ${i + 1} of ${totalChunks}...`);
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, rows.length);
        const chunkRows = rows.slice(start, end).map((r, idx) => ({
          sourceRowNumber: result.dataStartRowIndex + start + idx + 1,
          rowKey: `row_${result.dataStartRowIndex + start + idx + 1}`,
          importedData: r,
        }));

        const chunkId = `${importId}_chunk_${i}`;
        const chunkRes = await fetch(
          `/api/batches/${batchId}/imports/${importId}/rows`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              chunkId,
              chunkIndex: i,
              totalChunks,
              rows: chunkRows,
            }),
          },
        );
        if (!chunkRes.ok) throw new Error(`Chunk ${i + 1} upload failed`);
      }

      // Finalize raw chunks
      setUploadProgressText("Validating spreadsheet rows...");
      const finalizeRes = await fetch(
        `/api/batches/${batchId}/imports/${importId}/finalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            totalExpectedRows: rows.length,
            totalExpectedChunks: totalChunks,
          }),
        },
      );
      if (!finalizeRes.ok) {
        const errJson = await finalizeRes.json().catch(() => ({}));
        throw new Error(
          errJson.error?.message ||
            errJson.error ||
            "Failed to finalize raw chunk upload",
        );
      }

      toast.success(
        "Spreadsheet uploaded",
        "Spreadsheet data processed. Map columns to proceed.",
      );
      setStep(2);
    } catch (err: any) {
      toast.error("Import Failed", err.message);
    } finally {
      setIsUploading(false);
      setUploadProgressText(undefined);
    }
  };

  // Step 2 -> 3: Compute diff
  const handleProceedToDiff = async () => {
    if (!newImportId) return;

    try {
      setIsLoadingDiff(true);

      // Update mapping first
      await fetch(`/api/batches/${batchId}/imports/${newImportId}/mapping`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ columnMap }),
      });

      // Calculate diff
      const diffRes = await fetch(
        `/api/batches/${batchId}/reimports/${newImportId}/diff?reconciliationKey=${reconciliationKey}`,
        { credentials: "include" },
      );
      if (!diffRes.ok) throw new Error("Failed to compute revision diff");

      const diff = await diffRes.json();
      setDiffResult(diff);
      setStep(3);
    } catch (err: any) {
      toast.error("Diff Computation Failed", err.message);
    } finally {
      setIsLoadingDiff(false);
    }
  };

  // Step 3 -> 4 / Reconcile
  const handleNextFromDiff = () => {
    if (
      diffResult &&
      (diffResult.conflicted.length > 0 || diffResult.ambiguous.length > 0)
    ) {
      setStep(4);
    } else {
      handleFinalReconciliation();
    }
  };

  // Reconcile API Seam
  const handleFinalReconciliation = async () => {
    if (!newImportId) return;

    try {
      setIsSubmittingReconcile(true);

      const formattedConflicts = Object.entries(conflictDecisions).map(
        ([key, resolution]) => {
          const [newRowId, field] = key.split(":");
          return { newRowId, field, resolution };
        },
      );

      const formattedAmbiguous = Object.values(ambiguousDecisions);

      const res = await fetch(
        `/api/batches/${batchId}/reimports/${newImportId}/reconcile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            reconciliationKey,
            resolutions: {
              conflicts: formattedConflicts,
              ambiguous: formattedAmbiguous,
              carryForwardOverrides,
            },
          }),
        },
      );

      if (!res.ok) throw new Error("Reconciliation failed");

      toast.success("Spreadsheet Reconciled", "Batch updated to new revision.");
      onReconciled();
      onClose();
    } catch (err: any) {
      toast.error("Reconciliation Failed", err.message);
    } finally {
      setIsSubmittingReconcile(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Re-import Spreadsheet (Revision {currentRevision + 1})
              </h3>
              <p className="text-xs text-slate-400">Step {step} of 4</p>
            </div>
          </div>

          <button
            type="button"
            disabled={isUploading}
            onClick={isUploading ? undefined : onClose}
            className={cn(
              "p-2 rounded-xl text-slate-400 transition-colors",
              isUploading
                ? "opacity-30 cursor-not-allowed"
                : "hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:bg-slate-800",
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Upload revised XLSX or CSV spreadsheet. Differences against
                current Revision {currentRevision} will be computed.
              </p>
              <DataFilePicker
                onParsed={handleFileParsed}
                isLoading={isUploading}
                loadingText={uploadProgressText}
              />
            </div>
          )}

          {step === 2 && parsedResult && (
            <div className="space-y-4">
              {/* Unique Key Selector */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                  Select Reconciliation Primary Key
                </label>
                <p className="text-[11px] text-slate-400">
                  Unique identifier used to match records between revisions
                  (e.g. Student ID, Email).
                </p>
                <select
                  value={reconciliationKey}
                  onChange={(e) => setReconciliationKey(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold"
                >
                  {fieldMappings.map((f: any) => (
                    <option key={f.key} value={f.key}>
                      {f.label || f.key} ({f.key})
                    </option>
                  ))}
                </select>
              </div>

              {/* Column Mapping Table */}
              <ColumnMappingTable
                fields={fieldMappings}
                availableHeaders={parsedResult.disambiguatedHeaders}
                columnMap={columnMap}
                onChangeMapping={setColumnMap}
              />
            </div>
          )}

          {step === 3 && diffResult && (
            <ReimportDiffReview
              diff={diffResult}
              reconciliationKey={reconciliationKey}
            />
          )}

          {step === 4 && diffResult && (
            <MatchResolutionTable
              conflictedItems={diffResult.conflicted}
              ambiguousItems={diffResult.ambiguous}
              availableOldRows={[]}
              conflictDecisions={conflictDecisions}
              onSetConflictDecision={(k, v) =>
                setConflictDecisions((prev) => ({ ...prev, [k]: v }))
              }
              ambiguousDecisions={ambiguousDecisions}
              onSetAmbiguousDecision={(id, dec) =>
                setAmbiguousDecisions((prev) => ({ ...prev, [id]: dec }))
              }
              carryForwardOverrides={carryForwardOverrides}
              onToggleCarryForward={setCarryForwardOverrides}
            />
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50/80 dark:bg-slate-950/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as any)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          ) : (
            <div />
          )}

          {step === 2 && (
            <button
              type="button"
              onClick={handleProceedToDiff}
              disabled={isLoadingDiff}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold cursor-pointer shadow-sm shadow-blue-500/20 transition-all"
            >
              {isLoadingDiff ? <Spinner size="sm" variant="current" /> : null}
              Calculate Revision Diff
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              onClick={handleNextFromDiff}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold cursor-pointer shadow-sm shadow-blue-500/20 transition-all"
            >
              {diffResult &&
              (diffResult.conflicted.length > 0 ||
                diffResult.ambiguous.length > 0)
                ? "Resolve Conflicts & Ambiguities"
                : "Apply Reconciliation"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === 4 && (
            <button
              type="button"
              onClick={handleFinalReconciliation}
              disabled={isSubmittingReconcile}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-sm"
            >
              {isSubmittingReconcile ? (
                <Spinner size="sm" variant="current" />
              ) : null}
              Finalize & Update Batch
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
