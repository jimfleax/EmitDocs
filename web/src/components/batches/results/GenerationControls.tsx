/**
 * @file GenerationControls.tsx
 * @description Generation control buttons (Start, Pause, Resume, Cancel) with state machine guardrails (PRD-CORE-07).
 * @architecture Interactive action panel rendered in ResultsWorkspace driving the client-side Web Worker PDF generation pipeline.
 * @agent_note Enforces valid state transitions (idle -> generating -> paused -> completed/cancelled) with confirmation dialogs.
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
  totalRecipients?: number;
}

/**
 * @component GenerationControls
 * @description Control bar offering Start, Pause, Resume, and Cancel actions for the client-side PDF generation worker.
 * @param {GenerationControlsProps} props - Component properties.
 * @param {WorkerStatus} props.status - Current state machine status of the generation worker.
 * @param {() => void} props.onStart - Callback to begin batch generation.
 * @param {() => void} props.onPause - Callback to pause generation at document boundary.
 * @param {() => void} props.onResume - Callback to resume paused generation.
 * @param {() => void} props.onCancel - Callback to abort generation.
 * @param {boolean} [props.disabled=false] - Whether control actions are disabled.
 * @param {number} [props.totalRecipients] - Total count of recipients to generate.
 * @returns {JSX.Element} Control button bar with status indicator.
 */
export function GenerationControls({
  status,
  onStart,
  onPause,
  onResume,
  onCancel,
  disabled = false,
  totalRecipients,
}: GenerationControlsProps) {
  const isGenerating = status === "generating";
  const isPaused = status === "paused";
  const isReady = status === "ready" || status === "idle";
  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";

  const renderStatusDetails = () => {
    if (isGenerating) {
      return (
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
              Generating Batch
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Rendering PDFs in background Web Worker
            </span>
          </div>
        </div>
      );
    }
    if (isPaused) {
      return (
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
              Generation Paused
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Worker halted cleanly at document boundary
            </span>
          </div>
        </div>
      );
    }
    if (isCompleted) {
      return (
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
              Generation Complete
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              All approved documents generated
            </span>
          </div>
        </div>
      );
    }
    if (isCancelled) {
      return (
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
              Generation Cancelled
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Worker queue drained and stopped
            </span>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2.5">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
        <div>
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
            Batch Generation Engine
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
            {totalRecipients
              ? `Ready to generate ${totalRecipients.toLocaleString()} documents on-demand`
              : "Ready to generate all approved documents"}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3">
      {renderStatusDetails()}

      <div className="flex items-center gap-2.5">
        {/* Start / Restart Generation */}
        {(isReady || isCompleted || isCancelled) && (
          <button
            type="button"
            onClick={onStart}
            disabled={disabled}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-500/20 cursor-pointer active:scale-[0.98]",
              "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            {isCompleted || isCancelled ? (
              <ArrowClockwise className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" weight="fill" />
            )}
            {isCompleted
              ? "Re-generate Batch"
              : isCancelled
                ? "Restart Generation"
                : "Start Generation"}
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
