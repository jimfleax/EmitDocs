/**
 * @file alignment-snapper.ts
 * @description Magnetic edge-snapping and alignment guide line calculator for interactive canvas dragging.
 * @architecture Computes snap positions and visual guide lines against sibling nodes and viewport bounds during move and 8-point resize operations.
 * @agent_note Holding Alt / Option bypasses snapping calculations.
 */

import type { DomRect, ViewportConfig } from "./coordinate-transforms";

export interface AlignmentGuide {
  type: "vertical" | "horizontal";
  position: number; // coordinate in CSS pixels
  label?: string; // e.g. "Center", "Edge"
}

export type HandleType =
  "move" | "nw" | "ne" | "se" | "sw" | "n" | "e" | "s" | "w";

export interface SnapOptions {
  thresholdPx?: number; // default 8px
  snapToPage?: boolean; // default true
  snapToSiblings?: boolean; // default true
  isAltPressed?: boolean; // default false (bypasses snapping)
  handleType?: HandleType; // default 'move'
}

export interface SnapResult {
  rect: DomRect;
  guides: AlignmentGuide[];
}

/**
 * Calculates magnetic snapping coordinates and active alignment guide lines
 * for bounding boxes during dragging and 8-point resizing.
 * @desc Evaluates target proximity against page edges and sibling boxes, snapping coordinates within threshold.
 * @param {DomRect} current - Un-snapped target bounding box in DOM coordinates.
 * @param {DomRect[]} siblings - Surrounding sibling boxes on the active page.
 * @param {ViewportConfig} viewport - Active canvas dimensions and zoom config.
 * @param {SnapOptions} [options={}] - Threshold, snap targets, modifier key flags, and active resize handle.
 * @returns {SnapResult} Snapped bounding rectangle and active guide lines to display.
 */
export function calculateSnapping(
  current: DomRect,
  siblings: DomRect[],
  viewport: ViewportConfig,
  options: SnapOptions = {},
): SnapResult {
  const {
    thresholdPx = 8,
    snapToPage = true,
    snapToSiblings = true,
    isAltPressed = false,
    handleType = "move",
  } = options;

  // 1. If Alt is pressed or threshold <= 0, bypass snapping
  if (isAltPressed || thresholdPx <= 0) {
    return {
      rect: { ...current },
      guides: [],
    };
  }

  const snapped: DomRect = { ...current };
  const guides: AlignmentGuide[] = [];

  // Determine which edges can snap based on handleType
  const canSnapX =
    handleType === "move" ||
    handleType.includes("e") ||
    handleType.includes("w");
  const canSnapY =
    handleType === "move" ||
    handleType.includes("n") ||
    handleType.includes("s");

  // --- VERTICAL SNAPPING (X-Axis alignment) ---
  if (canSnapX) {
    const xTargets: Array<{ pos: number; label: string }> = [];

    if (snapToPage) {
      xTargets.push({ pos: 0, label: "Page Left" });
      xTargets.push({ pos: viewport.width / 2, label: "Page Center" });
      xTargets.push({ pos: viewport.width, label: "Page Right" });
    }

    if (snapToSiblings) {
      for (const sib of siblings) {
        xTargets.push({ pos: sib.x, label: "Sibling Left" });
        xTargets.push({ pos: sib.x + sib.width / 2, label: "Sibling Center" });
        xTargets.push({ pos: sib.x + sib.width, label: "Sibling Right" });
      }
    }

    let bestDiffX: number | null = null;
    let bestSnapX: number | null = null;
    let bestGuideX: AlignmentGuide | null = null;
    let bestModeX: "left" | "center" | "right" | null = null;

    for (const target of xTargets) {
      // Check Left edge (if move or west handle)
      if (handleType === "move" || handleType.includes("w")) {
        const diff = target.pos - current.x;
        if (
          Math.abs(diff) <= thresholdPx &&
          (bestDiffX === null || Math.abs(diff) < Math.abs(bestDiffX))
        ) {
          bestDiffX = diff;
          bestSnapX = target.pos;
          bestModeX = "left";
          bestGuideX = {
            type: "vertical",
            position: target.pos,
            label: target.label,
          };
        }
      }

      // Check Center (only during move)
      if (handleType === "move") {
        const curCenterX = current.x + current.width / 2;
        const diff = target.pos - curCenterX;
        if (
          Math.abs(diff) <= thresholdPx &&
          (bestDiffX === null || Math.abs(diff) < Math.abs(bestDiffX))
        ) {
          bestDiffX = diff;
          bestSnapX = target.pos;
          bestModeX = "center";
          bestGuideX = {
            type: "vertical",
            position: target.pos,
            label: target.label,
          };
        }
      }

      // Check Right edge (if move or east handle)
      if (handleType === "move" || handleType.includes("e")) {
        const curRight = current.x + current.width;
        const diff = target.pos - curRight;
        if (
          Math.abs(diff) <= thresholdPx &&
          (bestDiffX === null || Math.abs(diff) < Math.abs(bestDiffX))
        ) {
          bestDiffX = diff;
          bestSnapX = target.pos;
          bestModeX = "right";
          bestGuideX = {
            type: "vertical",
            position: target.pos,
            label: target.label,
          };
        }
      }
    }

    if (bestSnapX !== null && bestGuideX !== null) {
      if (handleType === "move") {
        if (bestModeX === "left") {
          snapped.x = bestSnapX;
        } else if (bestModeX === "center") {
          snapped.x = bestSnapX - current.width / 2;
        } else if (bestModeX === "right") {
          snapped.x = bestSnapX - current.width;
        }
      } else if (handleType.includes("w")) {
        const rightEdge = current.x + current.width;
        const newWidth = Math.max(20, rightEdge - bestSnapX);
        snapped.x = rightEdge - newWidth;
        snapped.width = newWidth;
      } else if (handleType.includes("e")) {
        snapped.width = Math.max(20, bestSnapX - current.x);
      }
      guides.push(bestGuideX);
    }
  }

  // --- HORIZONTAL SNAPPING (Y-Axis alignment) ---
  if (canSnapY) {
    const yTargets: Array<{ pos: number; label: string }> = [];

    if (snapToPage) {
      yTargets.push({ pos: 0, label: "Page Top" });
      yTargets.push({ pos: viewport.height / 2, label: "Page Center" });
      yTargets.push({ pos: viewport.height, label: "Page Bottom" });
    }

    if (snapToSiblings) {
      for (const sib of siblings) {
        yTargets.push({ pos: sib.y, label: "Sibling Top" });
        yTargets.push({ pos: sib.y + sib.height / 2, label: "Sibling Center" });
        yTargets.push({ pos: sib.y + sib.height, label: "Sibling Bottom" });
      }
    }

    let bestDiffY: number | null = null;
    let bestSnapY: number | null = null;
    let bestGuideY: AlignmentGuide | null = null;
    let bestModeY: "top" | "center" | "bottom" | null = null;

    for (const target of yTargets) {
      // Check Top edge (if move or north handle)
      if (handleType === "move" || handleType.includes("n")) {
        const diff = target.pos - current.y;
        if (
          Math.abs(diff) <= thresholdPx &&
          (bestDiffY === null || Math.abs(diff) < Math.abs(bestDiffY))
        ) {
          bestDiffY = diff;
          bestSnapY = target.pos;
          bestModeY = "top";
          bestGuideY = {
            type: "horizontal",
            position: target.pos,
            label: target.label,
          };
        }
      }

      // Check Center (only during move)
      if (handleType === "move") {
        const curCenterY = current.y + current.height / 2;
        const diff = target.pos - curCenterY;
        if (
          Math.abs(diff) <= thresholdPx &&
          (bestDiffY === null || Math.abs(diff) < Math.abs(bestDiffY))
        ) {
          bestDiffY = diff;
          bestSnapY = target.pos;
          bestModeY = "center";
          bestGuideY = {
            type: "horizontal",
            position: target.pos,
            label: target.label,
          };
        }
      }

      // Check Bottom edge (if move or south handle)
      if (handleType === "move" || handleType.includes("s")) {
        const curBottom = current.y + current.height;
        const diff = target.pos - curBottom;
        if (
          Math.abs(diff) <= thresholdPx &&
          (bestDiffY === null || Math.abs(diff) < Math.abs(bestDiffY))
        ) {
          bestDiffY = diff;
          bestSnapY = target.pos;
          bestModeY = "bottom";
          bestGuideY = {
            type: "horizontal",
            position: target.pos,
            label: target.label,
          };
        }
      }
    }

    if (bestSnapY !== null && bestGuideY !== null) {
      if (handleType === "move") {
        if (bestModeY === "top") {
          snapped.y = bestSnapY;
        } else if (bestModeY === "center") {
          snapped.y = bestSnapY - current.height / 2;
        } else if (bestModeY === "bottom") {
          snapped.y = bestSnapY - current.height;
        }
      } else if (handleType.includes("n")) {
        const bottomEdge = current.y + current.height;
        const newHeight = Math.max(12, bottomEdge - bestSnapY);
        snapped.y = bottomEdge - newHeight;
        snapped.height = newHeight;
      } else if (handleType.includes("s")) {
        snapped.height = Math.max(12, bestSnapY - current.y);
      }
      guides.push(bestGuideY);
    }
  }

  return {
    rect: snapped,
    guides,
  };
}
