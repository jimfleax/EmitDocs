/**
 * @file ImportProgress.tsx
 * @description Progress bar and status indicator for chunked batch spreadsheet ingestion and server validation.
 * @architecture Progress monitoring component shown during step 3 of the batch import wizard.
 * @agent_note Displays chunk counts, uploaded row percentages, and validation spinners during multi-step uploads.
 */

import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { Spinner } from "@/components/ui/Spinner";

interface ImportProgressProps {
  currentChunk: number;
  totalChunks: number;
  uploadedRows: number;
  totalRows: number;
  status: "idle" | "uploading" | "validating" | "completed" | "error";
  errorMessage?: string | null;
}

/**
 * @component ImportProgress
 * @description Renders progress bar, chunk statistics, and status spinners during chunked row upload.
 * @param {ImportProgressProps} props - Component properties.
 * @returns {JSX.Element | null} Progress card or null if status is idle.
 */
export function ImportProgress({
  currentChunk,
  totalChunks,
  uploadedRows,
  totalRows,
  status,
  errorMessage,
}: ImportProgressProps) {
  if (status === "idle") return null;

  const percent =
    totalRows > 0
      ? Math.min(100, Math.round((uploadedRows / totalRows) * 100))
      : 0;

  return (
    <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {status === "uploading" || status === "validating" ? (
            <Spinner size="md" className="shrink-0" />
          ) : status === "completed" ? (
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
          ) : (
            <WarningCircle className="w-5 h-5 text-rose-500 shrink-0" />
          )}

          <div>
            <h4 className="text-sm font-bold text-slate-900">
              {status === "uploading" && `Uploading batch data (${percent}%)`}
              {status === "validating" &&
                "Running authoritative server validation..."}
              {status === "completed" && "Data Ingestion & Validation Complete"}
              {status === "error" && "Import Failed"}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {status === "uploading" &&
                `Processing chunk ${currentChunk} of ${totalChunks} (${uploadedRows.toLocaleString()} / ${totalRows.toLocaleString()} rows)`}
              {status === "completed" &&
                `All ${totalRows.toLocaleString()} records ingested and verified.`}
              {status === "error" && errorMessage}
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-semibold text-slate-600 px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-xs">
          {percent}%
        </span>
      </div>

      <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            status === "error"
              ? "bg-rose-500"
              : status === "completed"
                ? "bg-emerald-500"
                : "bg-blue-500"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
