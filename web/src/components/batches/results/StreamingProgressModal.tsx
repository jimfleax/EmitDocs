/**
 * @file StreamingProgressModal.tsx
 * @description Standard shadcn/ui Dialog visualizing real-time streaming ZIP packaging progress (PRD-CORE-08).
 * @architecture Portaled fixed dialog displaying essential packaging metrics and cancel controls.
 */

import {
  Archive,
  Lightning,
  Clock,
  HardDrives,
  Stop,
} from "@phosphor-icons/react";
import type { ZipExportProgress } from "@/hooks/useBatchGeneratorWorker";
import { formatBytes } from "@/lib/pdf-engine/volume-partitioner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export interface StreamingProgressModalProps {
  isOpen: boolean;
  progress: ZipExportProgress;
  zipFilename: string;
  volumeLabel?: string;
  onCancel: () => void;
}

export function StreamingProgressModal({
  isOpen,
  progress,
  zipFilename,
  volumeLabel,
  onCancel,
}: StreamingProgressModalProps) {
  return (
    <Dialog open={isOpen}>
      <DialogContent
        hideCloseButton
        className="max-w-md p-5 sm:p-6 rounded-2xl gap-5"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header */}
        <DialogHeader className="flex flex-row items-center gap-3 space-y-0 text-left">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Archive className="w-5 h-5 animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <DialogTitle>Creating ZIP Archive</DialogTitle>
              {volumeLabel ? (
                <Badge variant="primary" size="sm" mono>
                  {volumeLabel}
                </Badge>
              ) : progress.volumeIndex > 0 ? (
                <Badge variant="primary" size="sm" mono>
                  Part {progress.volumeIndex}
                </Badge>
              ) : null}
            </div>
            <DialogDescription className="truncate mt-0.5">
              {zipFilename}
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Progress Bar & Counters */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {progress.current.toLocaleString()} of {progress.total.toLocaleString()} docs
            </span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
              {progress.percent}%
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-150 ease-out"
              style={{ width: `${progress.percent}%` }}
            />
          </div>

          {progress.activeDocName && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate">
              {progress.activeDocName}
            </p>
          )}
        </div>

        {/* Key Metrics Strip */}
        <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-[10px] uppercase font-semibold text-slate-400">
              <HardDrives className="w-3 h-3 text-slate-400" />
              <span>Size</span>
            </div>
            <div className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200 truncate">
              {formatBytes(progress.bytesEmitted)}
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-[10px] uppercase font-semibold text-slate-400">
              <Lightning className="w-3 h-3 text-amber-500" />
              <span>Speed</span>
            </div>
            <div className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200 truncate">
              {progress.itemsPerSec} /s
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-[10px] uppercase font-semibold text-slate-400">
              <Clock className="w-3 h-3 text-indigo-400" />
              <span>ETA</span>
            </div>
            <div className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200 truncate">
              {progress.etaSeconds > 0 ? `${progress.etaSeconds}s` : "Done"}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="gap-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-200 dark:hover:border-rose-800/80 cursor-pointer"
          >
            <Stop className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
