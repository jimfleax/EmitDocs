/**
 * @file claim-pdf-generator.ts
 * @description Server-side deterministic PDF overlay generator for certificate claim downloads.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

/**
 * Overlays field mappings and recipient data onto a base PDF document buffer.
 *
 * @param {Uint8Array | Buffer | null} basePdfBytes - Source PDF template bytes.
 * @param {any[]} fieldMappings - Field coordinates, typography, and alignment rules.
 * @param {Record<string, any>} data - Recipient effective data key-value pairs.
 * @returns {Promise<Buffer>} Serialized PDF buffer with overlaid values.
 */
export async function generateServerPdfWithOverlay(
  basePdfBytes: Uint8Array | Buffer | null,
  fieldMappings: any[],
  data: Record<string, any> = {}
): Promise<Buffer> {
  let doc: PDFDocument;

  if (basePdfBytes && basePdfBytes.length > 0) {
    try {
      doc = await PDFDocument.load(basePdfBytes, { ignoreEncryption: true });
    } catch {
      doc = await PDFDocument.create();
      doc.addPage([612, 792]);
    }
  } else {
    doc = await PDFDocument.create();
    doc.addPage([612, 792]);
  }

  try {
    doc.registerFontkit(fontkit);
  } catch {
    // fontkit registration optional or already registered
  }

  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const times = await doc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const courier = await doc.embedFont(StandardFonts.Courier);
  const courierBold = await doc.embedFont(StandardFonts.CourierBold);

  const getFont = (family?: string) => {
    const f = family?.toLowerCase() || 'helvetica';
    if (f.includes('times')) {
      return f.includes('bold') ? timesBold : times;
    }
    if (f.includes('courier')) {
      return f.includes('bold') ? courierBold : courier;
    }
    return f.includes('bold') ? helveticaBold : helvetica;
  };

  const pages = doc.getPages();

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    const mappingsForPage = (fieldMappings || []).filter((m: any) => m.pageIndex === pageIdx);

    for (const mapping of mappingsForPage) {
      const key = mapping.key;
      const rawVal = data[key] ?? mapping.sampleValue ?? '';
      let text = String(rawVal);
      if (!text) continue;

      if (mapping.textTransform === 'uppercase') text = text.toUpperCase();
      if (mapping.textTransform === 'lowercase') text = text.toLowerCase();

      const fontSize = Number(mapping.fontSize) || 16;
      const font = getFont(mapping.fontFamily);

      // Color parsing
      let textColor = rgb(0.1, 0.1, 0.1);
      if (mapping.color && /^#[0-9a-fA-F]{6}$/.test(mapping.color)) {
        const r = parseInt(mapping.color.slice(1, 3), 16) / 255;
        const g = parseInt(mapping.color.slice(3, 5), 16) / 255;
        const b = parseInt(mapping.color.slice(5, 7), 16) / 255;
        textColor = rgb(r, g, b);
      }

      const rect = mapping.rect || { x: 50, y: 50, width: 200, height: 30 };
      
      // Calculate text width for alignment
      let drawX = rect.x;
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      if (mapping.alignment === 'center') {
        drawX = rect.x + Math.max(0, (rect.width - textWidth) / 2);
      } else if (mapping.alignment === 'right') {
        drawX = rect.x + Math.max(0, rect.width - textWidth);
      }

      page.drawText(text, {
        x: drawX,
        y: rect.y,
        size: fontSize,
        font,
        color: textColor,
      });
    }
  }

  const outputBytes = await doc.save();
  return Buffer.from(outputBytes);
}
