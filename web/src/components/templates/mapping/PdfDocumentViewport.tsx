import React, { useEffect, useRef, useState } from 'react';
import { pdfjsLib, STANDARD_FONT_DATA_URL } from '@/lib/pdf-engine/worker-setup';
import type { ViewportConfig, PdfRect } from '@/lib/pdf-engine/coordinate-transforms';
import { detectTokensInTextItems, type DetectedToken } from '@/lib/pdf-engine/token-detector';
import { FieldOverlayLayer } from './FieldOverlayLayer';
import { FieldSelectionTool } from './FieldSelectionTool';
import type { IFieldMapping } from './types';

interface PdfDocumentViewportProps {
  sourcePdfBytes: Uint8Array | null;
  activePageIndex: number;
  scale: number;
  rotation: number;
  fieldMappings: IFieldMapping[];
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  onUpdateField: (field: IFieldMapping) => void;
  onAreaSelected: (pdfRect: PdfRect) => void;
  detectedTokens: DetectedToken[];
  onTokensDiscovered: (tokens: DetectedToken[]) => void;
  onConfirmToken: (token: DetectedToken) => void;
  isDrawMode: boolean;
  onPageCountDetermined: (count: number) => void;
  onViewportChange?: (vp: ViewportConfig) => void;
  onDuplicateField?: (field: IFieldMapping) => void;
  onDeleteField?: (id: string) => void;
  isSnapEnabled?: boolean;
  snapThresholdPx?: number;
}

export const PdfDocumentViewport: React.FC<PdfDocumentViewportProps> = ({
  sourcePdfBytes,
  activePageIndex,
  scale,
  rotation,
  fieldMappings,
  selectedFieldId,
  onSelectField,
  onUpdateField,
  onAreaSelected,
  detectedTokens,
  onTokensDiscovered,
  onConfirmToken,
  isDrawMode,
  onPageCountDetermined,
  onViewportChange,
  onDuplicateField,
  onDeleteField,
  isSnapEnabled = true,
  snapThresholdPx = 8,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const onTokensDiscoveredRef = useRef(onTokensDiscovered);
  const onPageCountDeterminedRef = useRef(onPageCountDetermined);
  const onViewportChangeRef = useRef(onViewportChange);

  useEffect(() => {
    onTokensDiscoveredRef.current = onTokensDiscovered;
    onPageCountDeterminedRef.current = onPageCountDetermined;
    onViewportChangeRef.current = onViewportChange;
  }, [onTokensDiscovered, onPageCountDetermined, onViewportChange]);

  const [doc, setDoc] = useState<any>(null);
  const [viewportConfig, setViewportConfig] = useState<ViewportConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Load document once per sourcePdfBytes (clone buffer with .slice(0) so postMessage never detaches original)
  useEffect(() => {
    if (!sourcePdfBytes || sourcePdfBytes.length === 0) return;

    let isCancelled = false;

    const loadDoc = async () => {
      try {
        setLoading(true);
        setError(null);

        // Clone buffer to guarantee sourcePdfBytes remains untouched in main thread
        const clonedBytes = sourcePdfBytes.slice(0);
        const loadingTask = pdfjsLib.getDocument({
          data: clonedBytes,
          standardFontDataUrl: STANDARD_FONT_DATA_URL,
        });
        const loadedDoc = await loadingTask.promise;

        if (isCancelled) return;

        setDoc(loadedDoc);
        onPageCountDeterminedRef.current(loadedDoc.numPages);
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Error loading PDF document in viewport:', err);
          setError(err.message || 'Failed to load PDF document');
          setLoading(false);
        }
      }
    };

    loadDoc();

    return () => {
      isCancelled = true;
    };
  }, [sourcePdfBytes]);

  // 2. Render page whenever doc, activePageIndex, scale, or rotation changes
  useEffect(() => {
    if (!doc) return;

    let isCancelled = false;

    const renderPage = async () => {
      try {
        setLoading(true);
        setError(null);

        // Cancel previous render in progress if any
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // ignore
          }
          renderTaskRef.current = null;
        }

        const targetPageNum = Math.min(doc.numPages, Math.max(1, activePageIndex + 1));
        const page = await doc.getPage(targetPageNum);
        if (isCancelled) return;

        // Extract text items for token discovery
        const textContent = await page.getTextContent();
        if (!isCancelled) {
          const textItems = textContent.items.filter((item: any) => typeof item.str === 'string') as any[];
          const discovered = detectTokensInTextItems(textItems, activePageIndex);
          onTokensDiscoveredRef.current(discovered);
        }

        const effectiveRotation = ((page.rotate + rotation) % 360 + 360) % 360;
        const canonicalViewport = page.getViewport({ scale, rotation: effectiveRotation });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const effectiveScale = Math.min(4.0, Math.max(2.0, scale * dpr));
        const renderViewport = page.getViewport({ scale: effectiveScale, rotation: effectiveRotation });

        const targetPixelWidth = Math.floor(renderViewport.width);
        const targetPixelHeight = Math.floor(renderViewport.height);

        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = targetPixelWidth;
        offscreenCanvas.height = targetPixelHeight;

        const offCtx = offscreenCanvas.getContext('2d', { alpha: false });
        if (!offCtx) return;

        offCtx.imageSmoothingEnabled = true;
        offCtx.imageSmoothingQuality = 'high';

        const newVp: ViewportConfig = {
          width: canonicalViewport.width,
          height: canonicalViewport.height,
          scale,
          rotation: effectiveRotation,
        };
        setViewportConfig(newVp);
        onViewportChangeRef.current?.(newVp);

        const renderTask = page.render({
          canvasContext: offCtx,
          viewport: renderViewport,
          intent: 'display',
        });
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        if (isCancelled) return;

        if (canvas.width !== targetPixelWidth || canvas.height !== targetPixelHeight) {
          canvas.width = targetPixelWidth;
          canvas.height = targetPixelHeight;
        }
        canvas.style.width = `${Math.floor(canonicalViewport.width)}px`;
        canvas.style.height = `${Math.floor(canonicalViewport.height)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(offscreenCanvas, 0, 0);
      } catch (err: any) {
        if (!isCancelled && err?.name !== 'RenderingCancelledException') {
          console.error('Error rendering PDF page in viewport:', err);
          setError(err.message || 'Failed to render PDF page');
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRef.current = null;
      }
    };
  }, [doc, activePageIndex, scale, rotation]);

  return (
    <div className="relative flex justify-center items-center p-6 bg-slate-200/60 rounded-xl overflow-auto min-h-[500px]">
      {error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-600 text-xs">
          {error}
        </div>
      ) : (
        <div
          className="relative shadow-2xl bg-white border border-slate-300 rounded overflow-visible select-none inline-block"
          style={viewportConfig ? { width: `${viewportConfig.width}px`, height: `${viewportConfig.height}px` } : undefined}
          onMouseDown={(e) => {
            if (e.target === canvasRef.current || e.target === e.currentTarget) {
              onSelectField(null);
            }
          }}
        >
          <canvas ref={canvasRef} className="block" />

          {viewportConfig && (
            <FieldSelectionTool
              viewport={viewportConfig}
              isActive={isDrawMode}
              onAreaSelected={onAreaSelected}
            >
              <FieldOverlayLayer
                viewport={viewportConfig}
                fieldMappings={fieldMappings}
                activePageIndex={activePageIndex}
                selectedFieldId={selectedFieldId}
                onSelectField={onSelectField}
                onUpdateField={onUpdateField}
                onDuplicateField={onDuplicateField}
                onDeleteField={onDeleteField}
                detectedTokens={detectedTokens}
                onConfirmToken={onConfirmToken}
                isDrawing={isDrawMode}
                isSnapEnabled={isSnapEnabled}
                snapThresholdPx={snapThresholdPx}
              />
            </FieldSelectionTool>
          )}

          {loading && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center text-xs text-slate-500 font-medium z-40">
              Loading Page Canvas...
            </div>
          )}
        </div>
      )}
    </div>
  );
};
