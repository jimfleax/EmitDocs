/**
 * @file duplicate-detector.ts
 * @description In-memory duplicate row detection using deterministic row fingerprinting.
 * @architecture Computes normalized key-value hash strings across rows, flags matching items with DUPLICATE_ROW warnings while strictly preserving all data records.
 * @agent_note Duplicate rows are never pruned or omitted from output, only annotated with warnings and line references.
 */

export interface RowWarning {
  field?: string;
  code: string;
  message: string;
  referenceRowNumbers?: number[];
}

export interface DetectDuplicateItem {
  sourceRowNumber: number;
  effectiveData: Record<string, any>;
  [key: string]: any;
}

export interface DuplicateCheckedRow<
  T extends DetectDuplicateItem = DetectDuplicateItem,
> {
  item: T;
  sourceRowNumber: number;
  effectiveData: Record<string, any>;
  isDuplicate: boolean;
  duplicateReferences: number[];
  warnings: RowWarning[];
}

/**
 * Computes deterministic fingerprint for an effectiveData object.
 * @desc Generates a sorted pipe-delimited string key from normalized record fields.
 * @param {Record<string, any>} data - Normalized field values map.
 * @returns {string} Deterministic fingerprint string.
 */
export function computeRowFingerprint(data: Record<string, any>): string {
  if (!data) return "";
  const sortedKeys = Object.keys(data).sort();
  const pairs = sortedKeys.map(
    (k) =>
      `${k}:${String(data[k] ?? "")
        .trim()
        .toLowerCase()}`,
  );
  return pairs.join("|");
}

/**
 * Scans rows and flags duplicates with DUPLICATE_ROW warning and referenceRowNumbers.
 * Strict Invariant (AC4): All duplicate rows are preserved, never dropped.
 * @desc Inspects an array of row items for duplicate content fingerprints and decorates duplicates with warning metadata.
 * @param {T[]} rows - List of draft row items.
 * @returns {(T & { isDuplicate: boolean; duplicateReferences: number[]; warnings: RowWarning[] })[]} Decorated rows with duplicate flags and source row references.
 */
export function detectDuplicatesAcrossRows<T extends DetectDuplicateItem>(
  rows: T[],
): (T & {
  isDuplicate: boolean;
  duplicateReferences: number[];
  warnings: RowWarning[];
})[] {
  const seenFingerprints = new Map<string, number[]>();

  return rows.map((row) => {
    const fingerprint = computeRowFingerprint(row.effectiveData);
    const existing = seenFingerprints.get(fingerprint);
    const warnings: RowWarning[] = (
      (row.warnings as RowWarning[]) || []
    ).filter((w) => w.code !== "DUPLICATE_ROW");

    if (fingerprint.length > 0 && existing && existing.length > 0) {
      const references = [...existing];
      existing.push(row.sourceRowNumber);

      return {
        ...row,
        isDuplicate: true,
        duplicateReferences: references,
        warnings: [
          ...warnings,
          {
            code: "DUPLICATE_ROW",
            message: `Duplicate record matches earlier row(s): ${references.join(", ")}`,
            referenceRowNumbers: references,
          },
        ],
      };
    } else {
      if (fingerprint.length > 0) {
        seenFingerprints.set(fingerprint, [row.sourceRowNumber]);
      }
      return {
        ...row,
        isDuplicate: false,
        duplicateReferences: [],
        warnings,
      };
    }
  });
}
