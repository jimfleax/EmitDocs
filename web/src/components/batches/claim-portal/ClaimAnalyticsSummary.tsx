/**
 * @file ClaimAnalyticsSummary.tsx
 * @description Stat tiles for total eligible, unique claimed, unclaimed, and claim rate percentage.
 * @architecture Presentation metrics card grid rendered in ClaimPortalWorkspace overview tab.
 * @agent_note Displays high-level adoption telemetry: total eligible, claimed count, unclaimed backlog, and percentage conversion rate.
 */

import { Users, CheckCircle, Clock, ChartPie } from "@phosphor-icons/react";
import { Spinner } from "@/components/ui/Spinner";

export interface ClaimAnalyticsSummaryProps {
  analytics: {
    totalEligible: number;
    uniqueClaimedCount: number;
    unclaimedCount: number;
    claimRatePercent: number;
  };
  isLoading?: boolean;
}

/**
 * @component ClaimAnalyticsSummary
 * @description Visualizes claim portal participation telemetry including total eligible, unique claims, and claim conversion rate.
 * @param {ClaimAnalyticsSummaryProps} props - Component properties.
 * @param {Object} props.analytics - Claim rate analytics payload.
 * @param {number} props.analytics.totalEligible - Total participants configured for claims.
 * @param {number} props.analytics.uniqueClaimedCount - Total unique recipients who claimed certificates.
 * @param {number} props.analytics.unclaimedCount - Total recipients remaining to claim.
 * @param {number} props.analytics.claimRatePercent - Percentage conversion rate (0-100).
 * @param {boolean} [props.isLoading=false] - Whether analytics metrics are being fetched.
 * @returns {JSX.Element} Responsive four-column metric card grid.
 */
export function ClaimAnalyticsSummary({
  analytics,
  isLoading = false,
}: ClaimAnalyticsSummaryProps) {
  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  const {
    totalEligible,
    uniqueClaimedCount,
    unclaimedCount,
    claimRatePercent,
  } = analytics;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Total Eligible */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total Eligible
          </span>
          <Users className="w-4 h-4 text-slate-400" />
        </div>
        <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
          {totalEligible.toLocaleString()}
        </div>
        <span className="text-[11px] text-slate-500 block">
          Participants configured
        </span>
      </div>

      {/* Claimed */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
            Unique Claimed
          </span>
          <CheckCircle className="w-4 h-4 text-emerald-600" weight="fill" />
        </div>
        <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
          {uniqueClaimedCount.toLocaleString()}
        </div>
        <span className="text-[11px] text-slate-500 block">
          Verified &amp; accessed
        </span>
      </div>

      {/* Unclaimed */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
            Unclaimed
          </span>
          <Clock className="w-4 h-4 text-amber-600" />
        </div>
        <div className="text-2xl font-extrabold text-slate-700 dark:text-slate-300 font-mono">
          {unclaimedCount.toLocaleString()}
        </div>
        <span className="text-[11px] text-slate-500 block">Awaiting claim</span>
      </div>

      {/* Claim Rate */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
            Claim Rate
          </span>
          <ChartPie className="w-4 h-4 text-blue-600" />
        </div>
        <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
          {claimRatePercent.toFixed(1)}%
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-blue-600 h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, Math.max(0, claimRatePercent))}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
