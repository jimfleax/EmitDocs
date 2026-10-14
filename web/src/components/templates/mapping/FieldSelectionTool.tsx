/**
 * @file FieldSelectionTool.tsx
 * @description Marquee drag-to-select tool allowing users to draw a rectangular bounding box to create new fields.
 * @architecture Interactive canvas overlay translating pointer drag box from DOM coordinates into PDF coordinate rects.
 * @agent_note Active when the user chooses the "Draw Field" tool; invokes onAreaSelected with normalized PDF points.
 */

import React, { useState, useRef } from "react";
import {
  domToPdfRect,
  type ViewportConfig,
  type PdfRect,
} from "@/lib/pdf-engine/coordinate-transforms";

interface FieldSelectionToolProps {
  viewport: ViewportConfig;
  isActive: boolean;
  onAreaSelected: (pdfRect: PdfRect) => void;
  children: React.ReactNode;
}

/**
 * @component FieldSelectionTool
 * @description Marquee selection interaction container providing visual bounding box during drag-to-create actions.
 * @param {FieldSelectionToolProps} props - Component properties.
 * @param {ViewportConfig} props.viewport - Coordinate mapping viewport parameters.
 * @param {boolean} props.isActive - Whether marquee drawing mode is currently enabled.
 * @param {(pdfRect: PdfRect) => void} props.onAreaSelected - Callback triggered on mouse up with normalized PDF bounds.
 * @param {React.ReactNode} props.children - Enclosed canvas or page elements.
 * @returns {JSX.Element} Wrapper container with drawing canvas overlay.
 */
export const FieldSelectionTool: React.FC<FieldSelectionToolProps> = ({
  viewport,
  isActive,
  onAreaSelected,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [currentPoint, setCurrentPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isActive) return;
    if (e.button !== 0) return; // primary click only

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setStartPoint({ x, y });
    setCurrentPoint({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!startPoint || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(viewport.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(viewport.height, e.clientY - rect.top));

    setCurrentPoint({ x, y });
  };

  const handleMouseUp = () => {
    if (!startPoint || !currentPoint) {
      setStartPoint(null);
      setCurrentPoint(null);
      return;
    }

    const minX = Math.min(startPoint.x, currentPoint.x);
    const maxX = Math.max(startPoint.x, currentPoint.x);
    const minY = Math.min(startPoint.y, currentPoint.y);
    const maxY = Math.max(startPoint.y, currentPoint.y);

    const width = maxX - minX;
    const height = maxY - minY;

    setStartPoint(null);
    setCurrentPoint(null);

    if (width >= 15 && height >= 10) {
      const pdfRect = domToPdfRect(
        { x: minX, y: minY, width, height },
        viewport,
      );
      onAreaSelected({
        x: Math.round(pdfRect.x * 10) / 10,
        y: Math.round(pdfRect.y * 10) / 10,
        width: Math.round(pdfRect.width * 10) / 10,
        height: Math.round(pdfRect.height * 10) / 10,
      });
    }
  };

  const marqueeDom =
    startPoint && currentPoint
      ? {
          x: Math.min(startPoint.x, currentPoint.x),
          y: Math.min(startPoint.y, currentPoint.y),
          width: Math.abs(currentPoint.x - startPoint.x),
          height: Math.abs(currentPoint.y - startPoint.y),
        }
      : null;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 select-none ${isActive ? "cursor-crosshair pointer-events-auto" : "pointer-events-none"}`}
      style={{ width: `${viewport.width}px`, height: `${viewport.height}px` }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {children}

      {marqueeDom && (
        <div
          className="absolute border-2 border-dashed border-blue-600 bg-blue-500/20 pointer-events-none z-30"
          style={{
            left: `${marqueeDom.x}px`,
            top: `${marqueeDom.y}px`,
            width: `${marqueeDom.width}px`,
            height: `${marqueeDom.height}px`,
          }}
        >
          <div className="absolute -top-5 left-0 px-1 py-0.5 bg-blue-600 text-white text-[9px] rounded font-mono">
            {Math.round(marqueeDom.width)} × {Math.round(marqueeDom.height)} px
          </div>
        </div>
      )}
    </div>
  );
};
