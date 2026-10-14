/**
 * @file glyph-validator.ts
 * @description Validates text strings against WinAnsi (CP1252) character sets supported by standard 14 PDF fonts.
 * @architecture Pre-flight glyph safety check for PDF rendering to detect characters requiring fallback or custom fonts.
 * @agent_note Used by PDF preview engine and fit-then-flag logic to flag un-encodable characters.
 */

export interface GlyphValidationResult {
  valid: boolean;
  missingGlyphs: string[];
  unsupportedChars: string[];
}

// WinAnsi (CP1252) character set supported by pdf-lib standard 14 fonts
const WIN_ANSI_EXTRA_CHARS = new Set([
  "\u20AC", // Euro sign
  "\u201A", // Single low-9 quotation mark
  "\u0192", // Latin small letter f with hook
  "\u201E", // Double low-9 quotation mark
  "\u2026", // Horizontal ellipsis
  "\u2020", // Dagger
  "\u2021", // Double dagger
  "\u02C6", // Modifier letter circumflex accent
  "\u2030", // Per mille sign
  "\u0160", // Latin capital letter S with caron
  "\u2039", // Single left-pointing angle quotation mark
  "\u0152", // Latin capital ligature OE
  "\u017D", // Latin capital letter Z with caron
  "\u2018", // Left single quotation mark
  "\u2019", // Right single quotation mark
  "\u201C", // Left double quotation mark
  "\u201D", // Right double quotation mark
  "\u2022", // Bullet
  "\u2013", // En dash
  "\u2014", // Em dash
  "\u02DC", // Small tilde
  "\u2122", // Trade mark sign
  "\u0161", // Latin small letter s with caron
  "\u203A", // Single right-pointing angle quotation mark
  "\u0153", // Latin small ligature oe
  "\u017E", // Latin small letter z with caron
  "\u0178", // Latin capital letter Y with diaeresis
]);

/**
 * @desc Checks if a string contains characters unsupported by standard PDF WinAnsi fonts.
 * @param {string} text - The input string to inspect.
 * @returns {GlyphValidationResult} Validation result including list of missing and unsupported glyphs.
 */
export function validateStandardFontGlyphs(
  text: string,
): GlyphValidationResult {
  if (!text) {
    return { valid: true, missingGlyphs: [], unsupportedChars: [] };
  }

  const missingSet = new Set<string>();

  for (const char of Array.from(text)) {
    const codePoint = char.codePointAt(0) ?? 0;

    // ASCII printable (32 to 126) + newline, tab, carriage return
    if (
      (codePoint >= 32 && codePoint <= 126) ||
      codePoint === 10 ||
      codePoint === 13 ||
      codePoint === 9
    ) {
      continue;
    }

    // Latin-1 Supplement (160 to 255)
    if (codePoint >= 160 && codePoint <= 255) {
      continue;
    }

    // CP1252 extended characters
    if (WIN_ANSI_EXTRA_CHARS.has(char)) {
      continue;
    }

    // Not encodable in standard WinAnsi fonts
    missingSet.add(char);
  }

  const missingGlyphs = Array.from(missingSet);

  return {
    valid: missingGlyphs.length === 0,
    missingGlyphs,
    unsupportedChars: missingGlyphs,
  };
}
