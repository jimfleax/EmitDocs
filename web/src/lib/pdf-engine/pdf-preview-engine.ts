/**
 * @file pdf-preview-engine.ts
 * @description High-fidelity PDF overlay generation engine using pdf-lib and fontkit.
 * @architecture Loads base PDF documents, handles custom and standard fonts, applies solid/custom masks, renders formatted field overlays, and emits diagnostic warnings.
 * @agent_note Supports hex color parsing, AcroForm flattening, and multi-line text wrapping.
 */

import {
  PDFDocument,
  StandardFonts,
  TextAlignment,
  rgb,
  type Color,
  type PDFFont,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { calculateFit, calculateMultiLineWrap } from "./fit-then-flag";
import { validateStandardFontGlyphs } from "./glyph-validator";
import { formatFieldValue } from "./format-engine";
import type { TextTransformMode } from "@/components/templates/mapping/types";

export interface FieldMappingConfig {
  id: string;
  key: string;
  label?: string;
  type?: "text" | "date" | "number";
  pageIndex: number;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  alignment?: "left" | "center" | "right";
  fontFamily?: string;
  fontSize?: number;
  minFontSize?: number;
  maxFontSize?: number;
  color?: string;
  fitMode?: "shrink-to-fit" | "fixed" | "multi-line";
  maskMode?: "none" | "solid-white" | "custom-color" | "acroform-field";
  maskColor?: string;
  customFontBytes?: string;
  customFontUrl?: string;
  lineHeight?: number;
  sampleValue?: string;
  format?: string;
  textTransform?: TextTransformMode;
}

export interface EngineWarning {
  type: "overflow" | "unsupported_glyph" | "unsafe_mask";
  fieldKey: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface OverlayOptions {
  drawDebugBoxes?: boolean;
  flattenAcroForms?: boolean;
}

/**
 * @desc Converts a 3-digit or 6-digit hex color string into a pdf-lib RGB Color object.
 * @param {string} hex - Hex color code (e.g. "#FF0000", "#FFF").
 * @returns {Color} pdf-lib Color representation.
 */
export function parseHexColor(hex: string): Color {
  if (!hex || typeof hex !== "string") return rgb(0, 0, 0);
  const cleanHex = hex.replace("#", "").trim();
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16) / 255;
    const g = parseInt(cleanHex[1] + cleanHex[1], 16) / 255;
    const b = parseInt(cleanHex[2] + cleanHex[2], 16) / 255;
    return rgb(r, g, b);
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    return rgb(r, g, b);
  }
  return rgb(0, 0, 0);
}

function decodeBase64(base64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }
  const globalObj =
    typeof globalThis !== "undefined" ? (globalThis as any) : null;
  if (globalObj?.Buffer) {
    return Uint8Array.from(globalObj.Buffer.from(base64, "base64"));
  }
  return new Uint8Array(0);
}

/**
 * @desc Overlays dynamic fields, custom masks, and typography onto a PDF document returning byte array and diagnostics.
 * @param {Uint8Array | ArrayBuffer} sourcePdfBytes - Source PDF document binary data.
 * @param {FieldMappingConfig[]} fieldMappings - Field configurations, typography settings, coordinates, and sample values.
 * @param {Record<string, string>} [data={}] - Key-value map providing replacement values for fields.
 * @param {OverlayOptions} [options={}] - Debug borders and AcroForm flattening toggles.
 * @returns {Promise<{ pdfBytes: Uint8Array; warnings: EngineWarning[] }>} Serialized output PDF and any formatting/overflow warnings.
 * @throws {Error} If document cannot be parsed by pdf-lib.
 */
export async function generatePdfWithOverlay(
  sourcePdfBytes: Uint8Array | ArrayBuffer,
  fieldMappings: FieldMappingConfig[],
  data: Record<string, string> = {},
  options: OverlayOptions = {},
): Promise<{ pdfBytes: Uint8Array; warnings: EngineWarning[] }> {
  const bytes =
    sourcePdfBytes instanceof Uint8Array
      ? sourcePdfBytes.slice(0)
      : new Uint8Array(sourcePdfBytes).slice(0);

  // 1. Load source document and create a clean output document
  // Copying pages into a fresh document strips corrupted object streams, multi-generation XRef tables,
  // and circular references that break PDF.js rendering on complex templates.
  const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const outDoc = await PDFDocument.create();
  // Ensure deterministic, bit-for-bit reproducible binary output across preview and batch (AC4 parity)
  outDoc.setCreationDate(new Date(0));
  outDoc.setModificationDate(new Date(0));
  try {
    outDoc.registerFontkit(fontkit);
  } catch {
    // Already registered or unavailable
  }

  const copiedPages = await outDoc.copyPages(srcDoc, srcDoc.getPageIndices());
  copiedPages.forEach((p) => outDoc.addPage(p));

  const pages = outDoc.getPages();
  const warnings: EngineWarning[] = [];
  let hasAcroForms = false;

  // Font cache on outDoc
  const fontCache: Record<string, PDFFont> = {};
  const getFont = async (
    mapping: FieldMappingConfig,
  ): Promise<{ font: PDFFont; isCustom: boolean }> => {
    if (mapping.customFontBytes) {
      const cacheKey = `custom-${mapping.id || mapping.key}`;
      if (!fontCache[cacheKey]) {
        try {
          const fontBytes = decodeBase64(mapping.customFontBytes);
          fontCache[cacheKey] = await outDoc.embedFont(fontBytes);
        } catch (err) {
          console.warn(
            "Failed to embed custom font, falling back to standard font",
            err,
          );
        }
      }
      if (fontCache[cacheKey]) {
        return { font: fontCache[cacheKey], isCustom: true };
      }
    }

    const family = mapping.fontFamily;
    const f = family?.toLowerCase() || "helvetica";
    if (f.includes("bold") && f.includes("helvetica")) {
      if (!fontCache["helvetica-bold"])
        fontCache["helvetica-bold"] = await outDoc.embedFont(
          StandardFonts.HelveticaBold,
        );
      return { font: fontCache["helvetica-bold"], isCustom: false };
    }
    if (f.includes("times")) {
      if (f.includes("bold")) {
        if (!fontCache["times-bold"])
          fontCache["times-bold"] = await outDoc.embedFont(
            StandardFonts.TimesRomanBold,
          );
        return { font: fontCache["times-bold"], isCustom: false };
      }
      if (!fontCache["times"])
        fontCache["times"] = await outDoc.embedFont(StandardFonts.TimesRoman);
      return { font: fontCache["times"], isCustom: false };
    }
    if (f.includes("courier")) {
      if (f.includes("bold")) {
        if (!fontCache["courier-bold"])
          fontCache["courier-bold"] = await outDoc.embedFont(
            StandardFonts.CourierBold,
          );
        return { font: fontCache["courier-bold"], isCustom: false };
      }
      if (!fontCache["courier"])
        fontCache["courier"] = await outDoc.embedFont(StandardFonts.Courier);
      return { font: fontCache["courier"], isCustom: false };
    }
    if (!fontCache["helvetica"])
      fontCache["helvetica"] = await outDoc.embedFont(StandardFonts.Helvetica);
    return { font: fontCache["helvetica"], isCustom: false };
  };

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    const mappingsForPage = fieldMappings.filter(
      (m) => m.pageIndex === pageIdx,
    );

    for (const mapping of mappingsForPage) {
      const rawText =
        data[mapping.key] ?? mapping.sampleValue ?? `{{${mapping.key}}}`;
      const formattedText = formatFieldValue(
        rawText,
        mapping.type,
        mapping.format,
        mapping.textTransform,
      );
      const { font, isCustom } = await getFont(mapping);

      // 1. Glyph Validation (standard fonts only support WinAnsi)
      let textToRender = formattedText;
      if (!isCustom) {
        const glyphResult = validateStandardFontGlyphs(formattedText);
        if (!glyphResult.valid) {
          warnings.push({
            type: "unsupported_glyph",
            fieldKey: mapping.key,
            message: `Text contains glyphs unencodable by standard font: ${glyphResult.missingGlyphs.join(", ")}`,
            details: { missingGlyphs: glyphResult.missingGlyphs },
          });
          const missingLookup = new Set(glyphResult.missingGlyphs);
          textToRender = Array.from(formattedText)
            .map((c) => (missingLookup.has(c) ? "?" : c))
            .join("");
        }
      }

      // 2. Draw Mask if enabled (AcroForm mode is completely transparent - no rectangle drawn)
      if (
        mapping.maskMode &&
        mapping.maskMode !== "none" &&
        mapping.maskMode !== "acroform-field"
      ) {
        const maskHex =
          mapping.maskMode === "solid-white"
            ? "#FFFFFF"
            : mapping.maskColor || "#FFFFFF";
        page.drawRectangle({
          x: mapping.rect.x,
          y: mapping.rect.y,
          width: mapping.rect.width,
          height: mapping.rect.height,
          color: parseHexColor(maskHex),
        });
      } else {
        if (
          mapping.maskMode === "none" &&
          mapping.color?.toLowerCase() === "#ffffff"
        ) {
          warnings.push({
            type: "unsafe_mask",
            fieldKey: mapping.key,
            message:
              "White text drawn with transparent mask may be illegible over light backgrounds",
          });
        }
      }

      // 3. Render Field: Native AcroForm Field OR Standard Overlay Text
      const minSize = mapping.minFontSize || 8;
      const maxSize = mapping.maxFontSize || mapping.fontSize || 18;
      const fitMode = mapping.fitMode || "shrink-to-fit";
      const textColor = parseHexColor(mapping.color || "#000000");

      if (mapping.maskMode === "acroform-field") {
        hasAcroForms = true;
        const form = outDoc.getForm();
        const fieldName = `${mapping.key}_${pageIdx}_${mapping.id || Math.random().toString(36).substring(7)}`;
        const tf = form.createTextField(fieldName);

        tf.addToPage(page, {
          x: mapping.rect.x,
          y: mapping.rect.y,
          width: mapping.rect.width,
          height: mapping.rect.height,
          backgroundColor: undefined,
          borderColor: undefined,
          borderWidth: 0,
          textColor,
          font,
        });

        const fit = calculateFit(
          textToRender,
          font,
          { width: mapping.rect.width, height: mapping.rect.height },
          minSize,
          maxSize,
          fitMode === "multi-line" ? "shrink-to-fit" : fitMode,
        );

        if (fit.isOverflow) {
          warnings.push({
            type: "overflow",
            fieldKey: mapping.key,
            message: `Text overflows field by ${fit.overflowPixels} points at minimum font size (${minSize}pt)`,
            details: {
              overflowPixels: fit.overflowPixels,
              fittedFontSize: fit.fittedFontSize,
            },
          });
        }

        tf.setFontSize(fit.fittedFontSize);

        if (mapping.alignment === "center") {
          tf.setAlignment(TextAlignment.Center);
        } else if (mapping.alignment === "right") {
          tf.setAlignment(TextAlignment.Right);
        } else {
          tf.setAlignment(TextAlignment.Left);
        }

        if (fitMode === "multi-line") {
          tf.enableMultiline();
        }

        tf.setText(textToRender);
        tf.updateAppearances(font);
      } else if (fitMode === "multi-line") {
        const lhMultiplier =
          mapping.lineHeight &&
          mapping.fontSize &&
          mapping.lineHeight >= mapping.fontSize
            ? mapping.lineHeight / mapping.fontSize
            : 1.25;
        const wrapResult = calculateMultiLineWrap(
          textToRender,
          font,
          { width: mapping.rect.width, height: mapping.rect.height },
          mapping.fontSize || 12,
          lhMultiplier,
          minSize,
          maxSize,
        );

        if (wrapResult.isOverflow) {
          warnings.push({
            type: "overflow",
            fieldKey: mapping.key,
            message: `Multi-line text overflows box height by ${wrapResult.overflowPixels} points at minimum font size (${minSize}pt)`,
            details: {
              overflowPixels: wrapResult.overflowPixels,
              fittedFontSize: wrapResult.fittedFontSize,
            },
          });
        }

        const fontSize = wrapResult.fittedFontSize;
        const lineHeight = wrapResult.lineHeight;
        const startBaselineY =
          mapping.rect.y + mapping.rect.height - fontSize * 0.9;

        wrapResult.lines.forEach((lineText, lineIdx) => {
          const lineWidth = font.widthOfTextAtSize(lineText, fontSize);
          let lineX = mapping.rect.x;
          if (mapping.alignment === "center") {
            lineX = mapping.rect.x + (mapping.rect.width - lineWidth) / 2;
          } else if (mapping.alignment === "right") {
            lineX = mapping.rect.x + mapping.rect.width - lineWidth;
          }
          const baselineY = startBaselineY - lineIdx * lineHeight;

          page.drawText(lineText, {
            x: lineX,
            y: baselineY,
            size: fontSize,
            font,
            color: textColor,
          });
        });
      } else {
        const fit = calculateFit(
          textToRender,
          font,
          { width: mapping.rect.width, height: mapping.rect.height },
          minSize,
          maxSize,
          fitMode,
        );

        if (fit.isOverflow) {
          warnings.push({
            type: "overflow",
            fieldKey: mapping.key,
            message: `Text overflows field by ${fit.overflowPixels} points at minimum font size (${minSize}pt)`,
            details: {
              overflowPixels: fit.overflowPixels,
              fittedFontSize: fit.fittedFontSize,
            },
          });
        }

        const fontSize = fit.fittedFontSize;
        const textWidth = font.widthOfTextAtSize(textToRender, fontSize);
        const textHeight = font.heightAtSize(fontSize);
        const baselineY =
          mapping.rect.y +
          (mapping.rect.height - textHeight) / 2 +
          textHeight * 0.2;

        let textX = mapping.rect.x;
        if (mapping.alignment === "center") {
          textX = mapping.rect.x + (mapping.rect.width - textWidth) / 2;
        } else if (mapping.alignment === "right") {
          textX = mapping.rect.x + mapping.rect.width - textWidth;
        }

        page.drawText(textToRender, {
          x: textX,
          y: baselineY,
          size: fontSize,
          font,
          color: textColor,
        });
      }

      // 4. Optional debug rect
      if (options.drawDebugBoxes) {
        page.drawRectangle({
          x: mapping.rect.x,
          y: mapping.rect.y,
          width: mapping.rect.width,
          height: mapping.rect.height,
          borderWidth: 0.5,
          borderColor: rgb(0, 0.4, 0.9),
          opacity: 0.2,
        });
      }
    }
  }

  if (hasAcroForms && options.flattenAcroForms !== false) {
    try {
      outDoc.getForm().flatten();
    } catch (err) {
      console.warn("AcroForm flattening notice:", err);
    }
  }

  const outputBytes = await outDoc.save({ useObjectStreams: false });
  return { pdfBytes: outputBytes, warnings };
}
