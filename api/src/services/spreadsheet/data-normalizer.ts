/**
 * @file data-normalizer.ts
 * @description Spreadsheet cell data normalization algorithms for strings, numbers, currencies, and dates.
 * @architecture Used during chunk ingestion and batch finalization by `row-validator.ts`. Sanitizes dirty Excel/CSV
 *               data, strips currency symbols, identifies ambiguous date/number formats (e.g. EU vs US decimals),
 *               and flags missing formula caches.
 * @agent_note When modifying date parsing, ensure both Excel serial numbers (offset from 1899-12-30) and string representations
 *             (ISO, slash, hyphen) are supported, and produce canonical ISO `YYYY-MM-DD` strings.
 */

/**
 * Special sentinel token injected when an Excel formula cell has no precomputed cached calculation.
 */
export const FORMULA_CACHE_MISSING_TOKEN = '__FORMULA_CACHE_MISSING__';

/**
 * @interface NormalizationResult
 * @description Outcome of a cell normalization operation.
 * @template T - Normalized data type.
 * @property {T} [value] - Cleaned and parsed value if successful.
 * @property {Object} [error] - Error details if cell value is invalid or ambiguous.
 * @property {string} error.code - Machine-readable error code.
 * @property {string} error.message - User-facing description of why normalization failed.
 */
export interface NormalizationResult<T = any> {
  value?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * @typedef {('DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD')} DateFormatHint
 * @description Disambiguation hint providing expected date segment order.
 */
export type DateFormatHint = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

/**
 * @desc Normalizes arbitrary cell input into a trimmed string.
 * @param {*} val - Raw input value from spreadsheet cell.
 * @returns {NormalizationResult<string>} Normalized string or formula cache error.
 */
export function normalizeTextValue(val: any): NormalizationResult<string> {
  if (val === null || val === undefined) {
    return { value: '' };
  }
  if (val === FORMULA_CACHE_MISSING_TOKEN) {
    return {
      error: {
        code: 'FORMULA_CACHE_MISSING',
        message: 'Cell contains a formula without a cached value. Open spreadsheet in Excel/Sheets and re-save.',
      },
    };
  }
  return { value: String(val).trim() };
}

/**
 * @desc Parses and normalizes diverse numeric string representations, handling currency symbols,
 *       international decimal commas, and thousand separators.
 * @param {*} val - Cell value (string, number, or null/undefined).
 * @param {string | { locale?: string }} [localeOrOptions] - Optional locale string or option object.
 * @returns {NormalizationResult<number>} Parsed numeric result or ambiguity error.
 */
export function normalizeNumberValue(
  val: any,
  localeOrOptions?: string | { locale?: string }
): NormalizationResult<number> {
  if (val === null || val === undefined || val === '') {
    return { value: 0 };
  }
  if (val === FORMULA_CACHE_MISSING_TOKEN) {
    return {
      error: {
        code: 'FORMULA_CACHE_MISSING',
        message: 'Cell contains a formula without a cached value. Open spreadsheet in Excel/Sheets and re-save.',
      },
    };
  }
  if (typeof val === 'number') {
    if (isNaN(val)) {
      return { error: { code: 'INVALID_NUMBER', message: 'Value is NaN' } };
    }
    return { value: val };
  }

  const str = String(val).trim();
  const cleaned = str.replace(/[$€₹£¥%\s]/g, '');

  if (cleaned.length === 0) {
    return { value: 0 };
  }

  const dotCount = (cleaned.match(/\./g) || []).length;
  const commaCount = (cleaned.match(/,/g) || []).length;

  if (dotCount > 1 && commaCount === 0) {
    return {
      error: {
        code: 'AMBIGUOUS_NUMBER',
        message: `Value "${str}" has multiple decimal points and is ambiguous.`,
      },
    };
  }

  if (commaCount > 1 && dotCount === 0) {
    return {
      error: {
        code: 'AMBIGUOUS_NUMBER',
        message: `Value "${str}" has ambiguous thousand separators.`,
      },
    };
  }

  const locale = typeof localeOrOptions === 'string' ? localeOrOptions : localeOrOptions?.locale;
  const isEuLocale = Boolean(
    locale && ['EU', 'DE', 'FR', 'ES', 'IT'].some((code) => locale.toUpperCase().includes(code))
  );

  if (dotCount === 1 && commaCount === 0) {
    if (isEuLocale && /\.\d{3}$/.test(cleaned)) {
      return {
        error: {
          code: 'AMBIGUOUS_NUMBER',
          message: `Value "${str}" is ambiguous between a thousand separator and decimal point for EU locale.`,
        },
      };
    }
  }

  let parseTarget = cleaned;
  if (dotCount === 1 && commaCount === 1) {
    const dotIndex = cleaned.indexOf('.');
    const commaIndex = cleaned.indexOf(',');
    if (commaIndex < dotIndex) {
      parseTarget = cleaned.replace(/,/g, '');
    } else {
      parseTarget = cleaned.replace(/\./g, '').replace(/,/g, '.');
    }
  } else if (commaCount === 1 && dotCount === 0) {
    if (/,\d{3}$/.test(cleaned)) {
      return {
        error: {
          code: 'AMBIGUOUS_NUMBER',
          message: `Value "${str}" is ambiguous between a thousand separator and decimal comma.`,
        },
      };
    }
    parseTarget = cleaned.replace(/,/g, '.');
  } else if (dotCount === 1 && commaCount > 1) {
    parseTarget = cleaned.replace(/,/g, '');
  } else if (commaCount === 1 && dotCount > 1) {
    parseTarget = cleaned.replace(/\./g, '').replace(/,/g, '.');
  }

  const parsed = Number(parseTarget);
  if (isNaN(parsed)) {
    return {
      error: {
        code: 'INVALID_NUMBER',
        message: `Value "${str}" cannot be parsed as a number.`,
      },
    };
  }

  return { value: parsed };
}

/**
 * @desc Parses and normalizes date representations into canonical ISO `YYYY-MM-DD` strings.
 *       Supports Excel epoch serial offsets, ISO timestamps, and delimited formats with hints.
 * @param {*} val - Cell value (string, Excel serial number, or null/undefined).
 * @param {DateFormatHint} [formatHint] - Explicit hint to disambiguate DD/MM vs MM/DD.
 * @returns {NormalizationResult<string>} Canonical YYYY-MM-DD date string or validation error.
 */
export function normalizeDateValue(val: any, formatHint?: DateFormatHint): NormalizationResult<string> {
  if (val === null || val === undefined || val === '') {
    return { value: '' };
  }
  if (val === FORMULA_CACHE_MISSING_TOKEN) {
    return {
      error: {
        code: 'FORMULA_CACHE_MISSING',
        message: 'Cell contains a formula without a cached value. Open spreadsheet in Excel/Sheets and re-save.',
      },
    };
  }

  if (typeof val === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const millis = Math.round(val * 86400000);
    const date = new Date(epoch.getTime() + millis);
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return { value: `${y}-${m}-${d}` };
    }
  }

  const str = String(val).trim();

  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (isValidCalendarDate(y, m, d)) {
      return { value: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
    }
  }

  if (formatHint === 'DD/MM/YYYY') {
    const m = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (m) {
      const d = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10);
      const y = normalizeYear(parseInt(m[3], 10));
      if (isValidCalendarDate(y, mo, d)) {
        return { value: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
      }
    }
  } else if (formatHint === 'MM/DD/YYYY') {
    const m = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (m) {
      const mo = parseInt(m[1], 10);
      const d = parseInt(m[2], 10);
      const y = normalizeYear(parseInt(m[3], 10));
      if (isValidCalendarDate(y, mo, d)) {
        return { value: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
      }
    }
  } else if (formatHint === 'YYYY-MM-DD') {
    const m = str.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
    if (m) {
      const y = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10);
      const d = parseInt(m[3], 10);
      if (isValidCalendarDate(y, mo, d)) {
        return { value: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
      }
    }
  }

  const slashMatch = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    const y = normalizeYear(parseInt(slashMatch[3], 10));

    if (p1 <= 12 && p2 <= 12) {
      if (p1 === p2 && isValidCalendarDate(y, p1, p2)) {
        return { value: `${y}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}` };
      }
      return {
        error: {
          code: 'AMBIGUOUS_DATE',
          message: `Date "${str}" is ambiguous between DD/MM and MM/DD. Specify column format or use ISO YYYY-MM-DD.`,
        },
      };
    }

    if (p1 > 12 && p2 <= 12) {
      if (isValidCalendarDate(y, p2, p1)) {
        return { value: `${y}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}` };
      }
    }

    if (p2 > 12 && p1 <= 12) {
      if (isValidCalendarDate(y, p1, p2)) {
        return { value: `${y}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}` };
      }
    }
  }

  return {
    error: {
      code: 'INVALID_DATE',
      message: `Value "${str}" cannot be parsed as a calendar date.`,
    },
  };
}

function normalizeYear(year: number): number {
  if (year < 100) {
    return year + (year < 50 ? 2000 : 1900);
  }
  return year;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}
