/**
 * @file PdfPageNode.tsx
 * @description Custom React Flow canvas node that renders a PDF page using PDF.js and detects template tokens.
 * @architecture Foundational canvas background node providing the visual coordinate plane and token discovery layer.
 * @agent_note Uses PDF.js to render page canvas, extracts text items to run regex token detection, and projects detected tokens as interactive overlays.
 */

import React, { useEffect, useRef, useState } from "react";
import { useViewport, type NodeProps, type Node } from "@xyflow/react";
import {
  pdfjsLib,
  STANDARD_FONT_DATA_URL,
} from "@/lib/pdf-engine/worker-setup";
import type { ViewportConfig } from "@/lib/pdf-engine/coordinate-transforms";
import { pdfToDomRect } from "@/lib/pdf-engine/coordinate-transforms";
import {
  detectTokensInTextItems,
  type DetectedToken,
} from "@/lib/pdf-engine/token-detector";
import type { IFieldMapping } from "../types";
import { Tooltip } from "@/components/ui/tooltip";

export interface PdfPageNodeData {
  sourcePdfBytes: Uint8Array | null;
  activePageIndex: number;
  pageWidth: number;
  pageHeight: number;
  rotation: number;
  detectedTokens?: DetectedToken[];
  fieldMappings?: IFieldMapping[];
  onConfirmToken?: (token: DetectedToken, isMulti?: boolean) => void;
  onPageLoaded?: (dimensions: {
    width: number;
    height: number;
    pageCount: number;
    effectiveRotation: number;
    rotation?: number;
  }) => void;
  onTokensDiscovered?: (tokens: DetectedToken[]) => void;
  onPageClick?: () => void;
  viewport?: ViewportConfig;
  [key: string]: unknown;
}

export type PdfPageNodeType = Node<PdfPageNodeData, "pdfPage">;

interface MemoizedPdfCanvasProps {
  doc: any;
  activePageIndex: number;
  rotation: number;
  onPageLoaded?: (dimensions: {
    width: number;
    height: number;
    pageCount: number;
    effectiveRotation: number;
    rotation?: number;
  }) => void;
  onTokensDiscovered?: (tokens: DetectedToken[]) => void;
}

/**
 * @component MemoizedPdfCanvas
 * @description Renders rasterized PDF page onto HTML5 canvas with HiDPI backing store and debounced zoom scaling.
 * @param {MemoizedPdfCanvasProps} props - Component properties.
 * @param {any} props.doc - PDF.js document proxy.
 * @param {number} props.activePageIndex - Zero-indexed page to render.
 * @param {number} props.rotation - Rotation degree for the page canvas.
 * @param {Function} [props.onPageLoaded] - Callback invoked when page dimensions and count resolve.
 * @param {Function} [props.onTokensDiscovered] - Callback receiving detected text tokens.
 * @state Canvas render task tracking ref, debounced zoom timer ref, and rendered scale cache.
 * @api Interacts with PDF.js worker API to render canvas and extract text content.
 * @returns {JSX.Element} Canvas element rendering rasterized page.
 */
const MemoizedPdfCanvas = React.memo<MemoizedPdfCanvasProps>(
  ({ doc, activePageIndex, rotation, onPageLoaded, onTokensDiscovered }) => {
    const { zoom } = useViewport();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const renderTaskRef = useRef<any>(null);
    const debounceTimerRef = useRef<any>(null);
    const renderedScaleRef = useRef<number>(0);
    const lastRenderedKeyRef = useRef<string>("");

    const onPageLoadedRef = useRef(onPageLoaded);
    const onTokensDiscoveredRef = useRef(onTokensDiscovered);

    useEffect(() => {
      onPageLoadedRef.current = onPageLoaded;
      onTokensDiscoveredRef.current = onTokensDiscovered;
    }, [onPageLoaded, onTokensDiscovered]);

    useEffect(() => {
      if (!doc) return;

      const dpr =
        typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      // High-precision adaptive scale: baseline minimum 2.0x (144+ DPI), dynamic up to 4.0x
      const effectiveScale = Math.min(
        4.0,
        Math.max(2.0, Math.round(zoom * dpr * 10) / 10),
      );
      const effectiveRotation = ((rotation % 360) + 360) % 360;
      const docId = doc?.fingerprints?.[0] || doc?.fingerprint || "doc";
      const baseKey = `${docId}_${activePageIndex}_${effectiveRotation}`;
      const fullRenderKey = `${baseKey}@${effectiveScale}x`;

      // If already rendered at this exact scale, page, and rotation, skip redundant execution
      if (lastRenderedKeyRef.current === fullRenderKey) return;

      let isCancelled = false;

      const executeRender = async (scaleToRender: number) => {
        try {
          if (renderTaskRef.current) {
            try {
              renderTaskRef.current.cancel();
            } catch {
              // ignore
            }
            renderTaskRef.current = null;
          }

          const targetPageNum = Math.min(
            doc.numPages,
            Math.max(1, activePageIndex + 1),
          );
          const page = await doc.getPage(targetPageNum);
          if (isCancelled) return;

          // Only discover tokens and determine page dimensions on doc/page/rotation change
          const isNewPageOrDoc =
            !lastRenderedKeyRef.current.startsWith(baseKey);
          if (isNewPageOrDoc) {
            const textContent = await page.getTextContent({
              includeMarkedContent: false,
            });
            if (!isCancelled) {
              const textItems = textContent.items.filter(
                (item: any) => typeof item.str === "string",
              ) as any[];
              const discovered = detectTokensInTextItems(
                textItems,
                activePageIndex,
                textContent.styles as any,
              );
              onTokensDiscoveredRef.current?.(discovered);
            }
          }

          const pageRotation = (((page.rotate + rotation) % 360) + 360) % 360;
          const canonicalViewport = page.getViewport({
            scale: 1.0,
            rotation: pageRotation,
          });

          if (isNewPageOrDoc) {
            onPageLoadedRef.current?.({
              width: canonicalViewport.width,
              height: canonicalViewport.height,
              pageCount: doc.numPages,
              effectiveRotation: pageRotation,
              rotation: pageRotation,
            });
          }

          // High-precision render viewport
          const renderViewport = page.getViewport({
            scale: scaleToRender,
            rotation: pageRotation,
          });
          const targetPixelW = Math.floor(renderViewport.width);
          const targetPixelH = Math.floor(renderViewport.height);

          // Double-buffering: Render onto offscreen canvas first to prevent white flash
          const offscreenCanvas = document.createElement("canvas");
          offscreenCanvas.width = targetPixelW;
          offscreenCanvas.height = targetPixelH;

          const offscreenCtx = offscreenCanvas.getContext("2d", {
            alpha: false,
          });
          if (!offscreenCtx) return;

          offscreenCtx.imageSmoothingEnabled = true;
          offscreenCtx.imageSmoothingQuality = "high";

          const renderTask = page.render({
            canvasContext: offscreenCtx,
            viewport: renderViewport,
            intent: "display",
          });
          renderTaskRef.current = renderTask;
          await renderTask.promise;

          if (isCancelled) return;

          // Synchronous transfer to visible canvas in single frame
          const visibleCanvas = canvasRef.current;
          if (!visibleCanvas) return;

          if (
            visibleCanvas.width !== targetPixelW ||
            visibleCanvas.height !== targetPixelH
          ) {
            visibleCanvas.width = targetPixelW;
            visibleCanvas.height = targetPixelH;
          }

          // Canonical CSS dimensions strictly locked to 1.0x layout points
          visibleCanvas.style.width = `${Math.floor(canonicalViewport.width)}px`;
          visibleCanvas.style.height = `${Math.floor(canonicalViewport.height)}px`;

          const visibleCtx = visibleCanvas.getContext("2d");
          if (!visibleCtx) return;

          visibleCtx.imageSmoothingEnabled = true;
          visibleCtx.imageSmoothingQuality = "high";
          visibleCtx.drawImage(offscreenCanvas, 0, 0);

          renderedScaleRef.current = scaleToRender;
          lastRenderedKeyRef.current = fullRenderKey;
        } catch (err: any) {
          if (!isCancelled && err?.name !== "RenderingCancelledException") {
            console.error("Error rendering page in MemoizedPdfCanvas:", err);
          }
        }
      };

      const isFirstPageRender = !lastRenderedKeyRef.current.startsWith(baseKey);
      if (isFirstPageRender) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        executeRender(effectiveScale);
      } else {
        // Debounce zoom re-renders by 150ms to maintain smooth 60 FPS CSS transforms during active gestures
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          executeRender(effectiveScale);
        }, 150);
      }

      return () => {
        isCancelled = true;
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // ignore
          }
          renderTaskRef.current = null;
        }
      };
    }, [doc, activePageIndex, rotation, zoom]);

    return (
      <canvas
        ref={canvasRef}
        className="block pointer-events-none"
        style={{
          imageRendering: "auto",
        }}
      />
    );
  },
  (prev, next) =>
    prev.doc === next.doc &&
    prev.activePageIndex === next.activePageIndex &&
    prev.rotation === next.rotation,
);

/**
 * @component PdfPageNodeComponent
 * @description Background canvas node rendering rendered PDF vector graphics, rotation, and auto-discovered tokens.
 * @param {NodeProps<PdfPageNodeType>} props - React Flow custom node properties.
 * @state {any} doc - Loaded PDF.js document instance.
 * @state {boolean} loading - Loading indicator flag for PDF document parsing.
 * @state {string | null} error - Error message if document loading or page rendering fails.
 * @api Node callbacks: onConfirmToken, onPageLoaded, onTokensDiscovered, onPageClick.
 * @returns {JSX.Element} Canvas container with PDF page render and token highlight boxes.
 */
const PdfPageNodeComponent: React.FC<NodeProps<PdfPageNodeType>> = ({
  data,
}) => {
  const {
    sourcePdfBytes,
    activePageIndex = 0,
    pageWidth = 595,
    pageHeight = 842,
    rotation = 0,
    detectedTokens = [],
    fieldMappings = [],
    onConfirmToken,
    onPageLoaded,
    onTokensDiscovered,
    onPageClick,
    viewport,
  } = data;

  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load document once per sourcePdfBytes with defensive buffer cloning (.slice(0))
  useEffect(() => {
    if (!sourcePdfBytes || sourcePdfBytes.length === 0) return;

    let isCancelled = false;

    const loadDoc = async () => {
      try {
        setLoading(true);
        setError(null);

        const clonedBytes = sourcePdfBytes.slice(0);
        const loadingTask = pdfjsLib.getDocument({
          data: clonedBytes,
          standardFontDataUrl: STANDARD_FONT_DATA_URL,
        });
        const loadedDoc = await loadingTask.promise;

        if (isCancelled) return;
        setDoc(loadedDoc);
      } catch (err: any) {
        if (!isCancelled) {
          console.error("Error loading PDF document in PdfPageNode:", err);
          setError(err.message || "Failed to load PDF document");
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    loadDoc();

    return () => {
      isCancelled = true;
    };
  }, [sourcePdfBytes]);

  const currentVp: ViewportConfig = viewport || {
    width: pageWidth,
    height: pageHeight,
    scale: 1.0,
    rotation,
  };

  // Only show placeholders on current page that haven't been converted into fields yet
  const pageTokens = detectedTokens.filter(
    (t) =>
      t.pageIndex === activePageIndex &&
      !fieldMappings.some(
        (m) => m.key === t.key && m.pageIndex === activePageIndex,
      ),
  );

  return (
    <div
      onClick={() => onPageClick?.()}
      className="relative bg-white shadow-2xl rounded-sm border border-slate-300 select-none cursor-default"
      style={{ width: `${pageWidth}px`, height: `${pageHeight}px` }}
    >
      {/* Isolated Memoized PDF Canvas */}
      <MemoizedPdfCanvas
        doc={doc}
        activePageIndex={activePageIndex}
        rotation={rotation}
        onPageLoaded={onPageLoaded}
        onTokensDiscovered={onTokensDiscovered}
      />

      {/* Suggested Token Placeholders Overlay */}
      {pageTokens.map((token, idx) => {
        const domRect = pdfToDomRect(token.rect, currentVp);
        return (
          <Tooltip
            key={`token-${idx}`}
            asChild
            content={`Click to convert placeholder "{{${token.key}}}" into an editable field`}
            side="top"
          >
            <div
              data-token-placeholder="true"
              onClick={(e) => {
                e.stopPropagation();
                onConfirmToken?.(token, e.shiftKey || e.ctrlKey || e.metaKey);
              }}
              className="absolute pointer-events-auto border-2 border-dashed border-amber-400 bg-amber-500/10 hover:bg-amber-500/25 cursor-pointer rounded transition-colors group flex items-center justify-center text-xs text-amber-700 font-mono z-20"
              style={{
                left: `${domRect.x}px`,
                top: `${domRect.y}px`,
                width: `${domRect.width}px`,
                height: `${domRect.height}px`,
              }}
            >
              <span className="bg-amber-100 text-amber-800 text-[10px] px-1 py-0.5 rounded shadow-xs opacity-90 group-hover:opacity-100 truncate max-w-full">
                + &#123;&#123;{token.key}&#125;&#125;
              </span>
            </div>
          </Tooltip>
        );
      })}

      {/* Loading Overlay (ONLY during initial load when document is not yet available) */}
      {!doc && loading && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center text-xs text-slate-500 font-medium z-40">
          Loading Page Canvas...
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-red-50/90 flex items-center justify-center p-4 z-40">
          <div className="text-red-600 text-xs text-center font-medium">
            {error}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * @component PdfPageNode
 * @description Performance-memoized React Flow node export for PdfPageNodeComponent with custom property equality checking.
 * @param {NodeProps<PdfPageNodeType>} props - React Flow custom node properties.
 * @returns {JSX.Element} Memoized background canvas page node.
 */
export const PdfPageNode = React.memo(
  PdfPageNodeComponent,
  (prev, next) =>
    prev.data.sourcePdfBytes === next.data.sourcePdfBytes &&
    prev.data.activePageIndex === next.data.activePageIndex &&
    prev.data.rotation === next.data.rotation &&
    prev.data.pageWidth === next.data.pageWidth &&
    prev.data.pageHeight === next.data.pageHeight &&
    prev.data.detectedTokens === next.data.detectedTokens &&
    prev.data.fieldMappings === next.data.fieldMappings &&
    prev.data.onConfirmToken === next.data.onConfirmToken &&
    prev.data.onPageClick === next.data.onPageClick &&
    prev.data.viewport === next.data.viewport,
);
