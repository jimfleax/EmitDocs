import React, { useRef, useState, useEffect } from "react";
import type { IFieldMapping } from "./types";
import {
  pdfToDomRect,
  domToPdfRect,
  type ViewportConfig,
  type DomRect,
} from "@/lib/pdf-engine/coordinate-transforms";
import type { DetectedToken } from "@/lib/pdf-engine/token-detector";
import {
  calculateSnapping,
  type AlignmentGuide,
  type HandleType,
} from "@/lib/pdf-engine/alignment-snapper";
import { FloatingFieldToolbar } from "./FloatingFieldToolbar";
import { Tooltip } from "@/components/ui/tooltip";

interface FieldOverlayLayerProps {
  viewport: ViewportConfig;
  fieldMappings: IFieldMapping[];
  activePageIndex: number;
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  onUpdateField: (field: IFieldMapping) => void;
  onDuplicateField?: (field: IFieldMapping) => void;
  onDeleteField?: (id: string) => void;
  detectedTokens: DetectedToken[];
  onConfirmToken: (token: DetectedToken) => void;
  isDrawing: boolean;
  isSnapEnabled?: boolean;
  snapThresholdPx?: number;
}

export const FieldOverlayLayer: React.FC<FieldOverlayLayerProps> = ({
  viewport,
  fieldMappings,
  activePageIndex,
  selectedFieldId,
  onSelectField,
  onUpdateField,
  onDuplicateField,
  onDeleteField,
  detectedTokens,
  onConfirmToken,
  isDrawing,
  isSnapEnabled = true,
  snapThresholdPx = 8,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeGuides, setActiveGuides] = useState<AlignmentGuide[]>([]);
  const [dragState, setDragState] = useState<{
    fieldId: string;
    type: HandleType;
    startX: number;
    startY: number;
    initialDom: DomRect;
  } | null>(null);

  const currentPageMappings = fieldMappings.filter(
    (m) => m.pageIndex === activePageIndex,
  );
  const currentPageTokens = detectedTokens.filter(
    (t) =>
      t.pageIndex === activePageIndex &&
      !fieldMappings.some(
        (m) => m.key === t.key && m.pageIndex === activePageIndex,
      ),
  );

  // Drag & 8-Point Resize with Magnetic Snapping
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;

      const candidate: DomRect = { ...dragState.initialDom };

      switch (dragState.type) {
        case "move":
          candidate.x = Math.max(
            0,
            Math.min(viewport.width - candidate.width, candidate.x + dx),
          );
          candidate.y = Math.max(
            0,
            Math.min(viewport.height - candidate.height, candidate.y + dy),
          );
          break;
        case "n": {
          const newH = Math.max(12, candidate.height - dy);
          candidate.y += candidate.height - newH;
          candidate.height = newH;
          break;
        }
        case "s": {
          candidate.height = Math.max(12, candidate.height + dy);
          break;
        }
        case "w": {
          const newW = Math.max(20, candidate.width - dx);
          candidate.x += candidate.width - newW;
          candidate.width = newW;
          break;
        }
        case "e": {
          candidate.width = Math.max(20, candidate.width + dx);
          break;
        }
        case "se": {
          candidate.width = Math.max(20, candidate.width + dx);
          candidate.height = Math.max(12, candidate.height + dy);
          break;
        }
        case "sw": {
          const newWSw = Math.max(20, candidate.width - dx);
          candidate.x += candidate.width - newWSw;
          candidate.width = newWSw;
          candidate.height = Math.max(12, candidate.height + dy);
          break;
        }
        case "ne": {
          candidate.width = Math.max(20, candidate.width + dx);
          const newHNe = Math.max(12, candidate.height - dy);
          candidate.y += candidate.height - newHNe;
          candidate.height = newHNe;
          break;
        }
        case "nw": {
          const newWNw = Math.max(20, candidate.width - dx);
          const newHNw = Math.max(12, candidate.height - dy);
          candidate.x += candidate.width - newWNw;
          candidate.y += candidate.height - newHNw;
          candidate.width = newWNw;
          candidate.height = newHNw;
          break;
        }
      }

      // Magnetic alignment snapping
      let finalDom = candidate;
      if (isSnapEnabled) {
        const siblingDomRects = currentPageMappings
          .filter((m) => m.id !== dragState.fieldId)
          .map((m) => pdfToDomRect(m.rect, viewport));

        const snapResult = calculateSnapping(
          candidate,
          siblingDomRects,
          viewport,
          {
            thresholdPx: snapThresholdPx,
            isAltPressed: e.altKey,
            handleType: dragState.type,
          },
        );

        finalDom = snapResult.rect;
        setActiveGuides(snapResult.guides);
      } else {
        setActiveGuides([]);
      }

      // Convert back to canonical PDF points
      const updatedPdfRect = domToPdfRect(finalDom, viewport);
      const field = fieldMappings.find((m) => m.id === dragState.fieldId);
      if (field) {
        onUpdateField({
          ...field,
          rect: {
            x: Math.round(updatedPdfRect.x * 10) / 10,
            y: Math.round(updatedPdfRect.y * 10) / 10,
            width: Math.round(updatedPdfRect.width * 10) / 10,
            height: Math.round(updatedPdfRect.height * 10) / 10,
          },
        });
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
      setActiveGuides([]);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    dragState,
    viewport,
    fieldMappings,
    onUpdateField,
    isSnapEnabled,
    snapThresholdPx,
    currentPageMappings,
  ]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none select-none"
      style={{ width: `${viewport.width}px`, height: `${viewport.height}px` }}
    >
      {/* Magnetic Alignment Guides (Magenta Snapping Lines) */}
      {activeGuides.map((guide, idx) => {
        if (guide.type === "vertical") {
          return (
            <div
              key={`guide-v-${idx}`}
              className="absolute pointer-events-none z-30"
              style={{
                left: `${guide.position}px`,
                top: 0,
                bottom: 0,
                width: "1.5px",
                backgroundColor: "#ec4899",
                boxShadow: "0 0 4px rgba(236, 72, 153, 0.7)",
              }}
            >
              {guide.label && (
                <span className="absolute top-2 left-1.5 px-1 py-0.5 bg-pink-600 text-white text-[9px] rounded font-mono shadow-xs whitespace-nowrap">
                  {guide.label}
                </span>
              )}
            </div>
          );
        } else {
          return (
            <div
              key={`guide-h-${idx}`}
              className="absolute pointer-events-none z-30"
              style={{
                top: `${guide.position}px`,
                left: 0,
                right: 0,
                height: "1.5px",
                backgroundColor: "#ec4899",
                boxShadow: "0 0 4px rgba(236, 72, 153, 0.7)",
              }}
            >
              {guide.label && (
                <span className="absolute left-2 -top-4 px-1 py-0.5 bg-pink-600 text-white text-[9px] rounded font-mono shadow-xs whitespace-nowrap">
                  {guide.label}
                </span>
              )}
            </div>
          );
        }
      })}

      {/* Suggested Token Placeholders (Dashed Boxes) */}
      {!isDrawing &&
        currentPageTokens.map((token, idx) => {
          const domRect = pdfToDomRect(token.rect, viewport);
          return (
            <Tooltip
              key={`token-${idx}`}
              content={`Click to convert placeholder "{{${token.key}}}" into an editable field`}
              side="top"
            >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirmToken(token);
                }}
                className="absolute pointer-events-auto border-2 border-dashed border-amber-400 bg-amber-500/10 hover:bg-amber-500/25 cursor-pointer rounded transition-colors group flex items-center justify-center text-xs text-amber-700 font-mono"
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

      {/* Confirmed / Custom Field Boxes */}
      {currentPageMappings.map((field) => {
        const domRect = pdfToDomRect(field.rect, viewport);
        const isSelected = field.id === selectedFieldId;

        return (
          <div
            key={field.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectField(field.id);
            }}
            className={`absolute pointer-events-auto border-2 rounded transition-shadow ${
              isSelected
                ? "border-blue-600 bg-blue-500/15 shadow-md z-20 cursor-move"
                : "border-blue-400 bg-blue-400/10 hover:bg-blue-400/20 cursor-pointer z-10"
            }`}
            style={{
              left: `${domRect.x}px`,
              top: `${domRect.y}px`,
              width: `${domRect.width}px`,
              height: `${domRect.height}px`,
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              if (!isSelected) onSelectField(field.id);
              setDragState({
                fieldId: field.id,
                type: "move",
                startX: e.clientX,
                startY: e.clientY,
                initialDom: domRect,
              });
            }}
          >
            {/* Live In-Canvas Styled Text Preview */}
            <div
              className="w-full h-full flex items-center px-1 overflow-hidden pointer-events-none select-none"
              style={{
                justifyContent:
                  field.alignment === "center"
                    ? "center"
                    : field.alignment === "right"
                      ? "flex-end"
                      : "flex-start",
                color: field.color || "#000000",
                fontFamily: field.fontFamily || "Helvetica, sans-serif",
                fontSize: `${Math.max(9, Math.round((field.fontSize || 14) * (viewport.scale || 1)))}px`,
                backgroundColor:
                  field.maskMode === "solid-white"
                    ? "#FFFFFF"
                    : field.maskMode === "custom-color"
                      ? field.maskColor || "#FFFFFF"
                      : "transparent",
              }}
            >
              <span className="truncate leading-none">
                {field.sampleValue || field.label || field.key}
              </span>
            </div>
            {/* Field Label Badge */}
            <div
              className={`absolute -top-5 left-0 px-1.5 py-0.5 text-[10px] font-medium rounded truncate max-w-[150px] shadow-xs ${
                isSelected
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-100 opacity-80"
              }`}
            >
              {field.label || field.key}
            </div>

            {/* In-Canvas Floating Quick Toolbar */}
            {isSelected && onDuplicateField && onDeleteField && (
              <FloatingFieldToolbar
                field={field}
                boxDomRect={domRect}
                onUpdateField={onUpdateField}
                onDuplicateField={onDuplicateField}
                onDeleteField={onDeleteField}
              />
            )}

            {/* 8-Point Resize Handles (Only for selected field) */}
            {isSelected && (
              <>
                {/* Corners */}
                <div
                  className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize z-30 hover:scale-125 transition-transform"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDragState({
                      fieldId: field.id,
                      type: "nw",
                      startX: e.clientX,
                      startY: e.clientY,
                      initialDom: domRect,
                    });
                  }}
                />
                <div
                  className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-nesw-resize z-30 hover:scale-125 transition-transform"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDragState({
                      fieldId: field.id,
                      type: "ne",
                      startX: e.clientX,
                      startY: e.clientY,
                      initialDom: domRect,
                    });
                  }}
                />
                <div
                  className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize z-30 hover:scale-125 transition-transform"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDragState({
                      fieldId: field.id,
                      type: "se",
                      startX: e.clientX,
                      startY: e.clientY,
                      initialDom: domRect,
                    });
                  }}
                />
                <div
                  className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-nesw-resize z-30 hover:scale-125 transition-transform"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDragState({
                      fieldId: field.id,
                      type: "sw",
                      startX: e.clientX,
                      startY: e.clientY,
                      initialDom: domRect,
                    });
                  }}
                />

                {/* Edges */}
                <div
                  className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-ns-resize z-30 hover:scale-125 transition-transform"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDragState({
                      fieldId: field.id,
                      type: "n",
                      startX: e.clientX,
                      startY: e.clientY,
                      initialDom: domRect,
                    });
                  }}
                />
                <div
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-ns-resize z-30 hover:scale-125 transition-transform"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDragState({
                      fieldId: field.id,
                      type: "s",
                      startX: e.clientX,
                      startY: e.clientY,
                      initialDom: domRect,
                    });
                  }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-ew-resize z-30 hover:scale-125 transition-transform"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDragState({
                      fieldId: field.id,
                      type: "w",
                      startX: e.clientX,
                      startY: e.clientY,
                      initialDom: domRect,
                    });
                  }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-ew-resize z-30 hover:scale-125 transition-transform"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDragState({
                      fieldId: field.id,
                      type: "e",
                      startX: e.clientX,
                      startY: e.clientY,
                      initialDom: domRect,
                    });
                  }}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
