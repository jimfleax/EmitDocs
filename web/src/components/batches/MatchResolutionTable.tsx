/**
 * @file MatchResolutionTable.tsx
 * @description Conflict and ambiguity resolution interface for reconciling differences during spreadsheet re-import.
 * @architecture Review table component presented within the ReimportDiffReview dialog.
 * @agent_note Enables reviewers to choose whether to keep existing manual overrides or accept new imported spreadsheet values.
 */

import type { ConflictedDiffItem, AmbiguousDiffItem } from "@/types/diff";
import { Badge } from "@/components/ui/Badge";

export interface ConflictDecision {
  newRowId: string;
  field: string;
  resolution: "keep_override" | "use_new_imported";
}

export interface AmbiguousDecision {
  newRowId: string;
  action: "match_old" | "create_new" | "discard";
  matchedOldRowId?: string;
}

export interface MatchResolutionTableProps {
  conflictedItems: ConflictedDiffItem[];
  ambiguousItems: AmbiguousDiffItem[];
  availableOldRows: Array<{
    _id: string;
    sourceRowNumber: number;
    rowKey: string;
    preview: string;
  }>;
  conflictDecisions: Record<string, "keep_override" | "use_new_imported">;
  onSetConflictDecision: (
    key: string,
    choice: "keep_override" | "use_new_imported",
  ) => void;
  ambiguousDecisions: Record<string, AmbiguousDecision>;
  onSetAmbiguousDecision: (
    newRowId: string,
    decision: AmbiguousDecision,
  ) => void;
  carryForwardOverrides: boolean;
  onToggleCarryForward: (checked: boolean) => void;
}

/**
 * @component MatchResolutionTable
 * @description Interactive decision table for resolving field collisions and ambiguous rows during re-imports.
 * @param {MatchResolutionTableProps} props - Component properties.
 * @returns {JSX.Element} Conflict resolution choices and table rows.
 */
export function MatchResolutionTable({
  conflictedItems,
  ambiguousItems,
  availableOldRows,
  conflictDecisions,
  onSetConflictDecision,
  ambiguousDecisions,
  onSetAmbiguousDecision,
  carryForwardOverrides,
  onToggleCarryForward,
}: MatchResolutionTableProps) {
  return (
    <div className="space-y-6">
      {/* Global Option: Carry Forward Non-Conflicted Overrides */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Carry Forward Manual Overrides
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Preserve existing manual cell overrides on matched records where new
            spreadsheet values have not changed.
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={carryForwardOverrides}
            onChange={(e) => onToggleCarryForward(e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Enabled
          </span>
        </label>
      </div>

      {/* Conflicted Rows Section */}
      {conflictedItems.length > 0 && (
        <div className="space-y-3">
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <span>Cell Conflicts ({conflictedItems.length})</span>
              <Badge variant="warning" size="sm">
                Action Required
              </Badge>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              These records have both a manual override in the previous review
              AND modified values in the new spreadsheet.
            </p>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            {conflictedItems.map((c) => {
              const itemKey = `${c.newRowId}:${c.field}`;
              const currentChoice =
                conflictDecisions[itemKey] || "keep_override";

              return (
                <div
                  key={itemKey}
                  className="p-3.5 bg-white dark:bg-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                        {c.rowKey}
                      </span>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400 font-mono">
                        field: {c.field}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">
                          Manual Override:
                        </span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {String(c.override)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">
                          New Spreadsheet Value:
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {String(c.newImported)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        onSetConflictDecision(itemKey, "keep_override")
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        currentChoice === "keep_override"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                      }`}
                    >
                      Keep Override
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onSetConflictDecision(itemKey, "use_new_imported")
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        currentChoice === "use_new_imported"
                          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                      }`}
                    >
                      Use Spreadsheet
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ambiguous Records Section */}
      {ambiguousItems.length > 0 && (
        <div className="space-y-3">
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <span>Ambiguous Records ({ambiguousItems.length})</span>
              <Badge variant="error" size="sm">
                No Auto-Match Allowed
              </Badge>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              These records could not be reconciled deterministically due to
              collision or missing key. Select explicit disposition.
            </p>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            {ambiguousItems.map((amb) => {
              const decision = ambiguousDecisions[amb.id] || {
                action: "create_new",
              };

              return (
                <div
                  key={amb.id}
                  className="p-3.5 bg-white dark:bg-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                        Row #{amb.sourceRowNumber} ({amb.rowKey})
                      </span>
                      <Badge variant="error" size="sm">
                        {amb.reason === "COLLISION"
                          ? "Duplicate Key Collision"
                          : amb.reason === "MISSING_KEY"
                            ? "Blank / Missing Key"
                            : "Unmapped Key"}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 font-mono truncate">
                      {JSON.stringify(amb.data)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={decision.action}
                      onChange={(e) => {
                        const act = e.target.value as
                          "create_new" | "match_old" | "discard";
                        onSetAmbiguousDecision(amb.id, {
                          newRowId: amb.id,
                          action: act,
                          matchedOldRowId: decision.matchedOldRowId,
                        });
                      }}
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-semibold cursor-pointer"
                    >
                      <option value="create_new">Create as New Draft</option>
                      <option value="match_old">
                        Match to Existing Old Row
                      </option>
                      <option value="discard">Discard Record</option>
                    </select>

                    {decision.action === "match_old" && (
                      <select
                        value={decision.matchedOldRowId || ""}
                        onChange={(e) => {
                          onSetAmbiguousDecision(amb.id, {
                            ...decision,
                            matchedOldRowId: e.target.value,
                          });
                        }}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-blue-500 bg-white dark:bg-slate-950 font-semibold cursor-pointer"
                      >
                        <option value="">Select old row...</option>
                        {availableOldRows.map((o) => (
                          <option key={o._id} value={o._id}>
                            Row #{o.sourceRowNumber} ({o.preview})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
