/**
 * @file SinglePdfPreviewModal.tsx
 * @description Fast canvas PDF preview modal with PDF.js renderer, zoom controls, diagnostic warning badges, and download button.
 */

import { useEffect, useRef, useState } from "react";
import {
  X,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  ArrowsClockwise,
  DownloadSimple,
  WarningCircle,
  CheckCircle,
  FilePdf,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import {
  pdfjsLib,
  STANDARD_FONT_DATA_URL,
} from "@/lib/pdf-engine/worker-setup";
import type { EngineWarning } from "@/lib/pdf-engine/pdf-preview-engine";

export interface SinglePdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientKey: string;
  recipientName?: string;
  pdfBytes: Uint8Array | null;
  warnings?: EngineWarning[];
  durationMs?: number;
  onDownload?: () => void;
}

export function SinglePdfPreviewModal({
  isOpen,
  onClose,
  recipientKey,
  recipientName,
  pdfBytes,
  warnings = [],
  durationMs,
  onDownload,
}: SinglePdfPreviewModalProps) {
  const [scale, setScale] = useState<number>(1.0);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const loadingTaskRef = useRef<any>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // PDF.js render loop
  useEffect(() => {
    if (!isOpen || !pdfBytes || pdfBytes.length === 0) return;

    let isCancelled = false;

    const render = async () => {
      try {
        setIsRendering(true);
        setRenderError(null);

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // Ignore cancel error
          }
          renderTaskRef.current = null;
        }

        if (loadingTaskRef.current) {
          try {
            await loadingTaskRef.current.destroy();
          } catch {
            // Ignore cleanup error
          }
          loadingTaskRef.current = null;
        }

        const loadingTask = pdfjsLib.getDocument({
          data: pdfBytes.slice(0),
          standardFontDataUrl: STANDARD_FONT_DATA_URL,
        });
        loadingTaskRef.current = loadingTask;

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        const page = await doc.getPage(1);
        if (isCancelled) return;

        const canonicalViewport = page.getViewport({ scale });
        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        const effectiveScale = Math.min(4.0, Math.max(1.5, scale * dpr));
        const renderViewport = page.getViewport({ scale: effectiveScale });

        const targetPixelWidth = Math.floor(renderViewport.width);
        const targetPixelHeight = Math.floor(renderViewport.height);

        // Offscreen double-buffering
        const offscreen = document.createElement("canvas");
        offscreen.width = targetPixelWidth;
        offscreen.height = targetPixelHeight;
        const offCtx = offscreen.getContext("2d", { alpha: false });
        if (!offCtx) return;

        offCtx.imageSmoothingEnabled = true;
        offCtx.imageSmoothingQuality = "high";

        const renderTask = page.render({
          canvasContext: offCtx,
          viewport: renderViewport,
          intent: "display",
        });
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        if (isCancelled) return;

        const visibleCanvas = canvasRef.current;
        if (!visibleCanvas) return;

        visibleCanvas.width = targetPixelWidth;
        visibleCanvas.height = targetPixelHeight;
        visibleCanvas.style.width = `${Math.floor(canonicalViewport.width)}px`;
        visibleCanvas.style.height = `${Math.floor(canonicalViewport.height)}px`;

        const visibleCtx = visibleCanvas.getContext("2d");
        if (!visibleCtx) return;

        visibleCtx.imageSmoothingEnabled = true;
        visibleCtx.imageSmoothingQuality = "high";
        visibleCtx.drawImage(offscreen, 0, 0);
      } catch (err: any) {
        if (!isCancelled && err?.name !== "RenderingCancelledException") {
          console.error("PDF.js render error:", err);
          setRenderError(err?.message || "Failed to render PDF canvas");
        }
      } finally {
        if (!isCancelled) {
          setIsRendering(false);
        }
      }
    };

    void render();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore
        }
        renderTaskRef.current = null;
      }
      if (loadingTaskRef.current) {
        try {
          void loadingTaskRef.current.destroy()?.catch?.(() => {});
        } catch {
          // Ignore
        }
        loadingTaskRef.current = null;
      }
    };
  }, [isOpen, pdfBytes, scale]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
      return;
    }
    if (!pdfBytes) return;

    const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const sanitizedName = (recipientName || "recipient").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    a.download = `${sanitizedName}_${recipientKey}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const hasWarnings = warnings.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <FilePdf size={20} weight="duotone" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {recipientName || recipientKey}
                </h3>
                {durationMs !== undefined && (
                  <Badge variant="success" size="sm" mono>
                    {durationMs < 20 ? "<20ms" : `${durationMs.toFixed(1)}ms`}
                  </Badge>
                )}
                {hasWarnings ? (
                  <Badge variant="warning" size="sm" dot>
                    {warnings.length} {warnings.length === 1 ? "Warning" : "Warnings"}
                  </Badge>
                ) : (
                  <Badge variant="success" size="sm" dot>
                    Clean
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Key: {recipientKey}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.5, Number((s - 0.25).toFixed(2))))}
              disabled={scale <= 0.5}
              className="p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              title="Zoom Out"
            >
              <MagnifyingGlassMinus size={16} />
            </button>
            <span className="w-14 text-center font-mono font-medium text-slate-700 dark:text-slate-300">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(2.5, Number((s + 0.25).toFixed(2))))}
              disabled={scale >= 2.5}
              className="p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              title="Zoom In"
            >
              <MagnifyingGlassPlus size={16} />
            </button>
            <button
              type="button"
              onClick={() => setScale(1.0)}
              className="p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Reset Zoom"
            >
              <ArrowsClockwise size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <DownloadSimple size={15} weight="bold" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        {/* Canvas Body */}
        <div className="flex-1 overflow-auto p-6 flex flex-col items-center justify-center bg-slate-100/70 dark:bg-slate-950/40 min-h-[420px]">
          {renderError ? (
            <div className="p-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-sm max-w-md text-center">
              <p className="font-semibold">Rendering Error</p>
              <p className="text-xs mt-1">{renderError}</p>
            </div>
          ) : (
            <div className="relative">
              {isRendering && (
                <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center rounded z-10">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400 animate-pulse">
                    Rendering...
                  </span>
                </div>
              )}
              <canvas
                ref={canvasRef}
                className="shadow-xl rounded-sm border border-slate-300 dark:border-slate-800 bg-white"
              />
            </div>
          )}
        </div>

        {/* Diagnostics warnings drawer */}
        {hasWarnings ? (
          <div className="px-6 py-3 border-t border-amber-200 bg-amber-50/70 dark:bg-amber-950/30 text-xs">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold mb-1.5">
              <WarningCircle size={16} weight="fill" className="text-amber-600" />
              <span>Diagnostic Warnings ({warnings.length})</span>
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {warnings.map((w, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 text-amber-700 dark:text-amber-400"
                >
                  <span className="font-mono text-[10px] px-1 rounded bg-amber-200/60 dark:bg-amber-900/60 uppercase">
                    {w.type}
                  </span>
                  <span className="font-semibold">{w.fieldKey}:</span>
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-6 py-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle size={15} weight="fill" />
              <span>Zero layout or glyph warnings detected</span>
            </div>
            {pdfBytes && (
              <span className="font-mono">
                {(pdfBytes.byteLength / 1024).toFixed(1)} KB
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
