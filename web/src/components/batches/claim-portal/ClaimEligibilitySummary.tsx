/**
 * @file ClaimEligibilitySummary.tsx
 * @description Stat tiles for snapshot rows, eligible recipients, excluded recipients, and missing outputs.
 * @architecture Preflight inspection dashboard rendered in ClaimPortalWorkspace preflight tab.
 * @agent_note Evaluates eligibility gates (valid records, generated document presence, exclusion flags) prior to portal activation.
 */

import { Users, CheckCircle, Warning, FileX } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export interface ClaimEligibilitySummaryProps {
  snapshotTotal: number;
  eligibleCount: number;
  excludedCount: number;
  missingOutputCount: number;
  isReady: boolean;
}

/**
 * @component ClaimEligibilitySummary
 * @description Displays pre-activation verification tallies highlighting eligible recipients and exclusion blockers.
 * @param {ClaimEligibilitySummaryProps} props - Component properties.
 * @param {number} props.snapshotTotal - Total recipients sealed in the batch snapshot.
 * @param {number} props.eligibleCount - Number of recipients satisfying all claim prerequisites.
 * @param {number} props.excludedCount - Number of recipients flagged or excluded from claiming.
 * @param {number} props.missingOutputCount - Count of recipients missing generated PDF certificate outputs.
 * @param {boolean} props.isReady - Whether all eligibility checks pass with zero fatal blockers.
 * @returns {JSX.Element} Preflight summary card grid with readiness callout banner.
 */
export function ClaimEligibilitySummary({
  snapshotTotal,
  eligibleCount,
  excludedCount,
  missingOutputCount,
  isReady,
}: ClaimEligibilitySummaryProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Snapshot Rows */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Snapshot Total
            </span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
            {snapshotTotal.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500 block">Total approved recipients</span>
        </div>

        {/* Eligible */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              Eligible
            </span>
            <CheckCircle className="w-4 h-4 text-emerald-600" weight="fill" />
          </div>
          <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {eligibleCount.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500 block">Ready to claim</span>
        </div>

        {/* Excluded */}
        <div className={cn(
          "p-4 rounded-2xl border shadow-2xs space-y-1.5",
          excludedCount > 0
            ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
              Excluded
            </span>
            <Warning className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-extrabold text-amber-700 dark:text-amber-400 font-mono">
            {excludedCount.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500 block">Missing credentials</span>
        </div>

        {/* Missing Outputs */}
        <div className={cn(
          "p-4 rounded-2xl border shadow-2xs space-y-1.5",
          missingOutputCount > 0
            ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
              Missing Outputs
            </span>
            <FileX className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl font-extrabold text-rose-700 dark:text-rose-400 font-mono">
            {missingOutputCount.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500 block">Pending generation</span>
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 text-xs">
        <span className="text-slate-600 dark:text-slate-400">
          Preflight Readiness Status:
        </span>
        {isReady ? (
          <Badge variant="success" size="sm" shape="pill">
            All Preflight Checks Passed
          </Badge>
        ) : (
          <Badge variant="warning" size="sm" shape="pill">
            Blockers Pending Resolution
          </Badge>
        )}
      </div>
    </div>
  );
}
