/**
 * @file RecipientPreviewPanel.tsx
 * @description Detail inspection panel rendering a live PDF certificate preview for a single recipient draft record.
 * @architecture Preview detail pane inside DraftReviewWorkspace.
 * @agent_note Displays recipient's rendered PDF page using PreviewDocumentPane, pagination controls, zoom controls, and overflow badges.
 */

import React, { useState, useMemo } from "react";
import {
  CaretLeft,
  CaretRight,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  ArrowsIn,
  FilePdf,
} from "@phosphor-icons/react";
import { PreviewDocumentPane } from "@/components/templates/mapping/PreviewDocumentPane";
import { OverflowBadge } from "./OverflowBadge";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import type { EngineWarning } from "@/lib/pdf-engine/pdf-preview-engine";
import type { DraftRowItem } from "./RowEditor";

export interface RecipientPreviewPanelProps {
  batch: any;
  templateVersion: any;
  sourcePdfBytes: Uint8Array | null;
  selectedRow: DraftRowItem | null;
  onNavigateRow?: (direction: "prev" | "next") => void;
  onJumpToRow?: (sourceRowNumber: number) => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

/**
 * @component RecipientPreviewPanel
 * @description Detail viewer rendering live merged certificate for the selected row with navigation and zoom controls.
 * @param {RecipientPreviewPanelProps} props - Component properties.
 * @returns {JSX.Element} Preview viewport panel with toolbar and document canvas.
 */
export function RecipientPreviewPanel({
  batch: _batch,
  templateVersion,
  sourcePdfBytes,
  selectedRow,
  onNavigateRow,
  onJumpToRow,
  hasPrev = false,
  hasNext = false,
}: RecipientPreviewPanelProps) {
  const [scale, setScale] = useState<number>(0.85);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [warnings, setWarnings] = useState<EngineWarning[]>([]);
  const [jumpInput, setJumpInput] = useState<string>("");

  const pageCount = templateVersion?.pageCount || 1;
  const fieldMappings = useMemo(
    () => templateVersion?.fieldMappings || [],
    [templateVersion],
  );

  const hasOverflow = useMemo(
    () => warnings.some((w) => w.type === "overflow"),
    [warnings],
  );

  const sampleData: Record<string, string> = useMemo(() => {
    if (!selectedRow?.effectiveData) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(selectedRow.effectiveData)) {
      out[k] = v !== null && v !== undefined ? String(v) : "";
    }
    return out;
  }, [selectedRow]);

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(jumpInput, 10);
    if (!isNaN(target) && target > 0 && onJumpToRow) {
      onJumpToRow(target);
      setJumpInput("");
    }
  };

  if (!selectedRow) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <EmptyState
          icon={<FilePdf size={28} className="text-slate-400" />}
          title="Select a recipient row"
          description="Click any draft in the gallery to render a bit-for-bit accurate PDF preview."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-100/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
      {/* Top Toolbar */}
      <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Recipient Navigation */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onNavigateRow && onNavigateRow("prev")}
            disabled={!hasPrev}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Previous recipient"
          >
            <CaretLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 px-2 font-mono">
            Recipient #{selectedRow.sourceRowNumber}
          </span>

          <button
            type="button"
            onClick={() => onNavigateRow && onNavigateRow("next")}
            disabled={!hasNext}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Next recipient"
          >
            <CaretRight className="w-4 h-4" />
          </button>

          {/* Jump to Row input */}
          {onJumpToRow && (
            <form
              onSubmit={handleJumpSubmit}
              className="flex items-center gap-1 ml-2"
            >
              <input
                type="text"
                placeholder="Jump #"
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                className="w-16 px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </form>
          )}
        </div>

        {/* Overflow Indicator pill */}
        {hasOverflow && <OverflowBadge />}

        {/* Viewport Zoom & Page Selector */}
        <div className="flex items-center gap-2">
          {pageCount > 1 && (
            <div className="flex items-center gap-1 text-xs text-slate-500 font-semibold border-r border-slate-200 dark:border-slate-800 pr-2">
              <button
                type="button"
                disabled={activePageIndex <= 0}
                onClick={() => setActivePageIndex((p) => Math.max(0, p - 1))}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
              >
                <CaretLeft className="w-3.5 h-3.5" />
              </button>
              <span>
                {activePageIndex + 1} / {pageCount}
              </span>
              <button
                type="button"
                disabled={activePageIndex >= pageCount - 1}
                onClick={() =>
                  setActivePageIndex((p) => Math.min(pageCount - 1, p + 1))
                }
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
              >
                <CaretRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Zoom Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() =>
                setScale((s) => Math.max(0.4, Number((s - 0.15).toFixed(2))))
              }
              className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Zoom out"
            >
              <MagnifyingGlassMinus className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() =>
                setScale((s) => Math.min(2.0, Number((s + 0.15).toFixed(2))))
              }
              className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Zoom in"
            >
              <MagnifyingGlassPlus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setScale(0.85)}
              className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Fit to view"
            >
              <ArrowsIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Overflow Warning Notice */}
      {hasOverflow && (
        <div className="px-4 pt-3 shrink-0">
          <Alert variant="warning" title="Layout Bounds Overflow">
            One or more text fields exceed the bounding box on this certificate.
            Values will be shrunk down or visually clipped. Review field size in
            template editor or shorten row data.
          </Alert>
        </div>
      )}

      {/* Preview Viewport Canvas */}
      <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 flex">
        {sourcePdfBytes ? (
          <div className="m-auto shadow-2xl rounded-sm overflow-hidden bg-white shrink-0">
            <PreviewDocumentPane
              sourcePdfBytes={sourcePdfBytes}
              fieldMappings={fieldMappings}
              sampleData={sampleData}
              activePageIndex={activePageIndex}
              scale={scale}
              onWarningsGenerated={setWarnings}
            />
          </div>
        ) : (
          <div className="m-auto text-xs text-slate-400">
            Loading document canvas...
          </div>
        )}
      </div>
    </div>
  );
}
