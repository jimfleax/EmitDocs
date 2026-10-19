/**
 * @file ApprovalCountsSummary.tsx
 * @description Summary cards displaying row validation counts for batch approval preflight.
 * @architecture Presentation card deck rendered within ApprovalWorkspace to show ingestion and validation totals before freezing.
 * @agent_note Displays four metric tiles: Total Ingested, Valid (Ready to Seal), Invalid (Skipped), and Duplicates.
 */

import {
  CheckCircle,
  Warning,
  WarningCircle,
  Users,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";

interface ApprovalCountsSummaryProps {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
}

/**
 * @component ApprovalCountsSummary
 * @description Metric cards showing total, valid, invalid, and duplicate row breakdowns for preflight approval.
 * @param {ApprovalCountsSummaryProps} props - Component properties.
 * @param {number} props.totalRows - Total number of ingested draft rows.
 * @param {number} props.validRows - Total number of valid rows eligible for certificate issuance.
 * @param {number} props.invalidRows - Total number of invalid rows excluded from the sealed snapshot.
 * @param {number} props.duplicateRows - Total number of rows flagged with potential duplication.
 * @returns {JSX.Element} Four-column responsive metric grid.
 */
export function ApprovalCountsSummary({
  totalRows,
  validRows,
  invalidRows,
  duplicateRows,
}: ApprovalCountsSummaryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* Total Rows */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Ingested
          </span>
          <Users className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {totalRows.toLocaleString()}
          </span>
          <Badge variant="neutral" size="sm" mono>
            Rows
          </Badge>
        </div>
      </div>

      {/* Valid Rows (Included) */}
      <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/40 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Valid (To Issue)
          </span>
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300 tracking-tight">
            {validRows.toLocaleString()}
          </span>
          <Badge variant="success" size="sm" shape="pill">
            Ready to Seal
          </Badge>
        </div>
      </div>

      {/* Invalid Rows (Excluded) */}
      <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            Invalid (Excluded)
          </span>
          <WarningCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-black text-amber-700 dark:text-amber-300 tracking-tight">
            {invalidRows.toLocaleString()}
          </span>
          {invalidRows > 0 ? (
            <Badge variant="warning" size="sm" shape="pill">
              Will Be Skipped
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm" shape="pill">
              None
            </Badge>
          )}
        </div>
      </div>

      {/* Duplicate Warnings */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Duplicates
          </span>
          <Warning className="w-4 h-4 text-blue-500 dark:text-blue-400" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {duplicateRows.toLocaleString()}
          </span>
          {duplicateRows > 0 ? (
            <Badge variant="primary" size="sm" mono>
              Flagged
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm" shape="pill">
              Clean
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
