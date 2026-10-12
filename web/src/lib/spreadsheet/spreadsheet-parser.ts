import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { extractHeadersAndRows } from './header-extractor.js';

export interface ParsedSpreadsheetResult {
  availableWorksheets: string[];
  selectedWorksheet: string;
  rawHeaders: string[];
  disambiguatedHeaders: string[];
  rows: Record<string, any>[];
  dataStartRowIndex: number;
  totalRowCount: number;
}

export const FORMULA_CACHE_MISSING_TOKEN = '__FORMULA_CACHE_MISSING__';

/**
 * Parses a CSV string or file content into structured headers and records.
 */
export function parseCsvString(csvContent: string): ParsedSpreadsheetResult {
  const parsed = Papa.parse<any[]>(csvContent, {
    skipEmptyLines: false,
  });

  const grid = parsed.data || [];
  const extracted = extractHeadersAndRows(grid);

  const rows: Record<string, any>[] = [];
  for (let r = 0; r < extracted.rows.length; r++) {
    const rawRow = extracted.rows[r];
    const record: Record<string, any> = {};
    for (let c = 0; c < extracted.disambiguatedHeaders.length; c++) {
      const header = extracted.disambiguatedHeaders[c];
      const val = rawRow[c];
      record[header] = val !== undefined && val !== null ? val : '';
    }
    rows.push(record);
  }

  return {
    availableWorksheets: ['Sheet1'],
    selectedWorksheet: 'Sheet1',
    rawHeaders: extracted.rawHeaders,
    disambiguatedHeaders: extracted.disambiguatedHeaders,
    rows,
    dataStartRowIndex: extracted.dataStartRowIndex,
    totalRowCount: rows.length,
  };
}

/**
 * Parses an XLSX ArrayBuffer, inspecting formulas and cached values, extracting worksheet metadata.
 */
export function parseXlsxBuffer(
  buffer: ArrayBuffer,
  options?: { worksheetName?: string }
): ParsedSpreadsheetResult {
  const wb = XLSX.read(buffer, {
    type: 'array',
    cellFormula: true,
  });

  const availableWorksheets = wb.SheetNames || [];
  if (availableWorksheets.length === 0) {
    throw new Error('No worksheets found in workbook');
  }

  const selectedWorksheet =
    options?.worksheetName && availableWorksheets.includes(options.worksheetName)
      ? options.worksheetName
      : availableWorksheets[0];

  const ws = wb.Sheets[selectedWorksheet];
  if (!ws || !ws['!ref']) {
    return {
      availableWorksheets,
      selectedWorksheet,
      rawHeaders: [],
      disambiguatedHeaders: [],
      rows: [],
      dataStartRowIndex: -1,
      totalRowCount: 0,
    };
  }

  const range = XLSX.utils.decode_range(ws['!ref']);
  const grid: any[][] = [];

  for (let R = range.s.r; R <= range.e.r; ++R) {
    const row: any[] = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[cellRef];

      if (!cell) {
        row.push(null);
        continue;
      }

      // Check formula presence & cached value integrity (AC5)
      if (cell.f) {
        if (
          cell.v === undefined ||
          cell.v === null ||
          cell.t === 'e' ||
          (typeof cell.w === 'string' && cell.w.startsWith('#'))
        ) {
          row.push(FORMULA_CACHE_MISSING_TOKEN);
        } else {
          row.push(cell.v);
        }
      } else {
        row.push(cell.v !== undefined ? cell.v : null);
      }
    }
    grid.push(row);
  }

  const extracted = extractHeadersAndRows(grid);

  const rows: Record<string, any>[] = [];
  for (let r = 0; r < extracted.rows.length; r++) {
    const rawRow = extracted.rows[r];
    const record: Record<string, any> = {};
    for (let c = 0; c < extracted.disambiguatedHeaders.length; c++) {
      const header = extracted.disambiguatedHeaders[c];
      const val = rawRow[c];
      record[header] = val !== undefined && val !== null ? val : '';
    }
    rows.push(record);
  }

  return {
    availableWorksheets,
    selectedWorksheet,
    rawHeaders: extracted.rawHeaders,
    disambiguatedHeaders: extracted.disambiguatedHeaders,
    rows,
    dataStartRowIndex: extracted.dataStartRowIndex,
    totalRowCount: rows.length,
  };
}
