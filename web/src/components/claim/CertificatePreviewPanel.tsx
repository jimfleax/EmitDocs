/**
 * @file CertificatePreviewPanel.tsx
 * @description High-fidelity PDF viewer using HTML5 canvas supersampling and PDF.js.
 */

import { useState, useEffect, useRef } from "react";
import { FilePdf, ArrowSquareOut } from "@phosphor-icons/react";
import { pdfjsLib, STANDARD_FONT_DATA_URL } from "@/lib/pdf-engine/worker-setup";
import { Spinner } from "@/components/ui/Spinner";

export interface CertificatePreviewPanelProps {
  pdfUrl?: string;
  pdfBytes?: Uint8Array;
  recipientName?: string;
}

export function CertificatePreviewPanel({
  pdfUrl,
  pdfBytes,
  recipientName,
}: CertificatePreviewPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function renderPdf() {
      if (!pdfBytes && !pdfUrl) return;

      try {
        setIsRendering(true);
        setRenderError(false);

        let data: Uint8Array;
        if (pdfBytes) {
          data = pdfBytes;
        } else if (pdfUrl) {
          const res = await fetch(pdfUrl);
          const buf = await res.arrayBuffer();
          data = new Uint8Array(buf);
        } else {
          return;
        }

        const loadingTask = pdfjsLib.getDocument({
          data: data.slice(0),
          standardFontDataUrl: STANDARD_FONT_DATA_URL,
        });

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        const page = await doc.getPage(1);
        if (isCancelled) return;

        const containerWidth = containerRef.current?.clientWidth || 600;
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const fitScale = (containerWidth - 32) / unscaledViewport.width;
        const effectiveScale = Math.max(0.4, Math.min(fitScale, 1.4));

        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        const renderScale = Math.min(4.0, Math.max(2.0, effectiveScale * dpr));

        const canonicalViewport = page.getViewport({ scale: effectiveScale });
        const renderViewport = page.getViewport({ scale: renderScale });

        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);
        canvas.style.width = `${Math.floor(canonicalViewport.width)}px`;
        canvas.style.height = `${Math.floor(canonicalViewport.height)}px`;

        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        await page.render({
          canvasContext: ctx,
          viewport: renderViewport,
          intent: "display",
        }).promise;

        if (isCancelled) return;
        setIsRendering(false);
      } catch (err) {
        if (!isCancelled) {
          console.warn("Canvas PDF render failed, falling back to viewer:", err);
          setRenderError(true);
          setIsRendering(false);
        }
      }
    }

    void renderPdf();

    return () => {
      isCancelled = true;
    };
  }, [pdfBytes, pdfUrl]);

  const handleOpenInNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    } else if (pdfBytes) {
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    }
  };

  if (!pdfUrl && !pdfBytes) {
    return (
      <div className="w-full aspect-[4/3] rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-2 text-slate-400">
        <FilePdf className="w-8 h-8 text-slate-300" />
        <span className="text-xs">Preparing certificate preview...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Header Bar */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <FilePdf className="w-4 h-4 text-blue-600" weight="fill" />
          <span>Certificate Preview</span>
        </span>

        {(pdfUrl || pdfBytes) && (
          <button
            type="button"
            onClick={handleOpenInNewTab}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
          >
            <span>Open in new tab</span>
            <ArrowSquareOut className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {/* Viewer Box */}
      <div
        ref={containerRef}
        className="relative w-full min-h-[320px] max-h-[520px] overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950 flex items-center justify-center p-4 shadow-inner"
      >
        {isRendering && (
          <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-10">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <Spinner size="sm" />
              <span>Rendering certificate...</span>
            </div>
          </div>
        )}

        {renderError && pdfUrl ? (
          <iframe
            src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
            title={`Certificate Preview for ${recipientName || "Participant"}`}
            className="w-full h-[400px] rounded-xl border-0"
          />
        ) : (
          <canvas
            ref={canvasRef}
            className="rounded-xl shadow-lg border border-slate-200/90 dark:border-slate-800 transition-all duration-150"
          />
        )}
      </div>
    </div>
  );
}
