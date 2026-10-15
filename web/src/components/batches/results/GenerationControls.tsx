/**
 * @file GenerationControls.tsx
 * @description Generation control buttons (Start, Pause, Resume, Cancel) with state machine guardrails (PRD-CORE-07).
 */

import { Play, Pause, Stop, ArrowClockwise } from "@phosphor-icons/react";
import type { WorkerStatus } from "@/hooks/useBatchGeneratorWorker";
import { cn } from "@/lib/utils";

export interface GenerationControlsProps {
  status: WorkerStatus;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function GenerationControls({
  status,
  onStart,
  onPause,
  onResume,
  onCancel,
  disabled = false,
}: GenerationControlsProps) {
  const isGenerating = status === "generating";
  const isPaused = status === "paused";
  const isReady = status === "ready" || status === "idle";
  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Engine Controls:
        </span>
        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase">
          [{status}]
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Start / Restart Generation */}
        {(isReady || isCompleted || isCancelled) && (
          <button
            type="button"
            onClick={onStart}
            disabled={disabled}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-[0.98]",
              "bg-slate-950 dark:bg-slate-100 text-white dark:text-slate-950 hover:bg-slate-900 dark:hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {isCompleted || isCancelled ? (
              <ArrowClockwise className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" weight="fill" />
            )}
            {isCompleted ? "Re-generate Batch" : isCancelled ? "Restart Generation" : "Start Generation"}
          </button>
        )}

        {/* Pause Generation */}
        {isGenerating && (
          <button
            type="button"
            onClick={onPause}
            disabled={disabled}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white transition-all shadow-sm cursor-pointer select-none"
          >
            <Pause className="w-3.5 h-3.5" weight="fill" />
            Pause
          </button>
        )}

        {/* Resume Generation */}
        {isPaused && (
          <button
            type="button"
            onClick={onResume}
            disabled={disabled}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white transition-all shadow-sm cursor-pointer select-none"
          >
            <Play className="w-3.5 h-3.5" weight="fill" />
            Resume
          </button>
        )}

        {/* Cancel Generation */}
        {(isGenerating || isPaused) && (
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 transition-colors cursor-pointer select-none"
          >
            <Stop className="w-3.5 h-3.5" weight="fill" />
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
