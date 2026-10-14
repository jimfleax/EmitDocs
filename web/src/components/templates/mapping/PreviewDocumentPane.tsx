/**
 * @file PreviewDocumentPane.tsx
 * @description Real-time live PDF preview generator pane demonstrating dynamic variable replacement and layout checking.
 * @architecture Preview engine coordinator component rendering simulated PDF outputs using pdf-lib and PDF.js.
 * @agent_note Generates full binary PDF with generatePdfWithOverlay, passes warnings to onWarningsGenerated, and renders output to canvas.
 */

import React, { useEffect, useRef, useState } from "react";
import type { IFieldMapping } from "./types";
import {
  generatePdfWithOverlay,
  type EngineWarning,
} from "@/lib/pdf-engine/pdf-preview-engine";
import {
  pdfjsLib,
  STANDARD_FONT_DATA_URL,
} from "@/lib/pdf-engine/worker-setup";

interface PreviewDocumentPaneProps {
  sourcePdfBytes: Uint8Array | null;
  fieldMappings: IFieldMapping[];
  sampleData: Record<string, string>;
  activePageIndex: number;
  scale: number;
  rotation?: number;
  onWarningsGenerated: (warnings: EngineWarning[]) => void;
}

/**
 * @component PreviewDocumentPane
 * @description Renders live preview canvas by overlaying sample values into PDF template and detecting layout overflow.
 * @param {PreviewDocumentPaneProps} props - Component properties.
 * @returns {JSX.Element} Canvas preview container with generation loading indicators and error banners.
 */
export const PreviewDocumentPane: React.FC<PreviewDocumentPaneProps> = ({
  sourcePdfBytes,
  fieldMappings,
  sampleData,
  activePageIndex,
  scale,
  rotation = 0,
  onWarningsGenerated,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const loadingTaskRef = useRef<any>(null);
  const onWarningsGeneratedRef = useRef(onWarningsGenerated);

  useEffect(() => {
    onWarningsGeneratedRef.current = onWarningsGenerated;
  }, [onWarningsGenerated]);

  const [generating, setGenerating] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!sourcePdfBytes || sourcePdfBytes.length === 0) return;

    let isCancelled = false;

    const renderPreview = async () => {
      try {
        setGenerating(true);
        setRenderError(null);

        // Cancel any pending render task
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // ignore
          }
          renderTaskRef.current = null;
        }

        if (loadingTaskRef.current) {
          try {
            loadingTaskRef.current.destroy();
          } catch {
            // ignore
          }
          loadingTaskRef.current = null;
        }

        // 1. Generate modified PDF using engine pipeline, or fast-path for zero mappings
        let renderBytes: Uint8Array;
        let generatedWarnings: EngineWarning[] = [];

        if (fieldMappings.length === 0) {
          // Fast-path: no mappings → render original PDF directly
          renderBytes = sourcePdfBytes.slice(0);
          generatedWarnings = [];
        } else {
          const { pdfBytes, warnings } = await generatePdfWithOverlay(
            sourcePdfBytes.slice(0),
            fieldMappings,
            sampleData,
            { drawDebugBoxes: false },
          );
          if (isCancelled) return;
          generatedWarnings = warnings;
          renderBytes = pdfBytes;
        }

        if (isCancelled) return;

        // 2. Render resulting preview document via PDF.js with defensive buffer clone
        let localLoadingTask: any = null;
        try {
          const loadingTask = pdfjsLib.getDocument({
            data: renderBytes.slice(0),
            standardFontDataUrl: STANDARD_FONT_DATA_URL,
          });
          localLoadingTask = loadingTask;
          loadingTaskRef.current = loadingTask;
          const doc = await loadingTask.promise;

          const targetPage = Math.min(
            doc.numPages,
            Math.max(1, activePageIndex + 1),
          );
          const page = await doc.getPage(targetPage);

          if (isCancelled) return;

          const effectiveRotation =
            (((page.rotate + rotation) % 360) + 360) % 360;
          const canonicalViewport = page.getViewport({
            scale,
            rotation: effectiveRotation,
          });

          // High-precision adaptive supersampling (minimum 2.0x, dynamic up to 4.0x)
          const dpr =
            typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
          const effectiveScale = Math.min(4.0, Math.max(2.0, scale * dpr));
          const renderViewport = page.getViewport({
            scale: effectiveScale,
            rotation: effectiveRotation,
          });

          const targetPixelWidth = Math.floor(renderViewport.width);
          const targetPixelHeight = Math.floor(renderViewport.height);

          // Double-buffering: Render on background offscreen canvas first
          const offscreenCanvas = document.createElement("canvas");
          offscreenCanvas.width = targetPixelWidth;
          offscreenCanvas.height = targetPixelHeight;

          const offCtx = offscreenCanvas.getContext("2d", { alpha: false });
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

          // Synchronous blit: transfer offscreen render to visible canvas in single frame
          const visibleCanvas = canvasRef.current;
          if (!visibleCanvas) return;

          if (
            visibleCanvas.width !== targetPixelWidth ||
            visibleCanvas.height !== targetPixelHeight
          ) {
            visibleCanvas.width = targetPixelWidth;
            visibleCanvas.height = targetPixelHeight;
            visibleCanvas.style.width = `${Math.floor(canonicalViewport.width)}px`;
            visibleCanvas.style.height = `${Math.floor(canonicalViewport.height)}px`;
          }

          const visibleCtx = visibleCanvas.getContext("2d");
          if (!visibleCtx) return;

          visibleCtx.imageSmoothingEnabled = true;
          visibleCtx.imageSmoothingQuality = "high";
          visibleCtx.drawImage(offscreenCanvas, 0, 0);

          // 3. Notify parent of warnings after canvas successfully paints
          onWarningsGeneratedRef.current(generatedWarnings);
        } finally {
          if (localLoadingTask) {
            try {
              await localLoadingTask.destroy();
            } catch {
              // ignore
            }
            if (loadingTaskRef.current === localLoadingTask) {
              loadingTaskRef.current = null;
            }
          }
        }
      } catch (err: any) {
        if (!isCancelled && err?.name !== "RenderingCancelledException") {
          console.error("Error generating PDF preview:", err);
          setRenderError(err.message || "Failed to generate preview");
        }
      } finally {
        if (!isCancelled) setGenerating(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      renderPreview();
    }, 150);

    return () => {
      clearTimeout(debounceTimer);
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRef.current = null;
      }
      if (loadingTaskRef.current) {
        try {
          loadingTaskRef.current.destroy();
        } catch {
          // ignore
        }
        loadingTaskRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sourcePdfBytes,
    fieldMappings,
    sampleData,
    activePageIndex,
    scale,
    rotation,
  ]);

  return (
    <div className="relative flex flex-col items-center justify-center p-2 sm:p-4 bg-slate-100/60 rounded-xl min-h-0 w-full h-full">
      {generating && (
        <div className="absolute top-4 right-4 bg-white/90 px-2 py-1 rounded shadow text-xs font-medium text-blue-600 flex items-center gap-1.5 z-20">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
          Rendering Output Preview...
        </div>
      )}

      {renderError ? (
        <div className="text-red-500 text-xs p-4 bg-red-50 rounded border border-red-200 text-center">
          Failed to render preview: {renderError}
        </div>
      ) : (
        <div className="shadow-lg border border-slate-200 bg-white rounded overflow-hidden">
          <canvas ref={canvasRef} />
        </div>
      )}
    </div>
  );
};
