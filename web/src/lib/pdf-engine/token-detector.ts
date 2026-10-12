import type { PdfRect } from './coordinate-transforms';

export interface TextItemLike {
  str: string;
  transform: number[]; // [scaleX, skewY, skewX, scaleY, tx, ty]
  width: number;
  height: number;
  fontName?: string;
}

export interface TextStyleLike {
  fontFamily?: string;
  ascent?: number;
  descent?: number;
  vertical?: boolean;
}

export interface DetectedToken {
  key: string;
  rawMatch: string;
  pageIndex: number;
  rect: PdfRect; // Padded for 100% mask coverage
  rawRect: PdfRect; // Exact unpadded typographic boundary
  detectedFontSize: number;
  detectedFontFamily: string;
  baselineY: number;
  confidence: 'exact' | 'split-span';
}

interface CharRun {
  char: string;
  x: number;
  y: number; // Bottom in PDF points (baseline + descent)
  topY: number; // Top in PDF points (baseline + ascent)
  baselineY: number; // Text baseline in PDF points
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  itemIndex: number;
}

// Proportional character width estimation table when canvas context is unavailable
function getEstimatedCharWeight(char: string): number {
  if (/[ijlI1.,:;!'|`\s]/.test(char)) return 0.28;
  if (/[{}[\]()_-]/.test(char)) return 0.35;
  if (/[frt]/.test(char)) return 0.4;
  if (/[abcdeghknopqsuvxyz0-9]/.test(char)) return 0.55;
  if (/[ABCDEFGHJKLMNOPQRSTUVXYZ]/.test(char)) return 0.7;
  if (/[mwMW@]/.test(char)) return 0.88;
  return 0.55;
}

let measureCanvasCtx: CanvasRenderingContext2D | null = null;
function getCanvasContext(): CanvasRenderingContext2D | null {
  if (measureCanvasCtx) return measureCanvasCtx;
  if (typeof document !== 'undefined') {
    try {
      const c = document.createElement('canvas');
      measureCanvasCtx = c.getContext('2d');
    } catch {
      measureCanvasCtx = null;
    }
  }
  return measureCanvasCtx;
}

function computeCharAdvances(
  str: string,
  totalWidth: number,
  fontSize: number,
  fontFamily: string
): number[] {
  const len = str.length;
  if (len === 0) return [];
  if (len === 1) return [totalWidth];

  const ctx = getCanvasContext();
  const rawAdvances: number[] = new Array(len);

  if (ctx) {
    try {
      ctx.font = `${fontSize}px ${fontFamily}, sans-serif`;
      for (let i = 0; i < len; i++) {
        rawAdvances[i] = ctx.measureText(str[i]).width || getEstimatedCharWeight(str[i]) * fontSize;
      }
    } catch {
      for (let i = 0; i < len; i++) {
        rawAdvances[i] = getEstimatedCharWeight(str[i]) * fontSize;
      }
    }
  } else {
    for (let i = 0; i < len; i++) {
      rawAdvances[i] = getEstimatedCharWeight(str[i]) * fontSize;
    }
  }

  const rawSum = rawAdvances.reduce((sum, w) => sum + w, 0);
  if (rawSum > 0 && totalWidth > 0) {
    const scale = totalWidth / rawSum;
    return rawAdvances.map((w) => w * scale);
  }

  // Fallback equal distribution
  const avg = totalWidth / len;
  return new Array(len).fill(avg);
}

export function detectTokensInTextItems(
  items: TextItemLike[],
  pageIndex: number,
  styles?: Record<string, TextStyleLike>,
  yTolerance = 2.5
): DetectedToken[] {
  if (!items || items.length === 0) return [];

  // Filter out empty items
  const validItems = items.filter((item) => typeof item.str === 'string' && item.str.length > 0);
  if (validItems.length === 0) return [];

  // Group items by baseline Y (transform[5])
  const lines: TextItemLike[][] = [];
  const sortedByY = [...validItems].sort((a, b) => b.transform[5] - a.transform[5]);

  for (const item of sortedByY) {
    const itemY = item.transform[5];
    let matchedLine = lines.find((line) => {
      const lineY = line[0].transform[5];
      return Math.abs(lineY - itemY) <= yTolerance;
    });

    if (matchedLine) {
      matchedLine.push(item);
    } else {
      lines.push([item]);
    }
  }

  const detectedTokens: DetectedToken[] = [];

  for (const line of lines) {
    // Sort items within line by X (transform[4])
    line.sort((a, b) => a.transform[4] - b.transform[4]);

    // Build character map
    const charRuns: CharRun[] = [];
    let lineString = '';

    line.forEach((item, itemIdx) => {
      const itemX = item.transform[4];
      const itemY = item.transform[5]; // Baseline in PDF points
      const fontSize = Math.abs(item.transform[3]) || item.height || 12;

      // Ingest font style metrics from PDF.js if available
      const style = (styles && item.fontName && styles[item.fontName]) || {};
      const ascentRatio = typeof style.ascent === 'number' ? style.ascent : 0.85;
      const rawDescent = typeof style.descent === 'number' ? style.descent : -0.25;
      const descentRatio = rawDescent > 0 ? -rawDescent : rawDescent; // ensure negative
      const fontFamily = style.fontFamily || 'Helvetica';

      const itemBottomY = itemY + descentRatio * fontSize;
      const itemTopY = itemY + ascentRatio * fontSize;
      const itemHeight = (ascentRatio - descentRatio) * fontSize;

      const charAdvances = computeCharAdvances(item.str, item.width, fontSize, fontFamily);

      let currentX = itemX;
      for (let i = 0; i < item.str.length; i++) {
        const char = item.str[i];
        const charW = charAdvances[i] || 0;
        lineString += char;
        charRuns.push({
          char,
          x: currentX,
          y: itemBottomY,
          topY: itemTopY,
          baselineY: itemY,
          width: charW,
          height: itemHeight,
          fontSize,
          fontFamily,
          itemIndex: itemIdx,
        });
        currentX += charW;
      }
    });

    // Find multi-pattern placeholder tokens: {{key}}, {key}, [key], <key>, $key
    const regex = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}|\{([a-zA-Z0-9_.-]+)\}|\[([a-zA-Z0-9_.-]+)\]|<([a-zA-Z0-9_.-]+)>|\$([a-zA-Z0-9_-]+)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(lineString)) !== null) {
      const rawMatch = match[0];
      const key = match[1] || match[2] || match[3] || match[4] || match[5];
      if (!key) continue;
      const startIndex = match.index;
      const endIndex = startIndex + rawMatch.length;

      const matchingRuns = charRuns.slice(startIndex, endIndex);
      if (matchingRuns.length === 0) continue;

      const minX = Math.min(...matchingRuns.map((r) => r.x));
      const maxX = Math.max(...matchingRuns.map((r) => r.x + r.width));
      const minY = Math.min(...matchingRuns.map((r) => r.y));
      const maxY = Math.max(...matchingRuns.map((r) => r.topY));

      const firstRun = matchingRuns[0];
      const baselineY = firstRun.baselineY;
      const detectedFontSize = Math.round(firstRun.fontSize * 10) / 10;
      const detectedFontFamily = firstRun.fontFamily || 'Helvetica';

      // Unpadded exact typographic boundary
      const rawWidth = Math.max(8, maxX - minX);
      const rawHeight = Math.max(8, maxY - minY);
      const rawRect: PdfRect = {
        x: Math.round(minX * 10) / 10,
        y: Math.round(minY * 10) / 10,
        width: Math.round(rawWidth * 10) / 10,
        height: Math.round(rawHeight * 10) / 10,
      };

      // Safety bleed padding for 100% vector mask coverage
      const padX = 2.0;
      const padY = 1.5;
      const paddedRect: PdfRect = {
        x: Math.round((minX - padX) * 10) / 10,
        y: Math.round((minY - padY) * 10) / 10,
        width: Math.round((rawWidth + 2 * padX) * 10) / 10,
        height: Math.round((rawHeight + 2 * padY) * 10) / 10,
      };

      // Check if spanned multiple items
      const itemIndices = new Set(matchingRuns.map((r) => r.itemIndex));
      const confidence = itemIndices.size > 1 ? 'split-span' : 'exact';

      detectedTokens.push({
        key,
        rawMatch,
        pageIndex,
        rect: paddedRect,
        rawRect,
        detectedFontSize,
        detectedFontFamily,
        baselineY: Math.round(baselineY * 10) / 10,
        confidence,
      });
    }
  }

  return detectedTokens;
}
