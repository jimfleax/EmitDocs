/**
 * @file RowEditor.tsx
 * @description Detail editor sidebar for inspecting and modifying single draft record cell values with concurrency locking.
 * @architecture Editor pane inside DraftReviewWorkspace for row-level override mutations.
 * @agent_note Issues PATCH /api/batches/:id/drafts/:rowId with optimistic UI updates and revision-based optimistic concurrency conflict handling.
 */

import { useState } from "react";
import { CheckCircle, Warning, WarningCircle } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { InlineFieldEditor } from "./InlineFieldEditor";
import { toast } from "@/components/ui/toast";
import type { IFieldMapping } from "@/components/templates/mapping/types";

export interface DraftRowItem {
  _id: string;
  sourceRowNumber: number;
  rowKey: string;
  status: "valid" | "invalid";
  effectiveData: Record<string, any>;
  importedData?: Record<string, any>;
  overrides?: Record<string, any>;
  errors: Array<{ field: string; code: string; message: string }>;
  warnings: Array<{
    field?: string;
    code: string;
    message: string;
    referenceRowNumbers?: number[];
  }>;
  isDuplicate: boolean;
  duplicateReferences: number[];
  version: number;
  revision: number;
}

export interface RowEditorProps {
  batchId: string;
  batchRevision: number;
  row: DraftRowItem;
  fieldMappings: IFieldMapping[];
  columnMap?: Record<string, string>;
  onRowUpdated: (updatedRow: DraftRowItem, batchSummary?: any) => void;
  onRefreshBatch?: () => void;
}

/**
 * @component RowEditor
 * @description Detailed inspection and editing form for an individual recipient row and its mapped field values.
 * @param {RowEditorProps} props - Component properties.
 * @returns {JSX.Element} Row editor panel with validation messages and editable cells.
 */
export function RowEditor({
  batchId,
  batchRevision,
  row,
  fieldMappings,
  columnMap = {},
  onRowUpdated,
  onRefreshBatch,
}: RowEditorProps) {
  const [concurrencyConflict, setConcurrencyConflict] = useState<string | null>(
    null,
  );

  const handleSaveField = async (fieldKey: string, newValue: any) => {
    setConcurrencyConflict(null);

    // Optimistic mutation
    const previousRow = { ...row };
    const optimisticOverrides = {
      ...(row.overrides || {}),
      [fieldKey]: newValue,
    };
    const optimisticEffective = {
      ...(row.effectiveData || {}),
      [fieldKey]: newValue,
    };
    const optimisticRow: DraftRowItem = {
      ...row,
      overrides: optimisticOverrides,
      effectiveData: optimisticEffective,
    };
    onRowUpdated(optimisticRow);

    try {
      const res = await fetch(`/api/batches/${batchId}/rows/${row._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          expectedRevision: batchRevision,
          expectedVersion: row.version,
          overrides: { [fieldKey]: newValue },
        }),
      });

      if (res.status === 409) {
        const errData = await res.json();
        const conflictCode = errData.error || "CONCURRENT_MODIFICATION";
        const msg =
          conflictCode === "STALE_BATCH_REVISION"
            ? "Batch was revised by another process. Please reload to sync."
            : "Row was modified concurrently. Your edit was rolled back.";
        setConcurrencyConflict(msg);
        toast.error("Conflict Detected", msg);
        onRowUpdated(previousRow);
        return;
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save field override");
      }

      const data = await res.json();
      onRowUpdated(data.row, data.batchSummary);
      toast.success("Field saved", `Updated ${fieldKey}`);
    } catch (err: any) {
      onRowUpdated(previousRow);
      toast.error("Error saving field", err.message);
    }
  };

  const handleRevertField = async (fieldKey: string) => {
    setConcurrencyConflict(null);
    const previousRow = { ...row };

    try {
      const res = await fetch(`/api/batches/${batchId}/rows/${row._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          expectedRevision: batchRevision,
          expectedVersion: row.version,
          overrides: { [fieldKey]: null },
        }),
      });

      if (res.status === 409) {
        const msg = "Concurrent modification detected. Please refresh.";
        setConcurrencyConflict(msg);
        toast.error("Conflict Detected", msg);
        onRowUpdated(previousRow);
        return;
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to revert field override");
      }

      const data = await res.json();
      onRowUpdated(data.row, data.batchSummary);
      toast.success("Reverted to original", `Reset ${fieldKey}`);
    } catch (err: any) {
      onRowUpdated(previousRow);
      toast.error("Error reverting field", err.message);
    }
  };

  const errorByField = new Map<string, string>();
  for (const err of row.errors || []) {
    errorByField.set(err.field, err.message);
  }

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold text-sm">
            #{row.sourceRowNumber}
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Row Record</span>
              <span className="text-xs font-mono font-normal text-slate-400">
                ({row.rowKey})
              </span>
            </h4>
            <p className="text-xs text-slate-400">
              Revision {batchRevision} • Version {row.version}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {row.status === "valid" ? (
            <Badge variant="success" size="md">
              <CheckCircle className="w-3.5 h-3.5" />
              Valid
            </Badge>
          ) : (
            <Badge variant="error" size="md">
              <WarningCircle className="w-3.5 h-3.5" />
              Invalid ({row.errors.length})
            </Badge>
          )}

          {row.isDuplicate && (
            <Badge variant="warning" size="md">
              <Warning className="w-3.5 h-3.5" />
              Duplicate
            </Badge>
          )}
        </div>
      </div>

      {/* Concurrency Conflict Alert */}
      {concurrencyConflict && (
        <Alert
          variant="error"
          title="Concurrent Modification Conflict"
          onRetry={onRefreshBatch}
        >
          {concurrencyConflict}
        </Alert>
      )}

      {/* Duplicate Row Alert */}
      {row.isDuplicate && (
        <Alert variant="warning" title="Duplicate Record Preserved">
          This row matches content from row(s):{" "}
          <strong>
            {(row.duplicateReferences || []).map((r) => `#${r}`).join(", ") ||
              "N/A"}
          </strong>
          . Identical drafts are preserved to guarantee complete issuance
          tracking.
        </Alert>
      )}

      {/* Field Editor Stack */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Template Field Mappings ({fieldMappings.length})
          </span>
          <span className="text-xs text-slate-400">Click field to edit</span>
        </div>

        {fieldMappings.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
            No mapped fields defined for this template version.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {fieldMappings.map((f) => {
              const currentVal = row.effectiveData?.[f.key];
              const isOverridden = row.overrides?.[f.key] !== undefined;
              const mappedCol = columnMap[f.key];
              const originalVal = mappedCol
                ? row.importedData?.[mappedCol]
                : row.importedData?.[f.key];
              const err = errorByField.get(f.key);

              return (
                <InlineFieldEditor
                  key={f.id || f.key}
                  fieldKey={f.key}
                  label={f.label || f.key}
                  type={f.type || "text"}
                  value={currentVal}
                  originalValue={originalVal}
                  isOverridden={isOverridden}
                  errorMessage={err}
                  onSave={handleSaveField}
                  onRevert={handleRevertField}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
