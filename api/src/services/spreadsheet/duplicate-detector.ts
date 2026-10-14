/**
 * @file duplicate-detector.ts
 * @description In-memory duplicate record detection and fingerprinting for spreadsheet rows.
 * @architecture Computes deterministic row fingerprints by sorting key-value pairs of effective row data.
 *               Called during batch finalization and row override updates in `batch-intake.ts` to identify
 *               duplicate rows and attach non-blocking advisory warnings with reference row numbers.
 * @agent_note Fingerprints are case-insensitive and whitespace-trimmed. Duplicate detection does not block
 *             batch progression or generation; duplicates remain valid unless other field errors are present.
 */

/**
 * @interface RowWarning
 * @description Advisory warning attached to draft rows.
 * @property {string} [field] - Associated field name or undefined for row-level warnings.
 * @property {string} code - Machine-readable code ('DUPLICATE_ROW').
 * @property {string} message - User-facing warning message.
 * @property {number[]} [referenceRowNumbers] - Row numbers of preceding rows with matching fingerprint.
 */
export interface RowWarning {
  field?: string;
  code: string;
  message: string;
  referenceRowNumbers?: number[];
}

/**
 * @interface DetectDuplicateItem
 * @description Minimal contract required for duplicate detection processing.
 * @property {number} sourceRowNumber - Original spreadsheet row number.
 * @property {Record<string, any>} effectiveData - Dictionary of active field values.
 */
export interface DetectDuplicateItem {
  sourceRowNumber: number;
  effectiveData: Record<string, any>;
  [key: string]: any;
}

/**
 * @desc Computes a deterministic pipe-delimited fingerprint string from sorted key-value pairs.
 * @param {Record<string, any>} data - Data dictionary to fingerprint.
 * @returns {string} Lowercased, sorted fingerprint string.
 */
export function computeRowFingerprint(data: Record<string, any>): string {
  if (!data) return '';
  const sortedKeys = Object.keys(data).sort();
  const pairs = sortedKeys.map((k) => `${k}:${String(data[k] ?? '').trim().toLowerCase()}`);
  return pairs.join('|');
}

/**
 * @desc Scans an array of draft rows and flags duplicates that match earlier rows in the sequence.
 * @template T
 * @param {T[]} rows - List of draft rows ordered by source row number.
 * @returns {(T & { isDuplicate: boolean; duplicateReferences: number[]; warnings: RowWarning[] })[]} Enriched rows with duplicate flags and warnings.
 */
export function detectDuplicatesAcrossRows<T extends DetectDuplicateItem>(
  rows: T[]
): (T & { isDuplicate: boolean; duplicateReferences: number[]; warnings: RowWarning[] })[] {
  const seenFingerprints = new Map<string, number[]>();

  return rows.map((row) => {
    const fingerprint = computeRowFingerprint(row.effectiveData);
    const existing = seenFingerprints.get(fingerprint);
    const warnings: RowWarning[] = ((row.warnings as RowWarning[]) || []).filter(
      (w) => w.code !== 'DUPLICATE_ROW'
    );

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
            code: 'DUPLICATE_ROW',
            message: `Duplicate record matches earlier row(s): ${references.join(', ')}`,
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

