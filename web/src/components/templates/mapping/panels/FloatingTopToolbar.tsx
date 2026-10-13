import React, { useState, useRef, useEffect } from "react";
import { Panel } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import type { IFieldMapping } from "../types";
import type { DetectedToken } from "@/lib/pdf-engine/token-detector";
import type { EngineWarning } from "@/lib/pdf-engine/pdf-preview-engine";
import { FieldPropertiesPanel } from "../FieldPropertiesPanel";
import { MappedFieldList } from "../MappedFieldList";
import { DetectedTokenList } from "../DetectedTokenList";
import { LayoutWarningList } from "../LayoutWarningList";
import {
  Plus,
  Magnet,
  CaretLeft,
  CaretRight,
  ArrowClockwise,
  ArrowsOut,
  FloppyDisk,
  SlidersHorizontal,
  Stack,
  Sparkle,
  Warning,
  CaretUp,
  CaretDown,
  DotsThreeVertical,
  ArrowUUpLeft,
  ArrowUUpRight,
  AlignLeft,
  AlignCenterHorizontal,
  AlignRight,
  AlignTop,
  AlignCenterVertical,
  AlignBottom,
  ArrowsOutLineHorizontal,
  ArrowsOutLineVertical,
  Question,
} from "@phosphor-icons/react";
import type { AlignmentAction } from "@/lib/pdf-engine/alignment-tools";

export interface FloatingTopToolbarProps {
  templateName?: string;
  versionNumber?: number;
  activePageIndex: number;
  pageCount: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onAddField: () => void;
  isSnapEnabled: boolean;
  onToggleSnap: () => void;
  snapThresholdPx: number;
  onChangeSnapThreshold: (threshold: number) => void;
  viewMode: "editor" | "preview";
  onChangeViewMode: (mode: "editor" | "preview") => void;
  samplePreset: "normal" | "long" | "unicode" | "empty";
  onChangeSamplePreset: (
    preset: "normal" | "long" | "unicode" | "empty",
  ) => void;
  onSaveVersion: () => void;
  isSaving: boolean;
  saveSuccessMessage?: string | null;
  casError?: string | null;
  onFitView?: () => void;
  rotation?: number;
  onRotate?: () => void;

  // History & Alignment Props
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  selectedFieldIds?: string[];
  onApplyAlignment?: (action: AlignmentAction) => void;
  onOpenShortcuts?: () => void;
  onDeleteMultiple?: (ids: string[]) => void;

  // Joined Inspector Sidebar Props
  field?: IFieldMapping | null;
  fields?: IFieldMapping[];
  selectedFieldId?: string | null;
  onSelectField?: (id: string | null, isMulti?: boolean) => void;
  onUpdateField?: (field: IFieldMapping) => void;
  onDeleteField?: (id: string) => void;
  detectedTokens?: DetectedToken[];
  onConfirmToken?: (token: DetectedToken, isMulti?: boolean) => void;
  onDismissToken?: (token: DetectedToken) => void;
  warnings?: EngineWarning[];
}

type TabType = "properties" | "fields" | "tokens" | "warnings";

const FloatingTopToolbarComponent: React.FC<FloatingTopToolbarProps> = ({
  templateName,
  versionNumber,
  activePageIndex,
  pageCount,
  onPrevPage,
  onNextPage,
  onAddField,
  isSnapEnabled,
  onToggleSnap,
  snapThresholdPx,
  onChangeSnapThreshold,
  viewMode,
  onChangeViewMode,
  samplePreset,
  onChangeSamplePreset,
  onSaveVersion,
  isSaving,
  saveSuccessMessage,
  casError,
  onFitView,
  rotation = 0,
  onRotate,

  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  selectedFieldIds = [],
  onApplyAlignment,
  onOpenShortcuts,
  onDeleteMultiple,

  field,
  fields = [],
  selectedFieldId,
  onSelectField,
  onUpdateField,
  onDeleteField,
  detectedTokens = [],
  onConfirmToken,
  onDismissToken,
  warnings = [],
}) => {
  // Inspector drawer open/collapsed state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("properties");
  const [prevSelectedFieldId, setPrevSelectedFieldId] = useState<string | null>(
    selectedFieldId || null,
  );
  const drawerRef = useRef<HTMLDivElement>(null);
  const inspectorBtnRef = useRef<HTMLButtonElement>(null);

  // Switch to 'properties' tab on field change ONLY IF the drawer is already open
  if (selectedFieldId !== prevSelectedFieldId) {
    setPrevSelectedFieldId(selectedFieldId || null);
    if (selectedFieldId && isDrawerOpen) {
      setActiveTab("properties");
    }
  }

  // Secondary actions popover state
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Alignment popover state
  const [isAlignOpen, setIsAlignOpen] = useState(false);
  const alignMenuRef = useRef<HTMLDivElement>(null);

  // Close more menu, align menu, and inspector drawer on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !document.contains(target)) return;

      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setIsMoreOpen(false);
      }
      if (alignMenuRef.current && !alignMenuRef.current.contains(target)) {
        setIsAlignOpen(false);
      }

      // Hide inspector drawer when clicking outside (excluding drawer, inspector toggle button, and portaled selects)
      if (isDrawerOpen) {
        const isInsideDrawer = drawerRef.current?.contains(target);
        const isInsideInspectorBtn = inspectorBtnRef.current?.contains(target);
        const isInsideSelectContent = Boolean(
          target.closest?.("[data-select-content]") ||
          target.closest?.('[role="listbox"]'),
        );

        if (
          !isInsideDrawer &&
          !isInsideInspectorBtn &&
          !isInsideSelectContent
        ) {
          setIsDrawerOpen(false);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDrawerOpen(false);
        setIsMoreOpen(false);
        setIsAlignOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDrawerOpen]);

  // Filter detected tokens for current active page
  const pageTokens = detectedTokens.filter(
    (t) => t.pageIndex === activePageIndex,
  );

  return (
    <Panel
      data-toolbar="true"
      position="top-center"
      className="!m-0 !top-3 !left-1/2 !-translate-x-1/2 z-35 pointer-events-auto"
      style={{
        margin: 0,
        top: "12px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 35,
      }}
    >
      <div className="flex flex-col items-center">
        {/* Fixed Top-Middle Ultra-Compact Horizontal Toolbar Bar */}
        <div className="flex items-center flex-nowrap gap-1.5 px-3 py-1 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl rounded-2xl text-xs select-none shrink-0 max-w-[calc(100vw-2rem)]">
          {/* Page Navigation */}
          <div className="flex items-center gap-0.5 pr-1 border-r border-slate-200">
            <Tooltip content="Previous Page" side="bottom">
              <Button
                variant="ghost"
                size="icon"
                disabled={activePageIndex <= 0}
                onClick={onPrevPage}
                className="h-6 w-6 text-slate-600 hover:text-slate-900 rounded-md"
              >
                <CaretLeft size={12} weight="bold" />
              </Button>
            </Tooltip>
            <span className="font-mono text-[10px] text-slate-700 min-w-[36px] text-center font-medium">
              {activePageIndex + 1}/{pageCount}
            </span>
            <Tooltip content="Next Page" side="bottom">
              <Button
                variant="ghost"
                size="icon"
                disabled={activePageIndex >= pageCount - 1}
                onClick={onNextPage}
                className="h-6 w-6 text-slate-600 hover:text-slate-900 rounded-md"
              >
                <CaretRight size={12} weight="bold" />
              </Button>
            </Tooltip>
          </div>

          {/* Undo / Redo controls */}
          {(onUndo || onRedo) && (
            <div className="flex items-center gap-0.5 pr-1 border-r border-slate-200">
              <Tooltip content="Undo (⌘Z)" side="bottom">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!canUndo}
                  onClick={onUndo}
                  className="h-6 w-6 text-slate-600 hover:text-slate-900 disabled:text-slate-300 rounded-md cursor-pointer disabled:cursor-not-allowed"
                >
                  <ArrowUUpLeft size={13} weight="bold" />
                </Button>
              </Tooltip>
              <Tooltip content="Redo (⌘⇧Z)" side="bottom">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!canRedo}
                  onClick={onRedo}
                  className="h-6 w-6 text-slate-600 hover:text-slate-900 disabled:text-slate-300 rounded-md cursor-pointer disabled:cursor-not-allowed"
                >
                  <ArrowUUpRight size={13} weight="bold" />
                </Button>
              </Tooltip>
            </div>
          )}

          {/* Action: Add Field */}
          <Tooltip content="Create new field at page center" side="bottom">
            <Button
              size="sm"
              onClick={onAddField}
              className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-[11px] font-semibold shadow-xs flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
            >
              <Plus size={12} weight="bold" />
              <span>Field</span>
            </Button>
          </Tooltip>

          {/* Magnet Snapping Toggle */}
          <Tooltip
            content={
              isSnapEnabled
                ? "Magnetic Snapping: ON (Hold Alt to bypass)"
                : "Magnetic Snapping: OFF"
            }
            side="bottom"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleSnap}
              className={`h-7 px-1.5 rounded-lg flex items-center gap-1 font-medium text-[11px] shrink-0 border border-transparent ${
                isSnapEnabled
                  ? "bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100 hover:text-pink-800"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Magnet size={13} weight={isSnapEnabled ? "fill" : "regular"} />
              <span className="hidden sm:inline">Snap</span>
            </Button>
          </Tooltip>

          {/* Alignment Tools (Visible when 1+ fields selected) */}
          {onApplyAlignment && selectedFieldIds.length > 0 && (
            <div className="relative shrink-0" ref={alignMenuRef}>
              <Tooltip
                content={
                  selectedFieldIds.length === 1
                    ? "Center on Page"
                    : `Align & Distribute (${selectedFieldIds.length} selected)`
                }
                side="bottom"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAlignOpen((prev) => !prev)}
                  className={`h-7 px-2 rounded-lg flex items-center gap-1 text-[11px] font-medium shrink-0 border border-slate-200 ${
                    isAlignOpen
                      ? "bg-blue-50 text-blue-700 border-blue-300 font-semibold"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <AlignLeft size={13} weight="bold" />
                  <span className="hidden sm:inline">Align</span>
                  <span className="px-1 py-0.2 bg-blue-600 text-white rounded-full text-[9px] font-mono font-bold">
                    {selectedFieldIds.length}
                  </span>
                </Button>
              </Tooltip>

              {isAlignOpen && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-52 bg-white rounded-xl border border-slate-200 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-1 pb-1 border-b border-slate-100 mb-1.5">
                    {selectedFieldIds.length > 1
                      ? `Align ${selectedFieldIds.length} Elements`
                      : "Center on Page"}
                  </div>

                  {/* Multi-element Alignments */}
                  {selectedFieldIds.length > 1 && (
                    <div className="space-y-1 mb-2 pb-2 border-b border-slate-100">
                      <div className="text-[10px] text-slate-400 px-1 font-medium">
                        Horizontal
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onApplyAlignment("alignLeft");
                            setIsAlignOpen(false);
                          }}
                          className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[10px] transition-colors"
                          title="Align Left"
                        >
                          <AlignLeft size={14} weight="bold" />
                          <span className="text-[9px] mt-0.5">Left</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onApplyAlignment("alignCenterH");
                            setIsAlignOpen(false);
                          }}
                          className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[10px] transition-colors"
                          title="Align Center Horizontal"
                        >
                          <AlignCenterHorizontal size={14} weight="bold" />
                          <span className="text-[9px] mt-0.5">Center</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onApplyAlignment("alignRight");
                            setIsAlignOpen(false);
                          }}
                          className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[10px] transition-colors"
                          title="Align Right"
                        >
                          <AlignRight size={14} weight="bold" />
                          <span className="text-[9px] mt-0.5">Right</span>
                        </button>
                      </div>

                      <div className="text-[10px] text-slate-400 px-1 font-medium pt-1">
                        Vertical
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onApplyAlignment("alignTop");
                            setIsAlignOpen(false);
                          }}
                          className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[10px] transition-colors"
                          title="Align Top"
                        >
                          <AlignTop size={14} weight="bold" />
                          <span className="text-[9px] mt-0.5">Top</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onApplyAlignment("alignMiddleV");
                            setIsAlignOpen(false);
                          }}
                          className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[10px] transition-colors"
                          title="Align Middle Vertical"
                        >
                          <AlignCenterVertical size={14} weight="bold" />
                          <span className="text-[9px] mt-0.5">Middle</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onApplyAlignment("alignBottom");
                            setIsAlignOpen(false);
                          }}
                          className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[10px] transition-colors"
                          title="Align Bottom"
                        >
                          <AlignBottom size={14} weight="bold" />
                          <span className="text-[9px] mt-0.5">Bottom</span>
                        </button>
                      </div>

                      {/* Equal Spacing Distribution (when 3+ selected) */}
                      {selectedFieldIds.length >= 3 && (
                        <>
                          <div className="text-[10px] text-slate-400 px-1 font-medium pt-1">
                            Distribute
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                onApplyAlignment("distributeH");
                                setIsAlignOpen(false);
                              }}
                              className="flex items-center justify-center gap-1 p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[10px] transition-colors"
                              title="Distribute Horizontally"
                            >
                              <ArrowsOutLineHorizontal
                                size={13}
                                weight="bold"
                              />
                              <span>Horizontal</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onApplyAlignment("distributeV");
                                setIsAlignOpen(false);
                              }}
                              className="flex items-center justify-center gap-1 p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[10px] transition-colors"
                              title="Distribute Vertically"
                            >
                              <ArrowsOutLineVertical size={13} weight="bold" />
                              <span>Vertical</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Page Center Actions */}
                  <div className="space-y-1">
                    <div className="text-[10px] text-slate-400 px-1 font-medium">
                      Page Center
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          onApplyAlignment("centerOnPageH");
                          setIsAlignOpen(false);
                        }}
                        className="py-1 px-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[10px] font-medium text-center transition-colors"
                      >
                        Center Horiz
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onApplyAlignment("centerOnPageV");
                          setIsAlignOpen(false);
                        }}
                        className="py-1 px-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[10px] font-medium text-center transition-colors"
                      >
                        Center Vert
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Clean 2-Mode Switcher: Canvas | Preview */}
          <div className="flex border border-slate-200 rounded-lg p-0.5 bg-slate-100 text-[10px] shrink-0">
            <button
              type="button"
              onClick={() => onChangeViewMode("editor")}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                viewMode === "editor"
                  ? "bg-white text-blue-600 shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Canvas
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode("preview")}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                viewMode === "preview"
                  ? "bg-white text-blue-600 shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Preview
            </button>
          </div>

          {/* More Actions Popover Trigger */}
          <div className="relative shrink-0" ref={moreMenuRef}>
            <Tooltip content="More Canvas Tools & Settings" side="bottom">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMoreOpen((prev) => !prev)}
                className={`h-7 w-7 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 ${
                  isMoreOpen ? "bg-slate-100 text-slate-900" : ""
                }`}
              >
                <DotsThreeVertical size={15} weight="bold" />
              </Button>
            </Tooltip>

            {isMoreOpen && (
              <div className="absolute top-full mt-1.5 right-0 w-52 bg-white border border-slate-200 rounded-xl shadow-2xl p-2 z-50 text-xs space-y-2 animate-in fade-in zoom-in-95 duration-100 select-none">
                {/* Template Info */}
                {templateName && (
                  <div className="pb-1.5 border-b border-slate-100 flex items-center justify-between">
                    <Tooltip content={templateName} side="left">
                      <span className="font-semibold text-slate-800 truncate text-[11px] max-w-[130px]">
                        {templateName}
                      </span>
                    </Tooltip>
                    {versionNumber !== undefined && (
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-mono text-[9px] font-medium">
                        v{versionNumber}
                      </span>
                    )}
                  </div>
                )}
                {/* Page Rotation */}
                {onRotate && (
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600 font-medium text-[11px]">
                      Page Rotation
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onRotate();
                      }}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-mono text-[10px] flex items-center gap-1 font-semibold"
                    >
                      <ArrowClockwise size={12} weight="bold" />
                      <span>{rotation}°</span>
                    </button>
                  </div>
                )}

                {/* Fit View */}
                {onFitView && (
                  <button
                    type="button"
                    onClick={() => {
                      onFitView();
                      setIsMoreOpen(false);
                    }}
                    className="w-full flex items-center justify-between py-1 px-1 rounded-md text-slate-700 hover:bg-slate-100 text-[11px]"
                  >
                    <span>Fit Document to Screen</span>
                    <ArrowsOut
                      size={13}
                      weight="bold"
                      className="text-slate-500"
                    />
                  </button>
                )}

                {/* Snapping Sensitivity */}
                <div className="py-1 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1 text-[11px] text-slate-600 font-medium">
                    <span>Snap Threshold</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {snapThresholdPx}px
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[4, 8, 14].map((thresh) => (
                      <button
                        key={thresh}
                        type="button"
                        onClick={() => onChangeSnapThreshold(thresh)}
                        className={`py-0.5 rounded text-[10px] font-mono transition-colors ${
                          snapThresholdPx === thresh
                            ? "bg-blue-600 text-white font-semibold"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {thresh}px
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sample Presets */}
                <div className="py-1 border-t border-slate-100">
                  <div className="text-[11px] text-slate-600 font-medium mb-1">
                    Preview Preset
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {(["normal", "long", "unicode", "empty"] as const).map(
                      (preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => onChangeSamplePreset(preset)}
                          className={`py-0.5 px-1.5 rounded text-[10px] capitalize transition-colors ${
                            samplePreset === preset
                              ? "bg-blue-600 text-white font-semibold"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {preset}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Keyboard Shortcuts Trigger Button */}
          {onOpenShortcuts && (
            <Tooltip content="Keyboard Shortcuts (?)" side="bottom">
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenShortcuts}
                className="h-7 w-7 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              >
                <Question size={14} weight="bold" />
              </Button>
            </Tooltip>
          )}

          {/* Save Button */}
          <div className="flex items-center gap-1 shrink-0">
            {casError && (
              <Tooltip content={casError} side="bottom">
                <span className="text-[9px] text-red-600 bg-red-50 border border-red-200 px-1 py-0.5 rounded truncate max-w-[80px]">
                  Conflict
                </span>
              </Tooltip>
            )}
            {saveSuccessMessage && (
              <span className="text-[9px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded truncate max-w-[80px]">
                Saved
              </span>
            )}
            <Tooltip
              content="Save and create new template version"
              side="bottom"
            >
              <Button
                size="sm"
                disabled={isSaving}
                onClick={onSaveVersion}
                className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-300 text-white rounded-lg text-[11px] font-semibold shadow-xs flex items-center gap-1 shrink-0 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <FloppyDisk size={12} weight="bold" />
                <span>{isSaving ? "..." : "Create"}</span>
              </Button>
            </Tooltip>
          </div>

          {/* Separator to Inspector Button */}
          <div className="w-px h-4 bg-slate-200 mx-0.5 shrink-0" />

          {/* Single Compact Inspector Toggle Button */}
          <Tooltip
            content={isDrawerOpen ? "Collapse Inspector" : "Open Inspector"}
            side="bottom"
          >
            <Button
              ref={inspectorBtnRef}
              variant={isDrawerOpen ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setIsDrawerOpen((prev) => !prev)}
              className={`h-7 px-2.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 relative shrink-0 transition-colors ${
                isDrawerOpen
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <SlidersHorizontal size={13} weight="bold" />
              <span className="hidden sm:inline">Inspector</span>
              {warnings.length > 0 ? (
                <span className="px-1 bg-red-100 text-red-800 text-[9px] rounded-full font-mono font-bold">
                  {warnings.length}
                </span>
              ) : field ? (
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
              ) : null}
              {isDrawerOpen ? (
                <CaretUp size={11} weight="bold" className="text-slate-400" />
              ) : (
                <CaretDown size={11} weight="bold" className="text-slate-400" />
              )}
            </Button>
          </Tooltip>
        </div>

        {/* Attached Expandable Inspector Drawer */}
        {isDrawerOpen && (
          <div
            ref={drawerRef}
            className="mt-2 w-[360px] sm:w-[400px] max-w-[calc(100vw-2.5rem)] max-h-[calc(100vh-8.5rem)] flex flex-col bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden select-none animate-in fade-in slide-in-from-top-2 duration-150"
          >
            {/* Drawer Header with 4 Segmented Tabs */}
            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-200 bg-slate-50/90 shrink-0 gap-1 min-w-0">
              <div className="flex items-center gap-1 overflow-x-auto py-0.5 scrollbar-none min-w-0 flex-1">
                <Tooltip content="Field Properties Inspector" side="bottom">
                  <button
                    type="button"
                    onClick={() => setActiveTab("properties")}
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors ${
                      activeTab === "properties"
                        ? "bg-white text-blue-600 shadow-2xs font-semibold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                  >
                    <SlidersHorizontal size={13} weight="bold" />
                    <span>Properties</span>
                    {field && (
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                    )}
                  </button>
                </Tooltip>

                <Tooltip
                  content={`Mapped Fields (${fields.length})`}
                  side="bottom"
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab("fields")}
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors ${
                      activeTab === "fields"
                        ? "bg-white text-blue-600 shadow-2xs font-semibold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                  >
                    <Stack size={13} weight="bold" />
                    <span>Fields</span>
                    <span className="px-1 bg-slate-200 text-slate-700 text-[9px] rounded-full font-mono">
                      {fields.length}
                    </span>
                  </button>
                </Tooltip>

                <Tooltip
                  content={`Detected Placeholders (${pageTokens.length})`}
                  side="bottom"
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab("tokens")}
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors ${
                      activeTab === "tokens"
                        ? "bg-white text-amber-700 shadow-2xs font-semibold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                  >
                    <Sparkle size={13} weight="bold" />
                    <span>Tokens</span>
                    {pageTokens.length > 0 && (
                      <span className="px-1 bg-amber-100 text-amber-800 text-[9px] rounded-full font-mono">
                        {pageTokens.length}
                      </span>
                    )}
                  </button>
                </Tooltip>

                {warnings.length > 0 && (
                  <Tooltip
                    content={`Layout Alerts (${warnings.length})`}
                    side="bottom"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveTab("warnings")}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors ${
                        activeTab === "warnings"
                          ? "bg-white text-red-700 shadow-2xs font-semibold"
                          : "text-red-600 hover:text-red-800 hover:bg-red-50"
                      }`}
                    >
                      <Warning size={13} weight="bold" />
                      <span>Alerts</span>
                      <span className="px-1 bg-red-100 text-red-800 text-[9px] rounded-full font-mono">
                        {warnings.length}
                      </span>
                    </button>
                  </Tooltip>
                )}
              </div>

              <Tooltip content="Collapse Drawer" side="bottom">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsDrawerOpen(false)}
                  className="h-6 w-6 text-slate-400 hover:text-slate-700 rounded-md shrink-0"
                >
                  <CaretUp size={14} weight="bold" />
                </Button>
              </Tooltip>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3.5">
              {activeTab === "properties" && (
                <FieldPropertiesPanel
                  field={field || null}
                  fields={fields}
                  selectedFieldIds={selectedFieldIds}
                  onSelectField={onSelectField}
                  onUpdate={onUpdateField || (() => {})}
                  onDelete={onDeleteField || (() => {})}
                  onDeleteMultiple={onDeleteMultiple}
                />
              )}

              {activeTab === "fields" && (
                <MappedFieldList
                  fields={fields}
                  activePageIndex={activePageIndex}
                  selectedFieldId={selectedFieldId || null}
                  selectedFieldIds={selectedFieldIds}
                  onSelectField={onSelectField || (() => {})}
                  onDeleteField={onDeleteField || (() => {})}
                />
              )}

              {activeTab === "tokens" && (
                <DetectedTokenList
                  tokens={detectedTokens}
                  fieldMappings={fields}
                  activePageIndex={activePageIndex}
                  onConfirmToken={onConfirmToken || (() => {})}
                  onDismissToken={onDismissToken || (() => {})}
                />
              )}

              {activeTab === "warnings" && (
                <LayoutWarningList
                  warnings={warnings}
                  onSelectField={(key) => {
                    const matched = fields.find((m) => m.key === key);
                    if (matched && onSelectField) {
                      onSelectField(matched.id);
                      setActiveTab("properties");
                    }
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
};

export const FloatingTopToolbar = React.memo<FloatingTopToolbarProps>(
  FloatingTopToolbarComponent,
);
FloatingTopToolbar.displayName = "FloatingTopToolbar";
