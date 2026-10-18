/**
 * @file claim-pdf-generator.ts
 * @description Server-side deterministic PDF overlay generator for certificate claim downloads.
 * @architecture Uses pdf-lib with fontkit to composite recipient field text onto authenticated template PDF buffers.
 * @agent_note Supports standard 14 PDF fonts and embedded Unicode TrueType fonts (Liberation Sans) to render special characters without throwing WinAnsi encoding errors.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, rgb, StandardFonts, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findFontFile(filename: string): Buffer | null {
  const candidates = [
    path.resolve(__dirname, `../../../web/public/standard_fonts/${filename}`),
    path.resolve(process.cwd(), `web/public/standard_fonts/${filename}`),
    path.resolve(process.cwd(), `../web/public/standard_fonts/${filename}`),
    path.resolve(process.cwd(), `public/standard_fonts/${filename}`),
    `/usr/share/fonts/liberation-sans-fonts/${filename}`,
    `/usr/share/fonts/truetype/liberation/${filename}`,
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate);
      }
    } catch {}
  }
  return null;
}

/**
 * @desc    Overlays field mappings and recipient data onto a base PDF document buffer.
 * @param   {Uint8Array | Buffer | null} basePdfBytes - Source PDF template bytes.
 * @param   {any[]} fieldMappings - Field coordinates, typography, and alignment rules.
 * @param   {Record<string, any>} [data={}] - Recipient effective data key-value pairs.
 * @returns {Promise<Buffer>} Serialized PDF buffer with overlaid values.
 * @throws  {Error} When base PDF template bytes are missing or invalid and placeholder generation is disallowed.
 */
export async function generateServerPdfWithOverlay(
  basePdfBytes: Uint8Array | Buffer | null,
  fieldMappings: any[],
  data: Record<string, any> = {}
): Promise<Buffer> {
  let doc: PDFDocument;

  const allowPlaceholder =
    process.env.ENABLE_PLACEHOLDER_PDF === 'true' ||
    process.env.ALLOW_PLACEHOLDER_PDF === 'true' ||
    process.env.ALLOW_CLAIM_PLACEHOLDER === 'true';

  if (basePdfBytes && basePdfBytes.length > 0) {
    try {
      doc = await PDFDocument.load(basePdfBytes, { ignoreEncryption: true });
    } catch {
      if (!allowPlaceholder) {
        throw new Error('Failed to parse base PDF template bytes');
      }
      doc = await PDFDocument.create();
      doc.addPage([612, 792]);
    }
  } else {
    if (!allowPlaceholder) {
      throw new Error('Base PDF template bytes are required for PDF generation');
    }
    doc = await PDFDocument.create();
    doc.addPage([612, 792]);
  }

  try {
    doc.registerFontkit(fontkit);
  } catch {
    // fontkit registration optional or already registered
  }

  let unicodeRegular: PDFFont | null = null;
  let unicodeBold: PDFFont | null = null;

  try {
    const regularBytes = findFontFile('LiberationSans-Regular.ttf');
    if (regularBytes) {
      unicodeRegular = await doc.embedFont(regularBytes);
    }
    const boldBytes = findFontFile('LiberationSans-Bold.ttf');
    if (boldBytes) {
      unicodeBold = await doc.embedFont(boldBytes);
    }
  } catch (err) {
    console.warn('Failed to embed Unicode font:', err);
  }

  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const times = await doc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const courier = await doc.embedFont(StandardFonts.Courier);
  const courierBold = await doc.embedFont(StandardFonts.CourierBold);

  const customFonts: Record<string, PDFFont> = {};
  for (const m of fieldMappings || []) {
    if (m.customFontBytes && !customFonts[m.id || m.key]) {
      try {
        const fontBytes = Buffer.from(m.customFontBytes, 'base64');
        customFonts[m.id || m.key] = await doc.embedFont(fontBytes);
      } catch (err) {
        console.warn('Failed to embed custom font bytes:', err);
      }
    }
  }

  const isRecipientNameField = (key?: string) => {
    if (!key) return false;
    const lower = key.toLowerCase();
    return lower.includes('name') || lower.includes('recipient');
  };

  const getFont = (family?: string, key?: string, mappingId?: string): PDFFont => {
    if (mappingId && customFonts[mappingId]) {
      return customFonts[mappingId];
    }
    if (key && customFonts[key]) {
      return customFonts[key];
    }

    const f = family?.toLowerCase() || 'helvetica';
    const isBold = f.includes('bold');

    // For recipient names or explicit unicode requests, prefer the Unicode-capable fontkit font
    if (unicodeRegular && (isRecipientNameField(key) || f.includes('liberation') || f.includes('unicode'))) {
      return isBold && unicodeBold ? unicodeBold : unicodeRegular;
    }

    if (f.includes('times')) {
      return isBold ? timesBold : times;
    }
    if (f.includes('courier')) {
      return isBold ? courierBold : courier;
    }

    // Default Helvetica fallback uses Unicode font if available so extended characters don't fail
    if (unicodeRegular && (f.includes('helvetica') || f === 'sans-serif' || !family)) {
      return isBold && unicodeBold ? unicodeBold : unicodeRegular;
    }

    return isBold ? helveticaBold : helvetica;
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
      const font = getFont(mapping.fontFamily, key, mapping.id);

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
