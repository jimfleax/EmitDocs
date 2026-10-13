import React from "react";
import { ViewportPortal } from "@xyflow/react";
import type { AlignmentGuide } from "@/lib/pdf-engine/alignment-snapper";

export interface AlignmentGuidesOverlayProps {
  guides: AlignmentGuide[];
  width: number;
  height: number;
}

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
