import React, { useCallback } from "react";
import {
  NodeResizer,
  NodeToolbar,
  Position,
  type NodeProps,
  type Node,
  type OnResize,
  type OnResizeEnd,
} from "@xyflow/react";
import type { IFieldMapping } from "../types";
import type {
  ViewportConfig,
  DomRect,
} from "@/lib/pdf-engine/coordinate-transforms";
import { domToPdfRect } from "@/lib/pdf-engine/coordinate-transforms";
import {
  calculateSnapping,
  type AlignmentGuide,
} from "@/lib/pdf-engine/alignment-snapper";
import { Tooltip } from "@/components/ui/tooltip";
import { Eye, EyeSlash, Copy, Trash } from "@phosphor-icons/react";
import { formatFieldValue } from "@/lib/pdf-engine/format-engine";

export interface FieldNodeData {
  field: IFieldMapping;
  viewport: ViewportConfig;
  onUpdateField: (updated: IFieldMapping) => void;
  onDuplicateField: (field: IFieldMapping) => void;
  onDeleteField: (id: string) => void;
  isSnapEnabled?: boolean;
  snapThresholdPx?: number;
  setActiveGuides?: (guides: AlignmentGuide[]) => void;
  siblingsDomRects?: DomRect[];
  [key: string]: unknown;
}

export type FieldNodeType = Node<FieldNodeData, "field">;

const FieldNodeComponent: React.FC<NodeProps<FieldNodeType>> = ({
  id,
  data,
  selected,
}) => {
  const {
    field,
    viewport,
    onUpdateField,
    onDuplicateField,
    onDeleteField,
    isSnapEnabled = true,
    snapThresholdPx = 8,
    setActiveGuides,
    siblingsDomRects = [],
  } = data;

  const isTransparent = field.maskMode === "none";

  // Toggle transparency
  const toggleTransparency = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTransparent) {
      onUpdateField({
        ...field,
        maskMode: "solid-white",
        maskColor: "#ffffff",
      });
    } else {
      onUpdateField({ ...field, maskMode: "none" });
    }
  };

  // Resizing with magnetic snapping
  const handleResize: OnResize = useCallback(
    (event, params) => {
      if (!isSnapEnabled || !setActiveGuides) return;

      const isAltPressed = Boolean((event?.sourceEvent as MouseEvent)?.altKey);
      const candidate: DomRect = {
        x: params.x,
        y: params.y,
        width: params.width,
        height: params.height,
      };

      const snapResult = calculateSnapping(
        candidate,
        siblingsDomRects,
        viewport,
        {
          thresholdPx: snapThresholdPx,
          isAltPressed,
          handleType: "se",
        },
      );

      setActiveGuides(snapResult.guides);
    },
    [
      isSnapEnabled,
      setActiveGuides,
      siblingsDomRects,
      viewport,
      snapThresholdPx,
    ],
  );

  const handleResizeEnd: OnResizeEnd = useCallback(
    (event, params) => {
      setActiveGuides?.([]);

      let finalDom: DomRect = {
        x: params.x,
        y: params.y,
        width: params.width,
        height: params.height,
      };

      if (isSnapEnabled) {
        const isAltPressed = Boolean(
          (event?.sourceEvent as MouseEvent)?.altKey,
        );
        const snapResult = calculateSnapping(
          finalDom,
          siblingsDomRects,
          viewport,
          {
            thresholdPx: snapThresholdPx,
            isAltPressed,
            handleType: "se",
          },
        );
        finalDom = snapResult.rect;
      }

      const updatedPdfRect = domToPdfRect(finalDom, viewport);
      onUpdateField({
        ...field,
        rect: {
          x: Math.round(updatedPdfRect.x * 10) / 10,
          y: Math.round(updatedPdfRect.y * 10) / 10,
          width: Math.max(20, Math.round(updatedPdfRect.width * 10) / 10),
          height: Math.max(12, Math.round(updatedPdfRect.height * 10) / 10),
        },
      });
    },
    [
      setActiveGuides,
      isSnapEnabled,
      siblingsDomRects,
      viewport,
      snapThresholdPx,
      onUpdateField,
      field,
    ],
  );

  return (
    <div
      data-field-node="true"
      className={`relative w-full h-full rounded transition-shadow select-none group ${
        selected
          ? "border-2 border-blue-600 bg-blue-500/15 shadow-md ring-2 ring-blue-500/20 z-20 cursor-move"
          : "border border-blue-400 bg-blue-400/10 hover:bg-blue-400/20 hover:border-blue-500 cursor-pointer z-10"
      }`}
      style={{
        width: "100%",
        height: "100%",
      }}
    >
      {/* 8-Directional Handles via NodeResizer */}
      <NodeResizer
        isVisible={Boolean(selected)}
        minWidth={20}
        minHeight={12}
        handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-blue-600 !rounded-full hover:!scale-125 transition-transform"
        lineClassName="!border-blue-500/80"
        onResize={handleResize}
        onResizeEnd={handleResizeEnd}
      />

      {/* Floating NodeToolbar */}
      <NodeToolbar
        isVisible={Boolean(selected)}
        position={Position.Top}
        className="flex items-center gap-1.5 px-2 py-1 bg-slate-900/95 text-white rounded-md shadow-lg border border-slate-700/80 backdrop-blur-xs text-xs select-none"
      >
        {/* 1-Click Transparent Background Toggle */}
        <Tooltip
          content={
            isTransparent
              ? "Background is Transparent (Click to add fill)"
              : "Background has Fill (Click to make Transparent)"
          }
          side="top"
        >
          <button
            type="button"
            onClick={toggleTransparency}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
              isTransparent
                ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-600/40"
                : "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
            }`}
          >
            {isTransparent ? (
              <Eye size={12} weight="bold" className="text-emerald-400" />
            ) : (
              <EyeSlash size={12} weight="bold" className="text-slate-400" />
            )}
            <span>{isTransparent ? "Transparent" : "Filled"}</span>
          </button>
        </Tooltip>

        {/* Text Color Picker */}
        <div
          title="Text Color"
          className="flex items-center gap-1 border-l border-slate-700 pl-1.5"
        >
          <label className="text-[10px] text-slate-400 uppercase font-semibold cursor-pointer">
            T
          </label>
          <div className="relative w-4 h-4 rounded-full border border-slate-500 overflow-hidden cursor-pointer shadow-2xs hover:scale-110 transition-transform">
            <input
              type="color"
              value={field.color || "#000000"}
              onChange={(e) =>
                onUpdateField({ ...field, color: e.target.value })
              }
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
            <div
              className="w-full h-full"
              style={{ backgroundColor: field.color || "#000000" }}
            />
          </div>
        </div>

        {/* Background Fill Color (when not transparent) */}
        {!isTransparent && (
          <div
            title="Background Fill Color"
            className="flex items-center gap-1 border-l border-slate-700 pl-1.5"
          >
            <label className="text-[10px] text-slate-400 uppercase font-semibold cursor-pointer">
              BG
            </label>
            <div className="relative w-4 h-4 rounded-full border border-slate-500 overflow-hidden cursor-pointer shadow-2xs hover:scale-110 transition-transform">
              <input
                type="color"
                value={field.maskColor || "#ffffff"}
                onChange={(e) =>
                  onUpdateField({
                    ...field,
                    maskMode: "custom-color",
                    maskColor: e.target.value,
                  })
                }
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              />
              <div
                className="w-full h-full"
                style={{ backgroundColor: field.maskColor || "#ffffff" }}
              />
            </div>
          </div>
        )}

        {/* Duplicate Button */}
        <Tooltip content="Duplicate Field (Offset +12pt)" side="top">
          <button
            type="button"
            onClick={() => onDuplicateField(field)}
            className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors ml-0.5"
          >
            <Copy size={13} weight="bold" />
          </button>
        </Tooltip>

        {/* Delete Button */}
        <Tooltip content="Delete Field" side="top">
          <button
            type="button"
            onClick={() => onDeleteField(id)}
            className="p-1 hover:bg-red-950/80 text-red-400 hover:text-red-300 rounded transition-colors"
          >
            <Trash size={13} weight="bold" />
          </button>
        </Tooltip>
      </NodeToolbar>

      {/* Field Label Badge */}
      <div
        className={`absolute -top-5 left-0 px-1.5 py-0.5 text-[10px] font-medium rounded truncate max-w-[150px] shadow-xs pointer-events-none select-none z-10 ${
          selected
            ? "bg-blue-600 text-white"
            : "bg-slate-800 text-slate-100 opacity-80"
        }`}
      >
        {field.label || field.key}
      </div>

      {/* Live In-Box Styled Preview Text */}
      <div
        className="w-full h-full flex items-center px-1 overflow-hidden pointer-events-none select-none rounded-xs"
        style={{
          justifyContent:
            field.alignment === "center"
              ? "center"
              : field.alignment === "right"
                ? "flex-end"
                : "flex-start",
          color: field.color || "#000000",
          fontFamily: field.fontFamily || "Helvetica, sans-serif",
          fontSize: `${Math.max(9, Math.round(field.fontSize || 14))}px`,
          backgroundColor:
            field.maskMode === "solid-white"
              ? "#FFFFFF"
              : field.maskMode === "custom-color"
                ? field.maskColor || "#FFFFFF"
                : "transparent",
        }}
      >
        <span className="truncate leading-none">
          {formatFieldValue(
            field.sampleValue || field.label || field.key,
            field.type,
            field.format,
            field.textTransform,
          )}
        </span>
      </div>
    </div>
  );
};

export const FieldNode = React.memo(
  FieldNodeComponent,
  (prev, next) =>
    prev.selected === next.selected &&
    prev.data.field === next.data.field &&
    prev.data.isSnapEnabled === next.data.isSnapEnabled &&
    prev.data.snapThresholdPx === next.data.snapThresholdPx &&
    prev.data.viewport === next.data.viewport &&
    prev.data.onUpdateField === next.data.onUpdateField &&
    prev.data.onDuplicateField === next.data.onDuplicateField &&
    prev.data.onDeleteField === next.data.onDeleteField &&
    prev.data.setActiveGuides === next.data.setActiveGuides &&
    prev.data.siblingsDomRects === next.data.siblingsDomRects,
);
