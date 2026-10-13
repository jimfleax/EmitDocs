import { FORMULA_CACHE_MISSING_TOKEN } from "./spreadsheet-parser.js";

export interface NormalizationResult<T = any> {
  value?: T;
  error?: {
    code: string;
    message: string;
  };
}

export type DateFormatHint = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

/**
 * Normalizes text value, detecting formula cache missing token.
 */
export function normalizeTextValue(val: any): NormalizationResult<string> {
  if (val === null || val === undefined) {
    return { value: "" };
  }
  if (val === FORMULA_CACHE_MISSING_TOKEN) {
    return {
      error: {
        code: "FORMULA_CACHE_MISSING",
        message:
          "Cell contains a formula without a cached value. Open spreadsheet in Excel/Sheets and re-save.",
      },
    };
  }
  return { value: String(val).trim() };
}

/**
 * Normalizes number value, stripping currency symbols, thousands separators, and detecting ambiguity.
 */
export function normalizeNumberValue(
  val: any,
  localeOrOptions?: string | { locale?: string },
): NormalizationResult<number> {
  if (val === null || val === undefined || val === "") {
    return { value: 0 };
  }
  if (val === FORMULA_CACHE_MISSING_TOKEN) {
    return {
      error: {
        code: "FORMULA_CACHE_MISSING",
        message:
          "Cell contains a formula without a cached value. Open spreadsheet in Excel/Sheets and re-save.",
      },
    };
  }
  if (typeof val === "number") {
    if (isNaN(val)) {
      return { error: { code: "INVALID_NUMBER", message: "Value is NaN" } };
    }
    return { value: val };
  }

  const str = String(val).trim();
  // Strip currency symbols and whitespace
  const cleaned = str.replace(/[$€₹£¥%\s]/g, "");

  if (cleaned.length === 0) {
    return { value: 0 };
  }

  // Count dots and commas
  const dotCount = (cleaned.match(/\./g) || []).length;
  const commaCount = (cleaned.match(/,/g) || []).length;

  // Multiple dots without commas (e.g. 1.250.50) -> ambiguous
  if (dotCount > 1 && commaCount === 0) {
    return {
      error: {
        code: "AMBIGUOUS_NUMBER",
        message: `Value "${str}" has multiple decimal points and is ambiguous.`,
      },
    };
  }

  // Multiple commas without dots (e.g. 1,250,50) -> ambiguous
  if (commaCount > 1 && dotCount === 0) {
    return {
      error: {
        code: "AMBIGUOUS_NUMBER",
        message: `Value "${str}" has ambiguous thousand separators.`,
      },
    };
  }

  const locale =
    typeof localeOrOptions === "string"
      ? localeOrOptions
      : localeOrOptions?.locale;
  const isEuLocale = Boolean(
    locale &&
    ["EU", "DE", "FR", "ES", "IT"].some((code) =>
      locale.toUpperCase().includes(code),
    ),
  );

  if (dotCount === 1 && commaCount === 0) {
    if (isEuLocale && /\.\d{3}$/.test(cleaned)) {
      return {
        error: {
          code: "AMBIGUOUS_NUMBER",
          message: `Value "${str}" is ambiguous between a thousand separator and decimal point for EU locale.`,
        },
      };
    }
  }

  let parseTarget = cleaned;
  if (dotCount === 1 && commaCount === 1) {
    const dotIndex = cleaned.indexOf(".");
    const commaIndex = cleaned.indexOf(",");
    if (commaIndex < dotIndex) {
      // US style 1,250.50
      parseTarget = cleaned.replace(/,/g, "");
    } else {
      // EU style 1.250,50
      parseTarget = cleaned.replace(/\./g, "").replace(/,/g, ".");
    }
  } else if (commaCount === 1 && dotCount === 0) {
    if (/,\d{3}$/.test(cleaned)) {
      return {
        error: {
          code: "AMBIGUOUS_NUMBER",
          message: `Value "${str}" has ambiguous thousand separators.`,
        },
      };
    }
    // e.g. 1250,50 -> 1250.50
    parseTarget = cleaned.replace(/,/g, ".");
  } else if (dotCount === 1 && commaCount > 1) {
    // US style 1,000,000.50
    parseTarget = cleaned.replace(/,/g, "");
  } else if (commaCount === 1 && dotCount > 1) {
    // EU style 1.000.000,50
    parseTarget = cleaned.replace(/\./g, "").replace(/,/g, ".");
  }

  const parsed = Number(parseTarget);
  if (isNaN(parsed)) {
    return {
      error: {
        code: "INVALID_NUMBER",
        message: `Value "${str}" cannot be parsed as a number.`,
      },
    };
  }

  return { value: parsed };
}

/**
 * Normalizes date value to ISO YYYY-MM-DD, detecting ambiguous locales (AC5).
 */
export function normalizeDateValue(
  val: any,
  formatHint?: DateFormatHint,
): NormalizationResult<string> {
  if (val === null || val === undefined || val === "") {
    return { value: "" };
  }
  if (val === FORMULA_CACHE_MISSING_TOKEN) {
    return {
      error: {
        code: "FORMULA_CACHE_MISSING",
        message:
          "Cell contains a formula without a cached value. Open spreadsheet in Excel/Sheets and re-save.",
      },
    };
  }

  // Handle Excel numeric serial dates (e.g. 45000)
  if (typeof val === "number") {
    // Excel epoch: Dec 30 1899
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const millis = Math.round(val * 86400000);
    const date = new Date(epoch.getTime() + millis);
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(date.getUTCDate()).padStart(2, "0");
      return { value: `${y}-${m}-${d}` };
    }
  }

  const str = String(val).trim();

  // If already ISO YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (isValidCalendarDate(y, m, d)) {
      return {
        value: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      };
    }
  }

  // Check with explicit formatHint if given
  if (formatHint === "DD/MM/YYYY") {
    const m = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (m) {
      const d = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10);
      const y = normalizeYear(parseInt(m[3], 10));
      if (isValidCalendarDate(y, mo, d)) {
        return {
          value: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        };
      }
    }
  } else if (formatHint === "MM/DD/YYYY") {
    const m = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (m) {
      const mo = parseInt(m[1], 10);
      const d = parseInt(m[2], 10);
      const y = normalizeYear(parseInt(m[3], 10));
      if (isValidCalendarDate(y, mo, d)) {
        return {
          value: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        };
      }
    }
  } else if (formatHint === "YYYY-MM-DD") {
    const m = str.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
    if (m) {
      const y = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10);
      const d = parseInt(m[3], 10);
      if (isValidCalendarDate(y, mo, d)) {
        return {
          value: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        };
      }
    }
  }

  // Delimited date pattern (e.g. 05/06/2026 or 25/05/2026)
  const slashMatch = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    const y = normalizeYear(parseInt(slashMatch[3], 10));

    // Both p1 and p2 <= 12
    if (p1 <= 12 && p2 <= 12) {
      if (p1 === p2 && isValidCalendarDate(y, p1, p2)) {
        // e.g. 05/05/2026 -> day and month are identical
        return {
          value: `${y}-${String(p1).padStart(2, "0")}-${String(p2).padStart(2, "0")}`,
        };
      }
      // Ambiguous date between DD/MM and MM/DD (AC5)
      return {
        error: {
          code: "AMBIGUOUS_DATE",
          message: `Date "${str}" is ambiguous between DD/MM and MM/DD. Specify column format or use ISO YYYY-MM-DD.`,
        },
      };
    }

    // p1 > 12 -> must be DD/MM/YYYY
    if (p1 > 12 && p2 <= 12) {
      if (isValidCalendarDate(y, p2, p1)) {
        return {
          value: `${y}-${String(p2).padStart(2, "0")}-${String(p1).padStart(2, "0")}`,
        };
      }
    }

    // p2 > 12 -> must be MM/DD/YYYY
    if (p2 > 12 && p1 <= 12) {
      if (isValidCalendarDate(y, p1, p2)) {
        return {
          value: `${y}-${String(p1).padStart(2, "0")}-${String(p2).padStart(2, "0")}`,
        };
      }
    }
  }

  return {
    error: {
      code: "INVALID_DATE",
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

function isValidCalendarDate(
  year: number,
  month: number,
  day: number,
): boolean {
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
