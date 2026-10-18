/**
 * @file FloatingFieldToolbar.tsx
 * @description Floating contextual action bar pinned above or below an active field box in the overlay layer.
 * @architecture Contextual micro-toolbar component for quick-toggle operations without opening the full inspector.
 * @agent_note Provides fast 1-click transparency toggle, text/mask color pickers, field duplicate, and deletion.
 */

import React from "react";
import type { IFieldMapping } from "./types";
import type { DomRect } from "@/lib/pdf-engine/coordinate-transforms";
import { Tooltip } from "@/components/ui/tooltip";
import { Copy, Trash, Eye, EyeSlash } from "@phosphor-icons/react";

interface FloatingFieldToolbarProps {
  field: IFieldMapping;
  boxDomRect: DomRect;
  onUpdateField: (updated: IFieldMapping) => void;
  onDuplicateField: (field: IFieldMapping) => void;
  onDeleteField: (id: string) => void;
}

/**
 * @component FloatingFieldToolbar
 * @description Floating badge toolbar positioned relative to a selected field offering fast-action toggles.
 * @param {FloatingFieldToolbarProps} props - Component properties.
 * @param {IFieldMapping} props.field - Field mapping currently targeted.
 * @param {DomRect} props.boxDomRect - Target field's DOM bounding rectangle for positioning.
 * @param {(updated: IFieldMapping) => void} props.onUpdateField - Field update mutation callback.
 * @param {(field: IFieldMapping) => void} props.onDuplicateField - Field clone callback.
 * @param {(id: string) => void} props.onDeleteField - Field delete callback.
 * @state Stateless floating micro-toolbar; calculates whether to render above or below field box based on DOM position.
 * @api Parent callbacks: onUpdateField, onDuplicateField, onDeleteField.
 * @returns {JSX.Element} Floating micro-toolbar.
 */
export const FloatingFieldToolbar: React.FC<FloatingFieldToolbarProps> = ({
  field,
  boxDomRect,
  onUpdateField,
  onDuplicateField,
  onDeleteField,
}) => {
  const isTransparent = field.maskMode === "none";
  const showBelow = boxDomRect.y < 46;

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

  const handleTextColorChange = (color: string) => {
    onUpdateField({ ...field, color });
  };

  const handleMaskColorChange = (color: string) => {
    onUpdateField({ ...field, maskMode: "custom-color", maskColor: color });
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={`absolute z-40 flex items-center gap-1.5 px-2 py-1 bg-slate-900/95 text-white rounded-md shadow-lg border border-slate-700/80 backdrop-blur-xs text-xs select-none transition-all ${
        showBelow ? "top-[calc(100%+8px)]" : "-top-10"
      } left-1/2 -translate-x-1/2`}
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
            onChange={(e) => handleTextColorChange(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
          <div
            className="w-full h-full"
            style={{ backgroundColor: field.color || "#000000" }}
          />
        </div>
      </div>

      {/* Background / Mask Color (Only active when not transparent) */}
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
              onChange={(e) => handleMaskColorChange(e.target.value)}
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
      <Tooltip content="Duplicate Field (Offset +10pt)" side="top">
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
          onClick={() => onDeleteField(field.id)}
          className="p-1 hover:bg-red-950/80 text-red-400 hover:text-red-300 rounded transition-colors"
        >
          <Trash size={13} weight="bold" />
        </button>
      </Tooltip>
    </div>
  );
};
