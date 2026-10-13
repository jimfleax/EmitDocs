import type { DomRect, ViewportConfig } from "./coordinate-transforms";
import { domToPdfRect, pdfToDomRect } from "./coordinate-transforms";
import type { IFieldMapping } from "@/components/templates/mapping/types";

export type AlignmentAction =
  | "alignLeft"
  | "alignCenterH"
  | "alignRight"
  | "alignTop"
  | "alignMiddleV"
  | "alignBottom"
  | "distributeH"
  | "distributeV"
  | "centerOnPageH"
  | "centerOnPageV";

interface FieldWithDom {
  field: IFieldMapping;
  dom: DomRect;
}

export function applyAlignmentToFields(
  selectedIds: string[],
  allFields: IFieldMapping[],
  action: AlignmentAction,
  viewport: ViewportConfig,
  pageSize: { width: number; height: number },
): IFieldMapping[] {
  if (selectedIds.length === 0) return allFields;

  const targetFields = allFields.filter((f) => selectedIds.includes(f.id));
  if (targetFields.length === 0) return allFields;

  if (targetFields.length < 2 && !action.startsWith("centerOnPage")) {
    return allFields;
  }
  if (targetFields.length < 3 && action.startsWith("distribute")) {
    return allFields;
  }

  const items: FieldWithDom[] = targetFields.map((f) => ({
    field: f,
    dom: pdfToDomRect(f.rect, viewport),
  }));

  const minX = Math.min(...items.map((i) => i.dom.x));
  const maxX = Math.max(...items.map((i) => i.dom.x + i.dom.width));
  const minY = Math.min(...items.map((i) => i.dom.y));
  const maxY = Math.max(...items.map((i) => i.dom.y + i.dom.height));
  const bboxW = maxX - minX;
  const bboxH = maxY - minY;
  const bboxCenterX = minX + bboxW / 2;
  const bboxCenterY = minY + bboxH / 2;

  const updatedItems = items.map((item) => ({ ...item, dom: { ...item.dom } }));

  switch (action) {
    case "alignLeft":
      updatedItems.forEach((i) => (i.dom.x = minX));
      break;

    case "alignCenterH":
      updatedItems.forEach((i) => (i.dom.x = bboxCenterX - i.dom.width / 2));
      break;

    case "alignRight":
      updatedItems.forEach((i) => (i.dom.x = maxX - i.dom.width));
      break;

    case "alignTop":
      updatedItems.forEach((i) => (i.dom.y = minY));
      break;

    case "alignMiddleV":
      updatedItems.forEach((i) => (i.dom.y = bboxCenterY - i.dom.height / 2));
      break;

    case "alignBottom":
      updatedItems.forEach((i) => (i.dom.y = maxY - i.dom.height));
      break;

    case "centerOnPageH": {
      const deltaX = pageSize.width / 2 - bboxCenterX;
      updatedItems.forEach((i) => (i.dom.x += deltaX));
      break;
    }

    case "centerOnPageV": {
      const deltaY = pageSize.height / 2 - bboxCenterY;
      updatedItems.forEach((i) => (i.dom.y += deltaY));
      break;
    }

    case "distributeH": {
      const sorted = [...updatedItems].sort((a, b) => a.dom.x - b.dom.x);
      const totalWidth = sorted.reduce((sum, item) => sum + item.dom.width, 0);
      const totalSpan =
        sorted[sorted.length - 1].dom.x +
        sorted[sorted.length - 1].dom.width -
        sorted[0].dom.x;
      const totalGap = totalSpan - totalWidth;

      if (totalGap >= 0) {
        const gap = totalGap / (sorted.length - 1);
        let currX = sorted[0].dom.x;
        for (let idx = 0; idx < sorted.length; idx++) {
          sorted[idx].dom.x = currX;
          currX += sorted[idx].dom.width + gap;
        }
      } else {
        const firstCenter = sorted[0].dom.x + sorted[0].dom.width / 2;
        const lastCenter =
          sorted[sorted.length - 1].dom.x +
          sorted[sorted.length - 1].dom.width / 2;
        const pitch = (lastCenter - firstCenter) / (sorted.length - 1);
        for (let idx = 0; idx < sorted.length; idx++) {
          sorted[idx].dom.x =
            firstCenter + idx * pitch - sorted[idx].dom.width / 2;
        }
      }
      break;
    }

    case "distributeV": {
      const sorted = [...updatedItems].sort((a, b) => a.dom.y - b.dom.y);
      const totalHeight = sorted.reduce(
        (sum, item) => sum + item.dom.height,
        0,
      );
      const totalSpan =
        sorted[sorted.length - 1].dom.y +
        sorted[sorted.length - 1].dom.height -
        sorted[0].dom.y;
      const totalGap = totalSpan - totalHeight;

      if (totalGap >= 0) {
        const gap = totalGap / (sorted.length - 1);
        let currY = sorted[0].dom.y;
        for (let idx = 0; idx < sorted.length; idx++) {
          sorted[idx].dom.y = currY;
          currY += sorted[idx].dom.height + gap;
        }
      } else {
        const firstCenter = sorted[0].dom.y + sorted[0].dom.height / 2;
        const lastCenter =
          sorted[sorted.length - 1].dom.y +
          sorted[sorted.length - 1].dom.height / 2;
        const pitch = (lastCenter - firstCenter) / (sorted.length - 1);
        for (let idx = 0; idx < sorted.length; idx++) {
          sorted[idx].dom.y =
            firstCenter + idx * pitch - sorted[idx].dom.height / 2;
        }
      }
      break;
    }
  }

  const updatedMap = new Map<string, IFieldMapping>();
  for (const item of updatedItems) {
    const pdfRect = domToPdfRect(item.dom, viewport);
    updatedMap.set(item.field.id, {
      ...item.field,
      rect: {
        x: Math.round(pdfRect.x * 10) / 10,
        y: Math.round(pdfRect.y * 10) / 10,
        width: Math.max(10, Math.round(pdfRect.width * 10) / 10),
        height: Math.max(8, Math.round(pdfRect.height * 10) / 10),
      },
    });
  }

  return allFields.map((f) =>
    updatedMap.has(f.id) ? updatedMap.get(f.id)! : f,
  );
}
