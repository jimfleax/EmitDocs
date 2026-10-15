/**
 * @file GenerationProgressCard.tsx
 * @description Real-time progress metrics card for batch PDF generation (PRD-CORE-07).
 */

import { CheckCircle, Speedometer, Hourglass, WarningCircle } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { WorkerStatus } from "@/hooks/useBatchGeneratorWorker";

export interface GenerationProgressCardProps {
  current: number;
  total: number;
  percent: number;
  itemsPerSec: number;
  etaSeconds: number;
  warningsCount: number;
  status: WorkerStatus;
}

export function GenerationProgressCard({
  current,
  total,
  percent,
  itemsPerSec,
  etaSeconds,
  warningsCount,
  status,
}: GenerationProgressCardProps) {
  const isGenerating = status === "generating";
  const isPaused = status === "paused";
  const isCompleted = status === "completed";

  const getStatusBadge = () => {
    switch (status) {
      case "generating":
        return (
          <Badge variant="primary" size="md" shape="pill" dot>
            Generating...
          </Badge>
        );
      case "paused":
        return (
          <Badge variant="warning" size="md" shape="pill" dot>
            Paused
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="success" size="md" shape="pill">
            Generation Complete
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="error" size="md" shape="pill">
            Cancelled
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" size="md" shape="pill">
            Ready to Generate
          </Badge>
        );
    }
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Top Header & Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Generation Progress
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Client-side deterministic PDF rendering off-main-thread via Web Worker.
          </p>
        </div>
        {getStatusBadge()}
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-slate-600 dark:text-slate-300">
            {current.toLocaleString()} of {total.toLocaleString()} documents
          </span>
          <span className="font-mono text-slate-900 dark:text-slate-100 font-bold">
            {percent}%
          </span>
        </div>

        <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative border border-slate-200/60 dark:border-slate-700/60">
          <div
            className={cn(
              "h-full transition-all duration-300 ease-out rounded-full",
              isCompleted
                ? "bg-emerald-500 dark:bg-emerald-400"
                : isPaused
                ? "bg-amber-500 dark:bg-amber-400"
                : isGenerating
                ? "bg-blue-600 dark:bg-blue-500"
                : "bg-slate-300 dark:bg-slate-700"
            )}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      </div>

      {/* Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
        {/* Processed count */}
        <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Processed
            </span>
            <CheckCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight font-mono">
              {current.toLocaleString()}{" "}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                / {total.toLocaleString()}
              </span>
            </span>
            <Badge variant="neutral" size="sm" mono>
              {percent}%
            </Badge>
          </div>
        </div>

        {/* Throughput */}
        <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Throughput
            </span>
            <Speedometer className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight font-mono">
              {itemsPerSec > 0 ? itemsPerSec.toFixed(1) : "0.0"}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              docs/sec
            </span>
          </div>
        </div>

        {/* ETA */}
        <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              ETA
            </span>
            <Hourglass className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight font-mono">
              {isCompleted ? "0.0s" : etaSeconds > 0 ? `${etaSeconds.toFixed(1)}s` : "—"}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {isCompleted ? "Completed" : "remaining"}
            </span>
          </div>
        </div>

        {/* Warnings count */}
        <div
          className={cn(
            "p-3.5 rounded-xl border flex flex-col justify-between transition-colors",
            warningsCount > 0
              ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/40"
              : "bg-slate-50/80 dark:bg-slate-950/50 border-slate-200/80 dark:border-slate-800/80"
          )}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span
              className={cn(
                "text-[11px] font-semibold uppercase tracking-wider",
                warningsCount > 0
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-slate-500 dark:text-slate-400"
              )}
            >
              Warnings
            </span>
            <WarningCircle
              className={cn(
                "w-4 h-4",
                warningsCount > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-slate-400"
              )}
            />
          </div>
          <div className="flex items-baseline justify-between">
            <span
              className={cn(
                "text-xl font-black tracking-tight font-mono",
                warningsCount > 0
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-slate-900 dark:text-slate-100"
              )}
            >
              {warningsCount.toLocaleString()}
            </span>
            <Badge
              variant={warningsCount > 0 ? "warning" : "neutral"}
              size="sm"
              shape="pill"
            >
              {warningsCount > 0 ? "Flagged" : "None"}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
