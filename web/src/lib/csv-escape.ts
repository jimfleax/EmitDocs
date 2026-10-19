/**
 * @file csv-escape.ts
 * @description Helper for safely escaping CSV cells with quotes doubling and formula injection protection.
 */

/**
 * Escapes a CSV cell value, doubling embedded quotes and defending against spreadsheet formula injection on non-token fields.
 * Raw tokens are preserved without leading apostrophes so they remain usable in claims.
 *
 * @param {string | undefined | null} value - Raw string or cell value.
 * @param {boolean} isToken - True if this cell represents a claim token.
 * @returns {string} Quoted, safely escaped CSV cell string.
 */
export function escapeCsvCell(
  value: string | undefined | null,
  isToken = false,
): string {
  const str = value == null ? "" : String(value);
  const sanitized = !isToken && /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${sanitized.replace(/"/g, '""')}"`;
}
