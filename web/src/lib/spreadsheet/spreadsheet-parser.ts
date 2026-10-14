/**
 * @file spreadsheet-parser.ts
 * @description In-memory spreadsheet parsing engine for CSV text and XLSX binary workbooks.
 * @architecture Uses PapaParse for CSV and SheetJS (XLSX) for Excel workbooks; normalizes worksheet grids into row records.
 * @agent_note Un-cached Excel formulas are flagged with FORMULA_CACHE_MISSING_TOKEN rather than throwing silent errors.
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { extractHeadersAndRows } from "./header-extractor.js";

export interface ParsedSpreadsheetResult {
  availableWorksheets: string[];
  selectedWorksheet: string;
  rawHeaders: string[];
  disambiguatedHeaders: string[];
  rows: Record<string, any>[];
  headerRowIndex: number;
  dataStartRowIndex: number;
  totalRowCount: number;
}

export const FORMULA_CACHE_MISSING_TOKEN = "__FORMULA_CACHE_MISSING__";

/**
 * Parses a CSV string or file content into structured headers and records.
 * @desc Parses raw CSV text into a structured grid and normalizes records by disambiguated header names.
 * @param {string} csvContent - Raw CSV text content.
 * @returns {ParsedSpreadsheetResult} Parsed result containing headers, data rows, and line counts.
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
      record[header] = val !== undefined && val !== null ? val : "";
    }
    rows.push(record);
  }

  return {
    availableWorksheets: ["Sheet1"],
    selectedWorksheet: "Sheet1",
    rawHeaders: extracted.rawHeaders,
    disambiguatedHeaders: extracted.disambiguatedHeaders,
    rows,
    headerRowIndex: extracted.headerRowIndex,
    dataStartRowIndex: extracted.dataStartRowIndex,
    totalRowCount: rows.length,
  };
}

/**
 * Parses an XLSX ArrayBuffer, inspecting formulas and cached values, extracting worksheet metadata.
 * @desc Decodes an Excel workbook buffer, extracts the selected worksheet, and converts cells into normalized record objects.
 * @param {ArrayBuffer} buffer - Binary ArrayBuffer of the XLSX file.
 * @param {Object} [options] - Parsing options.
 * @param {string} [options.worksheetName] - Optional worksheet name to parse (defaults to first worksheet).
 * @returns {ParsedSpreadsheetResult} Worksheet headers, records, and metadata.
 * @throws {Error} When no worksheets are found in the workbook.
 */
export function parseXlsxBuffer(
  buffer: ArrayBuffer,
  options?: { worksheetName?: string },
): ParsedSpreadsheetResult {
  const wb = XLSX.read(buffer, {
    type: "array",
    cellFormula: true,
  });

  const availableWorksheets = wb.SheetNames || [];
  if (availableWorksheets.length === 0) {
    throw new Error("No worksheets found in workbook");
  }

  const selectedWorksheet =
    options?.worksheetName &&
    availableWorksheets.includes(options.worksheetName)
      ? options.worksheetName
      : availableWorksheets[0];

  const ws = wb.Sheets[selectedWorksheet];
  if (!ws || !ws["!ref"]) {
    return {
      availableWorksheets,
      selectedWorksheet,
      rawHeaders: [],
      disambiguatedHeaders: [],
      rows: [],
      headerRowIndex: -1,
      dataStartRowIndex: -1,
      totalRowCount: 0,
    };
  }

  const range = XLSX.utils.decode_range(ws["!ref"]);
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
          cell.t === "e" ||
          (typeof cell.w === "string" && cell.w.startsWith("#"))
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
      record[header] = val !== undefined && val !== null ? val : "";
    }
    rows.push(record);
  }

  return {
    availableWorksheets,
    selectedWorksheet,
    rawHeaders: extracted.rawHeaders,
    disambiguatedHeaders: extracted.disambiguatedHeaders,
    rows,
    headerRowIndex: extracted.headerRowIndex,
    dataStartRowIndex: extracted.dataStartRowIndex,
    totalRowCount: rows.length,
  };
}
