/**
 * @file StreamingZipControls.tsx
 * @description Compact master control component orchestrating streaming ZIP downloads, customizable archive filenames,
 *              and volume partitions (PRD-CORE-08).
 * @architecture Sleek, low-profile UI allowing inline file name configuration and single/multi-volume downloads.
 */

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Archive,
  DownloadSimple,
  CircleNotch,
  HardDrives,
  PencilSimple,
  Check,
  X,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import type { BatchVolumeInfo } from "@/lib/pdf-engine/volume-partitioner";
import {
  calculateBatchVolumes,
  formatBytes,
  slugifyBatchName,
} from "@/lib/pdf-engine/volume-partitioner";
import { VolumeSplitCard } from "./VolumeSplitCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";

export interface StreamingZipControlsProps {
  batchName: string;
  totalRecipients: number;
  basePdfBytesLength?: number;
  fieldCount?: number;
  samplePdfSizes?: number[];
  isZipping: boolean;
  currentZippingVolume?: number;
  currentZipPercent?: number;
  onDownloadVolume: (volume: BatchVolumeInfo) => void;
  disabled?: boolean;
}

export function StreamingZipControls({
  batchName,
  totalRecipients,
  basePdfBytesLength,
  fieldCount,
  samplePdfSizes,
  isZipping,
  currentZippingVolume,
  currentZipPercent = 0,
  onDownloadVolume,
  disabled = false,
}: StreamingZipControlsProps) {
  const defaultSlug = useMemo(() => slugifyBatchName(batchName), [batchName]);
  const [customName, setCustomName] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Active base name is customName if provided, otherwise defaultSlug
  const activeBaseName = customName.trim() || defaultSlug;
  const isCustomized = Boolean(customName.trim() && customName.trim() !== defaultSlug);

  const volumes = useMemo(() => {
    return calculateBatchVolumes(totalRecipients, activeBaseName, basePdfBytesLength, {
      fieldCount,
      samplePdfSizes,
    });
  }, [totalRecipients, activeBaseName, basePdfBytesLength, fieldCount, samplePdfSizes]);

  const totalEstimatedBytes = useMemo(() => {
    return volumes.reduce((acc, v) => acc + v.estimatedSizeBytes, 0);
  }, [volumes]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  if (totalRecipients <= 0 || volumes.length === 0) {
    return null;
  }

  const isMultiVolume = volumes.length > 1;

  const handleStartEdit = () => {
    setEditValue(activeBaseName);
    setIsEditing(true);
  };

  const handleSaveName = () => {
    const rawClean = editValue.replace(/\.zip$/i, "").trim();
    const clean = slugifyBatchName(rawClean);
    if (clean) {
      setCustomName(clean);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleResetName = () => {
    setCustomName("");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveName();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5">
      {/* Header section: Title and summary badges */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Archive className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {isMultiVolume
              ? `Batch Archive (${volumes.length} Volumes)`
              : "Download ZIP Archive"}
          </h2>
        </div>

        {/* Global Summary Badges */}
        <div className="flex items-center gap-2">
          <Badge variant="neutral" size="sm" mono>
            <HardDrives className="w-3.5 h-3.5 mr-1 text-slate-400" />
            ~{formatBytes(totalEstimatedBytes)}
          </Badge>
          <Badge variant="primary" size="sm" mono>
            {totalRecipients.toLocaleString()} docs
          </Badge>
        </div>
      </div>

      {/* Filename configuration & single volume download row */}
      <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        {/* Filename Editor */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">
            {isMultiVolume ? "Archive prefix:" : "File name:"}
          </span>

          {isEditing ? (
            <div className="flex items-center gap-1.5 flex-1 max-w-xs sm:max-w-sm">
              <div className="relative flex-1">
                <Input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={defaultSlug}
                  className="h-8 px-2.5 text-xs font-mono rounded-lg bg-white dark:bg-slate-900 border-indigo-400 dark:border-indigo-600 focus-visible:ring-indigo-500/20 pr-16"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-slate-400 pointer-events-none select-none">
                  {isMultiVolume ? "_part-X.zip" : ".zip"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSaveName}
                title="Save filename"
                className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                title="Cancel"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 truncate">
                {isMultiVolume ? `${activeBaseName}_part-X.zip` : volumes[0].filename}
              </span>
              <Tooltip content="Edit filename" side="top">
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  aria-label="Edit filename"
                >
                  <PencilSimple className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
              {isCustomized && (
                <Tooltip content="Reset to default name" side="top">
                  <button
                    type="button"
                    onClick={handleResetName}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    aria-label="Reset to default name"
                  >
                    <ArrowCounterClockwise className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        {/* Case 1 Action: Single Volume Download */}
        {!isMultiVolume && (
          <Button
            type="button"
            disabled={disabled || isZipping}
            onClick={() => onDownloadVolume(volumes[0])}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-500/20 cursor-pointer active:scale-[0.98] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white disabled:opacity-40 disabled:cursor-not-allowed shrink-0 border-0"
          >
            {isZipping ? (
              <>
                <CircleNotch className="w-4 h-4 animate-spin" />
                <span>Streaming ({currentZipPercent}%)...</span>
              </>
            ) : (
              <>
                <DownloadSimple className="w-4 h-4" />
                <span>Download ZIP</span>
              </>
            )}
          </Button>
        )}
      </div>

      {/* Case 2: Multi-Volume Grid (> 1,000 docs or > 1GB) */}
      {isMultiVolume && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-0.5">
          {volumes.map((vol) => (
            <VolumeSplitCard
              key={vol.volumeIndex}
              volume={vol}
              isCurrentZipping={isZipping && currentZippingVolume === vol.volumeIndex}
              isAnyZipping={isZipping}
              currentPercent={currentZippingVolume === vol.volumeIndex ? currentZipPercent : 0}
              onDownload={onDownloadVolume}
            />
          ))}
        </div>
      )}
    </div>
  );
}
