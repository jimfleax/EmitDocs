/**
 * Converts a 0-indexed column number to Excel column letters (0 -> A, 25 -> Z, 26 -> AA).
 */
export function getColumnLetter(colIndex: number): string {
  let letter = "";
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export interface ExtractedGrid {
  rawHeaders: string[];
  disambiguatedHeaders: string[];
  rows: any[][];
  headerRowIndex: number;
  dataStartRowIndex: number;
}

/**
 * Inspects 2D grid of values, skips leading empty rows, selects first non-empty row as header,
 * and disambiguates blank and duplicate headers without merging or dropping columns.
 */
export function extractHeadersAndRows(grid: any[][]): ExtractedGrid {
  if (!grid || grid.length === 0) {
    return {
      rawHeaders: [],
      disambiguatedHeaders: [],
      rows: [],
      headerRowIndex: -1,
      dataStartRowIndex: -1,
    };
  }

  // Find first non-empty row
  let headerRowIndex = -1;
  for (let i = 0; i < grid.length; i++) {
    const row = grid[i];
    if (
      row &&
      row.some(
        (cell) =>
          cell !== null && cell !== undefined && String(cell).trim().length > 0,
      )
    ) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return {
      rawHeaders: [],
      disambiguatedHeaders: [],
      rows: [],
      headerRowIndex: -1,
      dataStartRowIndex: -1,
    };
  }

  const rawHeaderRow = grid[headerRowIndex];
  // Determine max columns across header and data rows
  let maxCols = rawHeaderRow.length;
  for (let r = headerRowIndex + 1; r < grid.length; r++) {
    if (grid[r] && grid[r].length > maxCols) {
      maxCols = grid[r].length;
    }
  }

  const rawHeaders: string[] = [];
  const disambiguatedHeaders: string[] = [];
  const seenHeaderCounts = new Map<string, number>();

  for (let colIdx = 0; colIdx < maxCols; colIdx++) {
    const rawVal = rawHeaderRow[colIdx];
    const headerStr =
      rawVal !== null && rawVal !== undefined ? String(rawVal).trim() : "";
    rawHeaders.push(headerStr);

    let effectiveHeader = headerStr;
    if (effectiveHeader.length === 0) {
      // Disambiguate blank header
      effectiveHeader = `Column_${getColumnLetter(colIdx)}`;
    }

    const currentCount = seenHeaderCounts.get(effectiveHeader) || 0;
    if (currentCount === 0) {
      seenHeaderCounts.set(effectiveHeader, 1);
      disambiguatedHeaders.push(effectiveHeader);
    } else {
      const nextCount = currentCount + 1;
      seenHeaderCounts.set(effectiveHeader, nextCount);
      disambiguatedHeaders.push(`${effectiveHeader}_${nextCount}`);
    }
  }

  // Extract subsequent data rows
  const rows: any[][] = [];
  for (let r = headerRowIndex + 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;
    // Skip completely empty row if desired or preserve?
    // Check if row has at least one populated value
    const hasData = row.some(
      (cell) =>
        cell !== null && cell !== undefined && String(cell).trim().length > 0,
    );
    if (!hasData) continue;

    // Pad row to maxCols
    const normalizedRow: any[] = [];
    for (let c = 0; c < maxCols; c++) {
      normalizedRow.push(row[c] !== undefined ? row[c] : null);
    }
    rows.push(normalizedRow);
  }

  return {
    rawHeaders,
    disambiguatedHeaders,
    rows,
    headerRowIndex,
    dataStartRowIndex: headerRowIndex + 1,
  };
}
