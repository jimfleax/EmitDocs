/**
 * @file VolumeSplitCard.tsx
 * @description Card representing a partitioned batch archive volume for multi-part downloads (PRD-CORE-08).
 * @architecture Displays volume boundaries (1,000 docs / 1GB), estimated size, and triggers streaming packaging.
 * @agent_note Rendered within StreamingZipControls for each calculated volume partition.
 */

import {
  Archive,
  DownloadSimple,
  CircleNotch,
  HardDrives,
} from "@phosphor-icons/react";
import type { BatchVolumeInfo } from "@/lib/pdf-engine/volume-partitioner";
import { formatBytes } from "@/lib/pdf-engine/volume-partitioner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";

export interface VolumeSplitCardProps {
  volume: BatchVolumeInfo;
  isCurrentZipping: boolean;
  isAnyZipping: boolean;
  currentPercent?: number;
  onDownload: (volume: BatchVolumeInfo) => void;
  disabled?: boolean;
}

/**
 * @component VolumeSplitCard
 * @description Tile presenting partition boundaries, document counts, estimated byte size, and single-volume download trigger.
 * @param {VolumeSplitCardProps} props - Component properties.
 * @param {BatchVolumeInfo} props.volume - Partition metadata containing index, filename, document range, and estimated size.
 * @param {boolean} props.isCurrentZipping - Whether this specific volume is currently being packaged.
 * @param {boolean} props.isAnyZipping - Whether any archive volume is currently being packaged.
 * @param {number} [props.currentPercent=0] - Progress percentage for this volume.
 * @param {(volume: BatchVolumeInfo) => void} props.onDownload - Trigger download callback for this volume.
 * @param {boolean} [props.disabled=false] - Whether action button is disabled.
 * @returns {JSX.Element} Interactive volume card with status indicators and download button.
 */
export function VolumeSplitCard({
  volume,
  isCurrentZipping,
  isAnyZipping,
  currentPercent = 0,
  onDownload,
  disabled = false,
}: VolumeSplitCardProps) {
  const isPendingAnother = isAnyZipping && !isCurrentZipping;

  return (
    <div className="relative p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-3.5 group">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            {isCurrentZipping ? (
              <CircleNotch className="w-5 h-5 animate-spin text-indigo-600 dark:text-indigo-400" />
            ) : (
              <Archive className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Part {volume.volumeIndex} of {volume.totalVolumes}
              </span>
              <Badge variant="neutral" size="sm" mono>
                {volume.documentCount.toLocaleString()} docs
              </Badge>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono block truncate max-w-[210px] sm:max-w-[260px] mt-0.5">
              {volume.filename}
            </span>
          </div>
        </div>

        <Badge variant="primary" size="sm" shape="pill">
          ~{formatBytes(volume.estimatedSizeBytes)}
        </Badge>
      </div>

      {/* Partition Range */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-1.5 font-mono">
          <HardDrives className="w-3.5 h-3.5 text-slate-400" />
          <span>
            Rows {(volume.startIndex + 1).toLocaleString()}–
            {volume.endIndex.toLocaleString()}
          </span>
        </div>
        <span className="font-mono text-slate-400">
          Part {volume.volumeIndex}/{volume.totalVolumes}
        </span>
      </div>

      {/* Progress or Action Button */}
      <div className="pt-0.5">
        {isCurrentZipping ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-indigo-600 dark:text-indigo-400 animate-pulse">
                Streaming to disk...
              </span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {currentPercent}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-150 rounded-full"
                style={{ width: `${currentPercent}%` }}
              />
            </div>
          </div>
        ) : (
          <Button
            type="button"
            className="w-full justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-500/20 cursor-pointer active:scale-[0.98] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white disabled:opacity-40 disabled:cursor-not-allowed border-0"
            disabled={disabled || isPendingAnother}
            onClick={() => onDownload(volume)}
          >
            <DownloadSimple className="w-4 h-4" />
            <span>Download Part {volume.volumeIndex}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
