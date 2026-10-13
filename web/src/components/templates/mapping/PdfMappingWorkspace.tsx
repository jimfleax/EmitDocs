import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "@phosphor-icons/react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useReactFlow,
  SelectionMode,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { IFieldMapping, TemplateVersionData, TemplateData } from "./types";
import { PdfPageNode } from "./nodes/PdfPageNode";
import { FieldNode } from "./nodes/FieldNode";
import { AlignmentGuidesOverlay } from "./nodes/AlignmentGuidesOverlay";
import { FloatingTopToolbar } from "./panels/FloatingTopToolbar";
import { PreviewDocumentPane } from "./PreviewDocumentPane";
import { KeyboardShortcutsModal } from "./modals/KeyboardShortcutsModal";
import { useEditorHistory } from "@/hooks/useEditorHistory";
import {
  applyAlignmentToFields,
  type AlignmentAction,
} from "@/lib/pdf-engine/alignment-tools";

import type { DetectedToken } from "@/lib/pdf-engine/token-detector";
import type { EngineWarning } from "@/lib/pdf-engine/pdf-preview-engine";
import {
  domToPdfRect,
  pdfToDomRect,
  type ViewportConfig,
  type DomRect,
} from "@/lib/pdf-engine/coordinate-transforms";
import {
  calculateSnapping,
  type AlignmentGuide,
} from "@/lib/pdf-engine/alignment-snapper";
import { InfinityTrack } from "@/components/ui/InfinityTrack";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";

interface PdfMappingWorkspaceProps {
  templateId: string;
  versionId: string;
}

const nodeTypes = {
  pdfPage: PdfPageNode,
  field: FieldNode,
};

function parseNodeDimension(
  val: unknown,
  measured?: number,
  fallback: number = 0,
): number {
  if (typeof measured === "number" && !Number.isNaN(measured) && measured > 0)
    return measured;
  if (typeof val === "number" && !Number.isNaN(val) && val > 0) return val;
  if (typeof val === "string") {
    const parsed = parseFloat(val);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function getNodeDomRect(
  node: Node,
  defaultWidth = 100,
  defaultHeight = 30,
): DomRect {
  const width = parseNodeDimension(
    node.style?.width ?? (node as any).width,
    (node as any).measured?.width,
    defaultWidth,
  );
  const height = parseNodeDimension(
    node.style?.height ?? (node as any).height,
    (node as any).measured?.height,
    defaultHeight,
  );
  return {
    x: node.position.x,
    y: node.position.y,
    width,
    height,
  };
}

const PdfMappingWorkspaceInner: React.FC<PdfMappingWorkspaceProps> = ({
  templateId,
  versionId,
}) => {
  const { fitView } = useReactFlow();

  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [version, setVersion] = useState<TemplateVersionData | null>(null);
  const [sourcePdfBytes, setSourcePdfBytes] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // History & Mapping state
  const {
    fieldMappings,
    canUndo,
    canRedo,
    undo,
    redo,
    pushSnapshot,
    resetHistory,
  } = useEditorHistory([]);

  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [pageDimensions, setPageDimensions] = useState<{
    width: number;
    height: number;
  }>({
    width: 595,
    height: 842,
  });
  const [rotation, setRotation] = useState(0);
  const [effectiveRotation, setEffectiveRotation] = useState(0);
  const [detectedTokens, setDetectedTokens] = useState<DetectedToken[]>([]);
  const [warnings, setWarnings] = useState<EngineWarning[]>([]);

  // Derived single selected field ID (first selected or null)
  const selectedFieldId = selectedFieldIds[0] || null;

  // Stable ref of selectedFieldIds so layout/geometry recalculation does NOT trigger on selection change
  const selectedFieldIdsRef = useRef<string[]>(selectedFieldIds);
  useEffect(() => {
    selectedFieldIdsRef.current = selectedFieldIds;
  }, [selectedFieldIds]);

  // Stable ref of fieldMappings for callbacks without stale closures
  const fieldMappingsRef = useRef<IFieldMapping[]>(fieldMappings);
  useEffect(() => {
    fieldMappingsRef.current = fieldMappings;
  }, [fieldMappings]);

  // Snapping & Guides state
  const [isSnapEnabled, setIsSnapEnabled] = useState(true);
  const [snapThresholdPx, setSnapThresholdPx] = useState(8);
  const [activeGuides, setActiveGuidesState] = useState<AlignmentGuide[]>([]);

  // View state: editor, preview (Split View removed)
  const [viewMode, setViewMode] = useState<"editor" | "preview">("editor");
  const [samplePreset, setSamplePreset] = useState<
    "normal" | "long" | "unicode" | "empty"
  >("normal");

  // Concurrency & saving
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(
    null,
  );
  const [casError, setCasError] = useState<string | null>(null);

  // Viewport configuration for coordinate transformation (scale: 1.0 for canonical canvas)
  const currentViewport: ViewportConfig = useMemo(
    () => ({
      width: pageDimensions.width,
      height: pageDimensions.height,
      scale: 1.0,
      rotation: effectiveRotation,
    }),
    [pageDimensions.width, pageDimensions.height, effectiveRotation],
  );

  // Fetch initial data
  useEffect(() => {
    let isCancelled = false;

    const fetchWorkspaceData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [tplRes, verRes] = await Promise.all([
          fetch(`/api/templates/${templateId}`, { credentials: "include" }),
          fetch(`/api/templates/${templateId}/versions/${versionId}`, {
            credentials: "include",
          }),
        ]);

        if (!tplRes.ok) throw new Error("Failed to load template metadata");
        if (!verRes.ok) throw new Error("Failed to load template version");

        const tplData = await tplRes.json();
        const verData = await verRes.json();

        if (isCancelled) return;
        setTemplate(tplData.template);
        setVersion(verData.version);
        resetHistory(verData.version.fieldMappings || []);

        const fileRes = await fetch(
          `/api/templates/${templateId}/versions/${versionId}/file`,
          {
            credentials: "include",
          },
        );
        if (!fileRes.ok) throw new Error("Failed to fetch source PDF bytes");

        const arrayBuffer = await fileRes.arrayBuffer();
        if (isCancelled) return;
        setSourcePdfBytes(new Uint8Array(arrayBuffer));
      } catch (err: any) {
        if (!isCancelled) {
          console.error("Error loading workspace data:", err);
          setError(err.message || "Error loading workspace");
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchWorkspaceData();

    return () => {
      isCancelled = true;
    };
  }, [templateId, versionId, resetHistory]);

  // Selected field reference
  const selectedField = useMemo(
    () => fieldMappings.find((m) => m.id === selectedFieldId) || null,
    [fieldMappings, selectedFieldId],
  );

  // Sample data mapping for live preview presets
  const sampleData = useMemo(() => {
    const data: Record<string, string> = {};
    for (const m of fieldMappings) {
      if (samplePreset === "long") {
        data[m.key] =
          m.fitMode === "multi-line"
            ? "Wolfeschlegelsteinhausenbergerdorff Department of Operational Quality, Suite 400, Innovation District"
            : "Wolfeschlegelsteinhausenbergerdorff";
      } else if (samplePreset === "unicode") {
        data[m.key] =
          m.fitMode === "multi-line"
            ? "José María Núñez (Müller)\nCalle de la Constitución 104\n100% Vérifié & Garanti"
            : "José María Núñez (100% Verified)";
      } else if (samplePreset === "empty") {
        data[m.key] = "";
      } else {
        data[m.key] = m.sampleValue || `Sample ${m.label || m.key}`;
      }
    }
    return data;
  }, [fieldMappings, samplePreset]);

  // Token confirmation handler (AC1: user explicitly confirms suggested token)
  const handleConfirmToken = useCallback(
    (token: DetectedToken, isMulti?: boolean) => {
      const newField: IFieldMapping = {
        id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        key: token.key,
        label: token.key
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        type: "text",
        pageIndex: token.pageIndex,
        rect: { ...token.rect },
        alignment: "left",
        fontFamily: token.detectedFontFamily || "Helvetica",
        fontSize:
          token.detectedFontSize || Math.round(token.rect.height * 0.8) || 12,
        minFontSize: 8,
        maxFontSize: 24,
        color: "#000000",
        fitMode: "shrink-to-fit",
        maskMode: "solid-white", // Default solid white over detected placeholder
        sampleValue: `Sample ${token.key}`,
      };

      const current = fieldMappingsRef.current;
      if (
        current.some(
          (f) => f.key === newField.key && f.pageIndex === newField.pageIndex,
        )
      ) {
        return;
      }
      pushSnapshot([...current, newField]);
      setSelectedFieldIds((prev) =>
        isMulti ? [...prev, newField.id] : [newField.id],
      );
    },
    [pushSnapshot],
  );

  const handleDismissToken = useCallback((token: DetectedToken) => {
    setDetectedTokens((prev) =>
      prev.filter(
        (t) => t.key !== token.key || t.pageIndex !== token.pageIndex,
      ),
    );
  }, []);

  // Update field mapping
  const handleUpdateField = useCallback(
    (updated: IFieldMapping) => {
      pushSnapshot(
        fieldMappingsRef.current.map((f) =>
          f.id === updated.id ? updated : f,
        ),
      );
    },
    [pushSnapshot],
  );

  // Delete single field mapping
  const handleDeleteField = useCallback(
    (id: string) => {
      pushSnapshot(fieldMappingsRef.current.filter((f) => f.id !== id));
      setSelectedFieldIds((prev) => prev.filter((fid) => fid !== id));
    },
    [pushSnapshot],
  );

  // Delete multiple field mappings
  const handleDeleteMultiple = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      pushSnapshot(fieldMappingsRef.current.filter((f) => !idSet.has(f.id)));
      setSelectedFieldIds((prev) => prev.filter((fid) => !idSet.has(fid)));
    },
    [pushSnapshot],
  );

  // Duplicate field with offset
  const handleDuplicateField = useCallback(
    (field: IFieldMapping) => {
      const source =
        fieldMappingsRef.current.find((f) => f.id === field.id) || field;
      const duplicated: IFieldMapping = {
        ...source,
        id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        key: `${source.key}_copy`,
        label: source.label ? `${source.label} (Copy)` : `${source.key} (Copy)`,
        rect: {
          ...source.rect,
          x: Math.round((source.rect.x + 12) * 10) / 10,
          y: Math.round((source.rect.y - 12) * 10) / 10,
        },
      };
      pushSnapshot([...fieldMappingsRef.current, duplicated]);
      setSelectedFieldIds([duplicated.id]);
    },
    [pushSnapshot],
  );

  // Direct Add Field (adds 180×36pt transparent field at page center)
  const handleAddField = useCallback(() => {
    const boxWidth = 180;
    const boxHeight = 36;
    const centerX = Math.max(
      0,
      Math.round((pageDimensions.width - boxWidth) / 2),
    );
    const centerY = Math.max(
      0,
      Math.round((pageDimensions.height - boxHeight) / 2),
    );

    const domRect: DomRect = {
      x: centerX,
      y: centerY,
      width: boxWidth,
      height: boxHeight,
    };
    const initialRect = domToPdfRect(domRect, currentViewport);

    let createdId = "";
    pushSnapshot((prev) => {
      const fieldIndex = prev.length + 1;
      const newField: IFieldMapping = {
        id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        key: `field_${fieldIndex}`,
        label: `Field ${fieldIndex}`,
        type: "text",
        pageIndex: activePageIndex,
        rect: {
          x: Math.round(initialRect.x * 10) / 10,
          y: Math.round(initialRect.y * 10) / 10,
          width: Math.round(initialRect.width * 10) / 10,
          height: Math.round(initialRect.height * 10) / 10,
        },
        alignment: "left",
        fontFamily: "Helvetica",
        fontSize: 14,
        minFontSize: 8,
        maxFontSize: 24,
        color: "#000000",
        fitMode: "shrink-to-fit",
        maskMode: "none", // 100% Transparent background by default
        sampleValue: `Value ${fieldIndex}`,
      };
      createdId = newField.id;
      return [...prev, newField];
    });

    if (createdId) {
      setSelectedFieldIds([createdId]);
    }
  }, [
    pageDimensions.width,
    pageDimensions.height,
    currentViewport,
    activePageIndex,
    pushSnapshot,
  ]);

  // Alignment dispatcher
  const handleApplyAlignment = useCallback(
    (action: AlignmentAction) => {
      pushSnapshot((prev) =>
        applyAlignmentToFields(
          selectedFieldIds,
          prev,
          action,
          currentViewport,
          pageDimensions,
        ),
      );
    },
    [selectedFieldIds, currentViewport, pageDimensions, pushSnapshot],
  );

  // Page dimensions & count determined by PdfPageNode
  const handlePageLoaded = useCallback(
    (dims: {
      width: number;
      height: number;
      pageCount: number;
      effectiveRotation?: number;
      rotation?: number;
    }) => {
      setPageDimensions({ width: dims.width, height: dims.height });
      setPageCount(dims.pageCount);
      const eff = dims.effectiveRotation ?? dims.rotation;
      if (typeof eff === "number") {
        setEffectiveRotation(eff);
      }
      setTimeout(() => {
        fitView({ padding: 0.15, duration: 400 });
      }, 50);
    },
    [fitView],
  );

  // Page navigation with auto-centering
  const handlePrevPage = useCallback(() => {
    if (activePageIndex <= 0) return;
    setActivePageIndex((p) => Math.max(0, p - 1));
    setSelectedFieldIds([]);
    setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 80);
  }, [activePageIndex, fitView]);

  const handleNextPage = useCallback(() => {
    if (activePageIndex >= pageCount - 1) return;
    setActivePageIndex((p) => Math.min(pageCount - 1, p + 1));
    setSelectedFieldIds([]);
    setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 80);
  }, [activePageIndex, pageCount, fitView]);

  // Keyboard navigation & nudging & shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      // History Undo / Redo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }

      // Select All on active page
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const pageFieldIds = fieldMappings
          .filter((m) => m.pageIndex === activePageIndex)
          .map((m) => m.id);
        setSelectedFieldIds(pageFieldIds);
        return;
      }

      // Duplicate selected
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (selectedFieldIds.length === 0) return;
        const selected = fieldMappings.filter((f) =>
          selectedFieldIds.includes(f.id),
        );
        const duplicates: IFieldMapping[] = selected.map((field) => ({
          ...field,
          id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          key: `${field.key}_copy`,
          label: field.label ? `${field.label} (Copy)` : `${field.key} (Copy)`,
          rect: {
            ...field.rect,
            x: Math.round((field.rect.x + 12) * 10) / 10,
            y: Math.round((field.rect.y - 12) * 10) / 10,
          },
        }));
        pushSnapshot([...fieldMappings, ...duplicates]);
        setSelectedFieldIds(duplicates.map((d) => d.id));
        return;
      }

      // Shortcuts Modal
      if (e.key === "?") {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
        return;
      }

      // Escape
      if (e.key === "Escape") {
        if (selectedFieldIds.length > 0) {
          e.preventDefault();
          setSelectedFieldIds([]);
          return;
        }
      }

      // Delete / Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedFieldIds.length > 0) {
          e.preventDefault();
          handleDeleteMultiple(selectedFieldIds);
          return;
        }
      }

      // Arrow keys nudging
      if (
        selectedFieldIds.length > 0 &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault();
        const delta = e.shiftKey ? 10 : 1;
        const selectedSet = new Set(selectedFieldIds);
        const updated = fieldMappings.map((f) => {
          if (!selectedSet.has(f.id)) return f;
          let { x, y } = f.rect;
          if (e.key === "ArrowLeft") x -= delta;
          if (e.key === "ArrowRight") x += delta;
          if (e.key === "ArrowUp") y += delta;
          if (e.key === "ArrowDown") y -= delta;
          return {
            ...f,
            rect: {
              ...f.rect,
              x: Math.round(x * 10) / 10,
              y: Math.round(y * 10) / 10,
            },
          };
        });
        pushSnapshot(updated);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedFieldIds,
    fieldMappings,
    activePageIndex,
    undo,
    redo,
    pushSnapshot,
    handleDeleteMultiple,
  ]);

  // Global click-outside listener: unfocus selected fields when clicking outside
  useEffect(() => {
    let startX = 0;
    let startY = 0;

    const handlePointerDown = (e: MouseEvent) => {
      startX = e.clientX;
      startY = e.clientY;
    };

    const handlePointerUp = (e: MouseEvent) => {
      if (selectedFieldIdsRef.current.length === 0) return;

      // Ignore drags (e.g. canvas panning or node moving)
      const distance = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (distance > 5) return;

      const target = e.target as HTMLElement | null;
      if (!target || !document.contains(target)) return;

      // Ignore if clicking inside a field node
      if (
        target.closest(".react-flow__node-field") ||
        target.closest("[data-field-node]")
      ) {
        return;
      }

      // Ignore if clicking inside field node toolbar
      if (target.closest(".react-flow__node-toolbar")) {
        return;
      }

      // Ignore if clicking inside node resize handles
      if (target.closest(".react-flow__resize-control")) {
        return;
      }

      // Ignore if clicking inside top toolbar or inspector drawer
      if (
        target.closest("[data-toolbar]") ||
        target.closest(".react-flow__panel")
      ) {
        return;
      }

      // Ignore if clicking inside portaled selects, menus, popovers, modals, tooltips
      if (
        target.closest("[data-select-content]") ||
        target.closest('[role="listbox"]') ||
        target.closest('[role="dialog"]') ||
        target.closest('[role="tooltip"]') ||
        target.closest("[data-radix-portal]") ||
        target.closest("[data-token-placeholder]")
      ) {
        return;
      }

      // Ignore if clicking controls (zoom in/out in bottom left)
      if (target.closest(".react-flow__controls")) {
        return;
      }

      // Any other click outside unfocuses selected fields
      setSelectedFieldIds((prev) => (prev.length === 0 ? prev : []));
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointerup", handlePointerUp, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
    };
  }, []);

  // Save version with CAS concurrency check (AC7)
  const handleSaveVersion = async () => {
    if (!version) return;

    try {
      setIsSaving(true);
      setCasError(null);
      setSaveSuccessMessage(null);

      const res = await fetch(`/api/templates/${templateId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          expectedVersion: version.version,
          fieldMappings,
        }),
      });

      if (res.status === 409) {
        const errorData = await res.json().catch(() => ({}));
        const msg =
          errorData.message ||
          "Conflict: another user or tab saved a newer version.";
        setCasError(msg);
        toast.error("Version Conflict (409)", msg);
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const msg =
          errorData.error ||
          errorData.message ||
          "Failed to save template version";
        throw new Error(msg);
      }

      const data = await res.json();
      setVersion(data.version);
      const successMsg = `Saved as immutable Version ${data.version.version}!`;
      setSaveSuccessMessage(successMsg);
      toast.success(
        "Template Saved",
        `Version ${data.version.version} created and published successfully.`,
      );
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      const errorMsg = err.message || "Error saving template version";
      setCasError(errorMsg);
      toast.error("Save Failed", errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  // Node Dragging with Magnetic Alignment Guides
  const handleNodeDrag = useCallback(
    (e: MouseEvent | TouchEvent, node: Node) => {
      if (node.type !== "field") return;
      if (!isSnapEnabled) {
        setActiveGuidesState([]);
        return;
      }

      const currentDom: DomRect = getNodeDomRect(node);

      const siblings = fieldMappings
        .filter((m) => m.id !== node.id && m.pageIndex === activePageIndex)
        .map((m) => pdfToDomRect(m.rect, currentViewport));

      const snapResult = calculateSnapping(
        currentDom,
        siblings,
        currentViewport,
        {
          thresholdPx: snapThresholdPx,
          isAltPressed: "altKey" in e ? e.altKey : false,
          handleType: "move",
        },
      );

      setActiveGuidesState(snapResult.guides);
    },
    [
      isSnapEnabled,
      fieldMappings,
      activePageIndex,
      currentViewport,
      snapThresholdPx,
    ],
  );

  const handleNodeDragStop = useCallback(
    (e: MouseEvent | TouchEvent, node: Node, draggedNodes: Node[]) => {
      if (node.type !== "field") return;
      setActiveGuidesState([]);

      // Multi-node drag support: if multiple nodes were dragged together
      if (draggedNodes && draggedNodes.length > 1) {
        const draggedFieldNodes = draggedNodes.filter(
          (n) => n.type === "field",
        );
        const draggedIds = new Set(draggedFieldNodes.map((n) => n.id));

        pushSnapshot((prev) =>
          prev.map((m) => {
            if (!draggedIds.has(m.id)) return m;
            const dn = draggedFieldNodes.find((n) => n.id === m.id)!;
            const domRect: DomRect = getNodeDomRect(dn);
            const pdfRect = domToPdfRect(domRect, currentViewport);
            return {
              ...m,
              rect: {
                x: Math.round(pdfRect.x * 10) / 10,
                y: Math.round(pdfRect.y * 10) / 10,
                width: Math.max(20, Math.round(pdfRect.width * 10) / 10),
                height: Math.max(12, Math.round(pdfRect.height * 10) / 10),
              },
            };
          }),
        );
        return;
      }

      // Single node drag with snapping
      const field = fieldMappingsRef.current.find((m) => m.id === node.id);
      if (!field) return;

      let finalDom: DomRect = getNodeDomRect(node);

      if (isSnapEnabled) {
        const siblings = fieldMappingsRef.current
          .filter((m) => m.id !== node.id && m.pageIndex === activePageIndex)
          .map((m) => pdfToDomRect(m.rect, currentViewport));

        const snapResult = calculateSnapping(
          finalDom,
          siblings,
          currentViewport,
          {
            thresholdPx: snapThresholdPx,
            isAltPressed: "altKey" in e ? e.altKey : false,
            handleType: "move",
          },
        );
        finalDom = snapResult.rect;
      }

      const pdfRect = domToPdfRect(finalDom, currentViewport);
      pushSnapshot((prev) =>
        prev.map((f) =>
          f.id === node.id
            ? {
                ...f,
                rect: {
                  x: Math.round(pdfRect.x * 10) / 10,
                  y: Math.round(pdfRect.y * 10) / 10,
                  width: Math.max(20, Math.round(pdfRect.width * 10) / 10),
                  height: Math.max(12, Math.round(pdfRect.height * 10) / 10),
                },
              }
            : f,
        ),
      );
    },
    [
      isSnapEnabled,
      activePageIndex,
      currentViewport,
      snapThresholdPx,
      pushSnapshot,
    ],
  );

  // Guarded selection handlers to prevent cyclical re-renders and enable multi-selection
  const handleSelectField = useCallback(
    (id: string | null, isMulti?: boolean) => {
      setSelectedFieldIds((prev) => {
        if (!id) return [];
        if (isMulti) {
          if (prev.includes(id)) {
            return prev.filter((fid) => fid !== id);
          }
          return [...prev, id];
        }
        if (prev.length === 1 && prev[0] === id) {
          return prev;
        }
        return [id];
      });
    },
    [],
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selNodes }: { nodes: Node[] }) => {
      const fieldIds = selNodes
        .filter((n) => n.type === "field")
        .map((n) => n.id);
      setSelectedFieldIds((prev) => {
        if (
          prev.length === fieldIds.length &&
          prev.every((id, idx) => id === fieldIds[idx])
        ) {
          return prev;
        }
        return fieldIds;
      });
    },
    [],
  );

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type !== "field") {
      setSelectedFieldIds((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const isMulti = event.shiftKey || event.metaKey || event.ctrlKey;
    if (isMulti) {
      // React Flow's multiSelectionKeyCode handles multi-selection and fires handleSelectionChange
      return;
    }
    setSelectedFieldIds((prev) => {
      if (prev.length === 1 && prev[0] === node.id) {
        return prev;
      }
      return [node.id];
    });
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedFieldIds((prev) => (prev.length === 0 ? prev : []));
  }, []);

  const handleToggleSnap = useCallback(() => setIsSnapEnabled((s) => !s), []);
  const handleFitView = useCallback(
    () => fitView({ padding: 0.15, duration: 300 }),
    [fitView],
  );
  const handleRotate = useCallback(() => {
    setRotation((r) => (r + 90) % 360);
    setEffectiveRotation((er) => (er + 90) % 360);
  }, []);
  const handleOpenShortcuts = useCallback(
    () => setIsShortcutsModalOpen(true),
    [],
  );

  // Compute React Flow nodes
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);

  // Memoize stable pageNode reference so selecting/dragging fields never marks parent dirty
  const pageNode: Node = useMemo(
    () => ({
      id: "pdf-page",
      type: "pdfPage",
      position: { x: 0, y: 0 },
      draggable: false,
      selectable: false,
      deletable: false,
      data: {
        sourcePdfBytes,
        activePageIndex,
        pageWidth: pageDimensions.width,
        pageHeight: pageDimensions.height,
        rotation,
        detectedTokens,
        fieldMappings,
        onConfirmToken: handleConfirmToken,
        onPageLoaded: handlePageLoaded,
        onTokensDiscovered: setDetectedTokens,
        onPageClick: handlePaneClick,
        viewport: currentViewport,
      },
      style: {
        width: `${pageDimensions.width}px`,
        height: `${pageDimensions.height}px`,
      },
    }),
    [
      sourcePdfBytes,
      activePageIndex,
      pageDimensions.width,
      pageDimensions.height,
      rotation,
      detectedTokens,
      fieldMappings,
      handleConfirmToken,
      handlePageLoaded,
      handlePaneClick,
      currentViewport,
    ],
  );

  // Recompute node layout and geometry only when fields, page, or viewport changes
  useEffect(() => {
    const currentPageFields = fieldMappings.filter(
      (m) => m.pageIndex === activePageIndex,
    );
    const siblingsDomRects = currentPageFields.map((m) =>
      pdfToDomRect(m.rect, currentViewport),
    );

    const fieldNodes: Node[] = currentPageFields.map((field) => {
      const domRect = pdfToDomRect(field.rect, currentViewport);
      const isSelected = selectedFieldIdsRef.current.includes(field.id);

      return {
        id: field.id,
        type: "field",
        parentId: "pdf-page",
        extent: "parent",
        expandParent: false,
        position: { x: domRect.x, y: domRect.y },
        style: { width: `${domRect.width}px`, height: `${domRect.height}px` },
        data: {
          field,
          viewport: currentViewport,
          onUpdateField: handleUpdateField,
          onDuplicateField: handleDuplicateField,
          onDeleteField: handleDeleteField,
          isSnapEnabled,
          snapThresholdPx,
          setActiveGuides: setActiveGuidesState,
          siblingsDomRects: siblingsDomRects.filter(
            (_, idx) => currentPageFields[idx].id !== field.id,
          ),
        },
        selected: isSelected,
      };
    });

    setNodes([pageNode, ...fieldNodes]);
  }, [
    pageNode,
    fieldMappings,
    activePageIndex,
    currentViewport,
    handleUpdateField,
    handleDuplicateField,
    handleDeleteField,
    isSnapEnabled,
    snapThresholdPx,
    setNodes,
  ]);

  // Synchronize selection changes into React Flow nodes without recreating node geometry
  useEffect(() => {
    setNodes((currentNodes) => {
      let hasChanges = false;
      const updatedNodes = currentNodes.map((node) => {
        if (node.type !== "field") return node;
        const isSelected = selectedFieldIds.includes(node.id);
        if (Boolean(node.selected) !== isSelected) {
          hasChanges = true;
          return { ...node, selected: isSelected };
        }
        return node;
      });
      return hasChanges ? updatedNodes : currentNodes;
    });
  }, [selectedFieldIds, setNodes]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground h-full bg-slate-50 rounded-3xl lg:rounded-[28px]">
        <InfinityTrack className="text-blue-600" />
        <span className="text-sm font-medium">Loading template editor</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto h-screen flex flex-col items-center justify-center">
        <div className="text-red-500 font-medium mb-2">
          Error loading template workspace
        </div>
        <p className="text-sm text-slate-500 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-slate-800 text-white rounded text-sm hover:bg-slate-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100 flex flex-col rounded-3xl lg:rounded-[28px]">
      {/* Fixed Top-Left Back Button */}
      <Tooltip content="Back to Template Details" side="bottom">
        <Link
          to="/app/templates/$templateId"
          params={{ templateId }}
          className="absolute top-3 left-3 z-40 flex items-center gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-md hover:shadow-lg rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white transition-all select-none"
        >
          <ArrowLeft size={16} weight="bold" />
          <span>Back</span>
        </Link>
      </Tooltip>

      {viewMode === "preview" ? (
        // Full Preview Mode
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-2.5 bg-white border-b border-slate-200 shrink-0 pl-28">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-slate-800">
                {template?.name} (Preview)
              </h2>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-medium">
                v{version?.version}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("editor")}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium"
              >
                Back to Canvas Studio
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-200/50">
            <PreviewDocumentPane
              sourcePdfBytes={sourcePdfBytes}
              fieldMappings={fieldMappings}
              sampleData={sampleData}
              activePageIndex={activePageIndex}
              scale={1.0}
              rotation={rotation}
              onWarningsGenerated={setWarnings}
            />
          </div>
        </div>
      ) : (
        // Infinite Canvas Studio Mode
        <div className="w-full h-full relative">
          <ReactFlow
            nodes={nodes}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeDrag={handleNodeDrag}
            onNodeDragStop={handleNodeDragStop}
            onSelectionChange={handleSelectionChange}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            fitView
            minZoom={0.2}
            maxZoom={3.0}
            proOptions={{ hideAttribution: true }}
            panOnDrag={true}
            nodesDraggable={true}
            elementsSelectable={true}
            selectionMode={SelectionMode.Partial}
            selectionKeyCode={["Shift", "Control", "Meta"]}
            multiSelectionKeyCode={["Shift", "Control", "Meta"]}
            deleteKeyCode={null}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={16}
              size={1}
              color="#cbd5e1"
            />
            <AlignmentGuidesOverlay
              guides={activeGuides}
              width={pageDimensions.width}
              height={pageDimensions.height}
            />
            <Controls position="bottom-left" showInteractive={false} />

            {/* Unified Floating Top HUD Toolbar & Inspector */}
            <FloatingTopToolbar
              templateName={template?.name}
              versionNumber={version?.version}
              activePageIndex={activePageIndex}
              pageCount={pageCount}
              onPrevPage={handlePrevPage}
              onNextPage={handleNextPage}
              onAddField={handleAddField}
              isSnapEnabled={isSnapEnabled}
              onToggleSnap={handleToggleSnap}
              snapThresholdPx={snapThresholdPx}
              onChangeSnapThreshold={setSnapThresholdPx}
              viewMode={viewMode}
              onChangeViewMode={setViewMode}
              samplePreset={samplePreset}
              onChangeSamplePreset={setSamplePreset}
              onSaveVersion={handleSaveVersion}
              isSaving={isSaving}
              saveSuccessMessage={saveSuccessMessage}
              casError={casError}
              onFitView={handleFitView}
              rotation={rotation}
              onRotate={handleRotate}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
              selectedFieldIds={selectedFieldIds}
              onApplyAlignment={handleApplyAlignment}
              onOpenShortcuts={handleOpenShortcuts}
              onDeleteMultiple={handleDeleteMultiple}
              field={selectedField}
              fields={fieldMappings}
              selectedFieldId={selectedFieldId}
              onSelectField={handleSelectField}
              onUpdateField={handleUpdateField}
              onDeleteField={handleDeleteField}
              detectedTokens={detectedTokens}
              onConfirmToken={handleConfirmToken}
              onDismissToken={handleDismissToken}
              warnings={warnings}
            />
          </ReactFlow>
        </div>
      )}

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
    </div>
  );
};

export const PdfMappingWorkspace: React.FC<PdfMappingWorkspaceProps> = (
  props,
) => {
  return (
    <ReactFlowProvider>
      <PdfMappingWorkspaceInner {...props} />
    </ReactFlowProvider>
  );
};
