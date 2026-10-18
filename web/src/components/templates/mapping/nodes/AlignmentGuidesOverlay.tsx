/**
 * @file AlignmentGuidesOverlay.tsx
 * @description SVG overlay rendering dynamic magnetic snapping guides on top of the React Flow canvas.
 * @architecture Viewport portal overlay integrating alignment-snapper engine output with React Flow canvas coordinates.
 * @agent_note Renders horizontal and vertical glowing alignment lines and distance badges via ViewportPortal.
 */

import React from "react";
import { ViewportPortal } from "@xyflow/react";
import type { AlignmentGuide } from "@/lib/pdf-engine/alignment-snapper";

export interface AlignmentGuidesOverlayProps {
  guides: AlignmentGuide[];
  width: number;
  height: number;
}

/**
 * @component AlignmentGuidesOverlay
 * @description Visual overlay projecting magnetic alignment lines and measurement labels onto the canvas.
 * @param {AlignmentGuidesOverlayProps} props - Component properties.
 * @param {AlignmentGuide[]} props.guides - Active alignment guides computed by the snapping engine.
 * @param {number} props.width - Canvas overlay width in pixels.
 * @param {number} props.height - Canvas overlay height in pixels.
 * @state Stateless; projects SVG alignment markers into React Flow ViewportPortal.
 * @api Visual display component driven by alignment-snapper engine output.
 * @returns {JSX.Element | null} ViewportPortal containing SVG alignment lines, or null if no guides are active.
 */
export const AlignmentGuidesOverlay: React.FC<AlignmentGuidesOverlayProps> = ({
  guides,
  width,
  height,
}) => {
  if (!guides || guides.length === 0) return null;

  return (
    <ViewportPortal>
      <div
        className="absolute top-0 left-0 pointer-events-none z-30 select-none overflow-visible"
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        <svg
          className="absolute inset-0 pointer-events-none overflow-visible"
          width={width}
          height={height}
          style={{ width: `${width}px`, height: `${height}px` }}
        >
          <defs>
            <filter
              id="guides-glow-pink"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="2"
                floodColor="#ec4899"
                floodOpacity="0.8"
              />
            </filter>
          </defs>
          {guides.map((guide, idx) => {
            if (guide.type === "vertical") {
              return (
                <g key={`guide-v-${idx}`}>
                  <line
                    x1={guide.position}
                    y1={0}
                    x2={guide.position}
                    y2={height}
                    stroke="#ec4899"
                    strokeWidth="1.5"
                    filter="url(#guides-glow-pink)"
                  />
                  {guide.label && (
                    <g transform={`translate(${guide.position + 4}, 18)`}>
                      <rect
                        x="-2"
                        y="-12"
                        width={guide.label.length * 6.5 + 8}
                        height="16"
                        rx="3"
                        fill="#db2777"
                      />
                      <text
                        x="2"
                        y="0"
                        fill="#ffffff"
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="600"
                      >
                        {guide.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            } else {
              return (
                <g key={`guide-h-${idx}`}>
                  <line
                    x1={0}
                    y1={guide.position}
                    x2={width}
                    y2={guide.position}
                    stroke="#ec4899"
                    strokeWidth="1.5"
                    filter="url(#guides-glow-pink)"
                  />
                  {guide.label && (
                    <g transform={`translate(8, ${guide.position - 6})`}>
                      <rect
                        x="-2"
                        y="-12"
                        width={guide.label.length * 6.5 + 8}
                        height="16"
                        rx="3"
                        fill="#db2777"
                      />
                      <text
                        x="2"
                        y="0"
                        fill="#ffffff"
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="600"
                      >
                        {guide.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            }
          })}
        </svg>
      </div>
    </ViewportPortal>
  );
};
