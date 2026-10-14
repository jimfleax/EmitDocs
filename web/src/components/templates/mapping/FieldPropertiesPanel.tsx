/**
 * @file FieldPropertiesPanel.tsx
 * @description Configuration panel for adjusting field mapping key, label, data type, fonts, geometry, alignment, and masking.
 * @architecture Inspector drawer component for detailed field customization in the mapping workspace.
 * @agent_note Manages single and multi-selection batch properties, custom font upload (TTF/OTF via base64 data URL), formatting, and masking styles.
 */

import React, { useRef } from "react";
import type { IFieldMapping } from "./types";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  UploadSimple,
  Trash,
} from "@phosphor-icons/react";

interface FieldPropertiesPanelProps {
  field: IFieldMapping | null;
  fields?: IFieldMapping[];
  selectedFieldIds?: string[];
  onSelectField?: (id: string | null, isMulti?: boolean) => void;
  onUpdate: (updated: IFieldMapping) => void;
  onDelete: (id: string) => void;
  onDeleteMultiple?: (ids: string[]) => void;
}

/**
 * @component FieldPropertiesPanel
 * @description Detailed properties editor panel for inspecting and modifying field geometry, typography, and format rules.
 * @param {FieldPropertiesPanelProps} props - Component properties.
 * @returns {JSX.Element} Property fields form, multi-field summary, or empty selection state.
 */
const FieldPropertiesPanelComponent: React.FC<FieldPropertiesPanelProps> = ({
  field,
  fields = [],
  selectedFieldIds = [],
  onSelectField,
  onUpdate,
  onDelete,
  onDeleteMultiple,
}) => {
  const fontFileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = <K extends keyof IFieldMapping>(
    key: K,
    value: IFieldMapping[K],
  ) => {
    if (!field) return;
    onUpdate({ ...field, [key]: value });
  };

  const handleFontFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!field) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      const cleanFontName = file.name.replace(/\.[^/.]+$/, "");
      onUpdate({
        ...field,
        fontFamily: cleanFontName,
        customFontBytes: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleClearCustomFont = () => {
    if (!field) return;
    onUpdate({
      ...field,
      fontFamily: "Helvetica",
      customFontBytes: undefined,
    });
    if (fontFileInputRef.current) fontFileInputRef.current.value = "";
  };

  return (
    <div className="space-y-3.5 p-3 sm:p-3.5 bg-white border border-slate-200 rounded-xl text-xs shadow-2xs max-w-full overflow-hidden">
      {!field ? (
        fields.length > 0 ? (
          <div className="space-y-2">
            <p className="font-medium text-slate-700 text-[11px]">
              Select a field to configure:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {fields.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={(e) =>
                    onSelectField?.(f.id, e.shiftKey || e.ctrlKey || e.metaKey)
                  }
                  className={`px-2 py-1 rounded border font-mono text-[11px] transition-colors shadow-2xs cursor-pointer ${
                    selectedFieldIds.includes(f.id)
                      ? "bg-blue-50 border-blue-500 text-blue-700 font-semibold ring-1 ring-blue-500"
                      : "bg-slate-50 border-slate-200 hover:border-blue-500 text-blue-600"
                  }`}
                >
                  &#123;&#123;{f.key}&#125;&#125;
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-slate-500 text-xs">
            Select a field on the canvas or click a suggested token to configure
            styling and behavior.
          </div>
        )
      ) : (
        <>
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="font-semibold text-slate-800 text-sm">
                Field Configuration
              </h4>
              <span className="font-mono text-[11px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                &#123;&#123;{field.key}&#125;&#125;
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(field.id)}
              className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50 text-xs font-medium flex items-center gap-1"
            >
              <Trash size={13} weight="bold" />
              <span>Delete</span>
            </Button>
          </div>

          {fields.length > 1 && onSelectField && (
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Switch Configured Field
              </label>
              <Select
                value={field.id}
                onValueChange={(val) => onSelectField(val)}
              >
                <SelectTrigger className="w-full h-8 font-mono text-xs bg-white text-slate-700 border-slate-200">
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {fields.map((f) => (
                    <SelectItem
                      key={f.id}
                      value={f.id}
                      textValue={`{{${f.key}}} (${f.label || f.type})`}
                      className="font-mono text-xs"
                    >
                      {`{{${f.key}}} (${f.label || f.type})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedFieldIds.length > 1 && (
            <div className="flex items-center justify-between p-2 bg-blue-50/90 border border-blue-200/80 rounded-lg text-blue-800 text-[11px]">
              <span className="font-semibold">
                {selectedFieldIds.length} fields selected
              </span>
              {onDeleteMultiple && (
                <button
                  type="button"
                  onClick={() => onDeleteMultiple(selectedFieldIds)}
                  className="text-red-600 hover:text-red-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Trash size={12} weight="bold" />
                  <span>Delete All</span>
                </button>
              )}
            </div>
          )}

          {/* Key & Label */}
          <div className="space-y-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                Variable Key <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={field.key}
                onChange={(e) =>
                  handleChange(
                    "key",
                    e.target.value.trim().replace(/[^a-zA-Z0-9_.-]/g, ""),
                  )
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="e.g. fullName"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                Display Label
              </label>
              <input
                type="text"
                value={field.label || ""}
                onChange={(e) => handleChange("label", e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="e.g. Recipient Full Name"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                Type
              </label>
              <Select
                value={field.type}
                onValueChange={(val) => {
                  if (val === "text") {
                    onUpdate({ ...field, type: "text", format: undefined });
                  } else {
                    handleChange("type", val as any);
                  }
                }}
              >
                <SelectTrigger className="w-full h-8 text-xs bg-white text-slate-700 border-slate-200">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {field.type === "date" && (
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                  Date Format
                </label>
                <Select
                  value={field.format || "YYYY-MM-DD"}
                  onValueChange={(val) => handleChange("format", val)}
                >
                  <SelectTrigger className="w-full h-8 text-xs bg-white text-slate-700 border-slate-200 font-mono">
                    <SelectValue placeholder="Select date format" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="YYYY-MM-DD">
                      YYYY-MM-DD (2026-10-12)
                    </SelectItem>
                    <SelectItem value="DD/MM/YYYY">
                      DD/MM/YYYY (12/10/2026)
                    </SelectItem>
                    <SelectItem value="MM/DD/YYYY">
                      MM/DD/YYYY (10/12/2026)
                    </SelectItem>
                    <SelectItem value="MMMM D, YYYY">
                      MMMM D, YYYY (October 12, 2026)
                    </SelectItem>
                    <SelectItem value="MMM D, YYYY">
                      MMM D, YYYY (Oct 12, 2026)
                    </SelectItem>
                    <SelectItem value="YYYY-MM-DD HH:mm:ss">
                      ISO with Time (2026-10-12 10:30:00)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {field.type === "number" && (
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                  Number / Currency Format
                </label>
                <Select
                  value={field.format || "decimal:2"}
                  onValueChange={(val) => handleChange("format", val)}
                >
                  <SelectTrigger className="w-full h-8 text-xs bg-white text-slate-700 border-slate-200 font-mono">
                    <SelectValue placeholder="Select number format" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="decimal:2">
                      Decimal 2 places (1,234.56)
                    </SelectItem>
                    <SelectItem value="decimal:0">Integer (1,235)</SelectItem>
                    <SelectItem value="currency:USD">
                      US Dollar ($1,234.56)
                    </SelectItem>
                    <SelectItem value="currency:EUR">
                      Euro (€1,234.56)
                    </SelectItem>
                    <SelectItem value="currency:GBP">
                      British Pound (£1,234.56)
                    </SelectItem>
                    <SelectItem value="currency:JPY">
                      Japanese Yen (¥1,235)
                    </SelectItem>
                    <SelectItem value="percent:0">Percentage (12%)</SelectItem>
                    <SelectItem value="percent:2">
                      Percentage 2 decimals (12.34%)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Typography */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h5 className="font-medium text-slate-700 text-[11px] uppercase tracking-wider">
              Typography
            </h5>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                Font Family
              </label>
              {field.customFontBytes ? (
                <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded text-xs gap-2 min-w-0">
                  <span className="font-medium text-blue-800 truncate min-w-0 flex-1">
                    Custom: {field.fontFamily}
                  </span>
                  <button
                    type="button"
                    onClick={handleClearCustomFont}
                    className="text-xs text-red-600 hover:text-red-800 font-medium shrink-0"
                  >
                    Reset
                  </button>
                </div>
              ) : (
                <Select
                  value={field.fontFamily}
                  onValueChange={(val) => handleChange("fontFamily", val)}
                >
                  <SelectTrigger className="w-full h-8 text-xs bg-white text-slate-700 border-slate-200">
                    <SelectValue placeholder="Select font" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Helvetica">
                      Helvetica (Standard)
                    </SelectItem>
                    <SelectItem value="Helvetica-Bold">
                      Helvetica Bold
                    </SelectItem>
                    <SelectItem value="Times-Roman">Times Roman</SelectItem>
                    <SelectItem value="Times-Bold">Times Bold</SelectItem>
                    <SelectItem value="Courier">Courier</SelectItem>
                    <SelectItem value="Courier-Bold">Courier Bold</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {/* Custom Font Upload Button */}
              <div className="mt-1.5">
                <input
                  ref={fontFileInputRef}
                  type="file"
                  accept=".ttf,.otf"
                  onChange={handleFontFileUpload}
                  className="hidden"
                  id={`font-upload-${field.id}`}
                />
                <label
                  htmlFor={`font-upload-${field.id}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-md text-[11px] font-medium cursor-pointer transition-colors shadow-2xs"
                >
                  <UploadSimple size={13} weight="bold" />
                  <span>Upload Font (.ttf / .otf)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                Text Transform
              </label>
              <Select
                value={field.textTransform || "none"}
                onValueChange={(val) =>
                  handleChange("textTransform", val as any)
                }
              >
                <SelectTrigger className="w-full h-8 text-xs bg-white text-slate-700 border-slate-200">
                  <SelectValue placeholder="Select text transform" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="none">Normal (As entered)</SelectItem>
                  <SelectItem value="uppercase">UPPERCASE</SelectItem>
                  <SelectItem value="lowercase">lowercase</SelectItem>
                  <SelectItem value="capitalize">
                    Capitalize (Title Case)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                  Min Font Size (pt)
                </label>
                <input
                  type="number"
                  min={6}
                  max={36}
                  value={field.minFontSize}
                  onChange={(e) =>
                    handleChange("minFontSize", Number(e.target.value) || 8)
                  }
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                  Max Font Size (pt)
                </label>
                <input
                  type="number"
                  min={6}
                  max={72}
                  value={field.maxFontSize}
                  onChange={(e) =>
                    handleChange("maxFontSize", Number(e.target.value) || 24)
                  }
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 items-center">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                  Text Color
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={field.color}
                    onChange={(e) => handleChange("color", e.target.value)}
                    className="w-7 h-7 p-0 border border-slate-300 rounded cursor-pointer"
                  />
                  <span className="font-mono text-[11px] text-slate-600 uppercase">
                    {field.color}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                  Alignment
                </label>
                <div className="flex border border-slate-300 rounded-lg overflow-hidden p-0.5 bg-slate-100">
                  <Tooltip content="Align Left" side="top">
                    <button
                      type="button"
                      onClick={() => handleChange("alignment", "left")}
                      className={`flex-1 py-1 flex items-center justify-center rounded transition-colors ${
                        field.alignment === "left"
                          ? "bg-white text-blue-600 shadow-2xs font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <TextAlignLeft size={14} weight="bold" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Align Center" side="top">
                    <button
                      type="button"
                      onClick={() => handleChange("alignment", "center")}
                      className={`flex-1 py-1 flex items-center justify-center rounded transition-colors ${
                        field.alignment === "center"
                          ? "bg-white text-blue-600 shadow-2xs font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <TextAlignCenter size={14} weight="bold" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Align Right" side="top">
                    <button
                      type="button"
                      onClick={() => handleChange("alignment", "right")}
                      className={`flex-1 py-1 flex items-center justify-center rounded transition-colors ${
                        field.alignment === "right"
                          ? "bg-white text-blue-600 shadow-2xs font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <TextAlignRight size={14} weight="bold" />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>

          {/* Masking & Fit Behavior */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h5 className="font-medium text-slate-700 text-[11px] uppercase tracking-wider">
              Background & Transparency
            </h5>

            {/* Quick Transparent Toggle */}
            <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-md gap-2 min-w-0">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-slate-800 block truncate">
                  Transparent Background
                </span>
                <span className="text-[10px] text-slate-500 block truncate">
                  Draws text without background box
                </span>
              </div>
              <Button
                variant={field.maskMode === "none" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (field.maskMode === "none") {
                    handleChange("maskMode", "solid-white");
                  } else {
                    handleChange("maskMode", "none");
                  }
                }}
                className={`h-7 px-2.5 rounded-lg text-xs font-semibold shrink-0 ${
                  field.maskMode === "none"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {field.maskMode === "none"
                  ? "✓ Transparent"
                  : "Make Transparent"}
              </Button>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                Field / Mask Mode
              </label>
              <Select
                value={field.maskMode}
                onValueChange={(val) => handleChange("maskMode", val as any)}
              >
                <SelectTrigger className="w-full h-8 text-xs bg-white text-slate-700 border-slate-200">
                  <SelectValue placeholder="Select mask mode" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="acroform-field">
                    Native Form Field (Transparent AcroForm)
                  </SelectItem>
                  <SelectItem value="none">
                    None (Transparent overlay)
                  </SelectItem>
                  <SelectItem value="solid-white">
                    Solid White Mask (Hide underlying text)
                  </SelectItem>
                  <SelectItem value="custom-color">
                    Custom Color Mask (Match certificate background)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                {field.maskMode === "acroform-field" &&
                  "Injects a native form field with 100% transparent background; zero white box."}
                {field.maskMode === "none" &&
                  "Direct text overlay with zero background box. Ideal for clean whitespace."}
                {field.maskMode === "solid-white" &&
                  "Paints a white rectangle to conceal printed placeholder tokens."}
                {field.maskMode === "custom-color" &&
                  "Paints a color-matched rectangle to conceal tokens on colored certificates."}
              </p>
            </div>

            {field.maskMode === "custom-color" && (
              <div className="space-y-1.5 p-2 bg-slate-50 border border-slate-200 rounded">
                <label className="block text-[11px] font-medium text-slate-600">
                  Background Match Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={field.maskColor || "#ffffff"}
                    onChange={(e) => handleChange("maskColor", e.target.value)}
                    className="w-7 h-7 p-0 border border-slate-300 rounded cursor-pointer"
                  />
                  <span className="font-mono text-[11px] text-slate-600 uppercase">
                    {field.maskColor || "#ffffff"}
                  </span>
                </div>
                {/* Quick color presets */}
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  <span className="text-[10px] text-slate-400">Presets:</span>
                  {[
                    { label: "White", color: "#ffffff" },
                    { label: "Cream", color: "#fdfbf7" },
                    { label: "Parchment", color: "#fef3c7" },
                    { label: "Slate", color: "#f1f5f9" },
                    { label: "Navy", color: "#0f172a" },
                  ].map((p) => (
                    <button
                      key={p.color}
                      type="button"
                      onClick={() => handleChange("maskColor", p.color)}
                      className="px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded hover:bg-slate-100 text-slate-600"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                Fitting / Layout Mode
              </label>
              <Select
                value={field.fitMode}
                onValueChange={(val) => handleChange("fitMode", val as any)}
              >
                <SelectTrigger className="w-full h-8 text-xs bg-white text-slate-700 border-slate-200">
                  <SelectValue placeholder="Select fitting mode" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="shrink-to-fit">
                    Single-line Fit-then-flag (Auto-shrink to min bound)
                  </SelectItem>
                  <SelectItem value="multi-line">
                    Multi-line Auto-wrap (Wrap text within box)
                  </SelectItem>
                  <SelectItem value="fixed">
                    Fixed size (Strict bound)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {field.fitMode === "multi-line" && (
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                  Line Height (pt)
                </label>
                <input
                  type="number"
                  min={8}
                  max={60}
                  value={field.lineHeight || Math.round(field.fontSize * 1.25)}
                  onChange={(e) =>
                    handleChange("lineHeight", Number(e.target.value) || 16)
                  }
                  className="w-full max-w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs outline-none"
                  placeholder="e.g. 16"
                />
              </div>
            )}
          </div>

          {/* Sample Value for Live Preview */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
              Sample Test Value
            </label>
            {field.fitMode === "multi-line" ? (
              <textarea
                rows={3}
                value={field.sampleValue || ""}
                onChange={(e) => handleChange("sampleValue", e.target.value)}
                className="w-full max-w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                placeholder={`Multi-line sample value for ${field.key}`}
              />
            ) : (
              <input
                type="text"
                value={field.sampleValue || ""}
                onChange={(e) => handleChange("sampleValue", e.target.value)}
                className="w-full max-w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder={`Sample value for ${field.key}`}
              />
            )}
            <p className="text-[10px] text-slate-400 mt-1">
              Used to evaluate fit, glyphs, and preview rendering.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

function areFieldPropsEqual(
  prev: IFieldMapping | null,
  next: IFieldMapping | null,
): boolean {
  if (prev === next) return true;
  if (!prev || !next) return false;
  return (
    prev.id === next.id &&
    prev.key === next.key &&
    prev.label === next.label &&
    prev.type === next.type &&
    prev.format === next.format &&
    prev.pageIndex === next.pageIndex &&
    prev.alignment === next.alignment &&
    prev.fontFamily === next.fontFamily &&
    prev.customFontBytes === next.customFontBytes &&
    prev.fontSize === next.fontSize &&
    prev.minFontSize === next.minFontSize &&
    prev.maxFontSize === next.maxFontSize &&
    prev.color === next.color &&
    prev.fitMode === next.fitMode &&
    prev.lineHeight === next.lineHeight &&
    prev.maskMode === next.maskMode &&
    prev.maskColor === next.maskColor &&
    prev.sampleValue === next.sampleValue &&
    prev.textTransform === next.textTransform &&
    prev.rect?.x === next.rect?.x &&
    prev.rect?.y === next.rect?.y &&
    prev.rect?.width === next.rect?.width &&
    prev.rect?.height === next.rect?.height
  );
}

function areSelectedFieldIdsEqual(prev?: string[], next?: string[]): boolean {
  if (prev === next) return true;
  if (!prev || !next) return !prev && !next;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== next[i]) return false;
  }
  return true;
}

function areFieldsEqual(
  prev?: IFieldMapping[],
  next?: IFieldMapping[],
): boolean {
  if (prev === next) return true;
  if (!prev || !next) return !prev && !next;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if (
      prev[i].id !== next[i].id ||
      prev[i].key !== next[i].key ||
      prev[i].label !== next[i].label ||
      prev[i].type !== next[i].type
    ) {
      return false;
    }
  }
  return true;
}

export const FieldPropertiesPanel = React.memo(
  FieldPropertiesPanelComponent,
  (prevProps, nextProps) => {
    if (prevProps === nextProps) return true;

    if (!areFieldPropsEqual(prevProps.field, nextProps.field)) return false;
    if (
      !areSelectedFieldIdsEqual(
        prevProps.selectedFieldIds,
        nextProps.selectedFieldIds,
      )
    )
      return false;
    if (!areFieldsEqual(prevProps.fields, nextProps.fields)) return false;

    return (
      prevProps.onSelectField === nextProps.onSelectField &&
      prevProps.onUpdate === nextProps.onUpdate &&
      prevProps.onDelete === nextProps.onDelete &&
      prevProps.onDeleteMultiple === nextProps.onDeleteMultiple
    );
  },
);

FieldPropertiesPanel.displayName = "FieldPropertiesPanel";
