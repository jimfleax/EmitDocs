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

export function computeRowFingerprint(data: Record<string, any>): string {
  if (!data) return '';
  const sortedKeys = Object.keys(data).sort();
  const pairs = sortedKeys.map((k) => `${k}:${String(data[k] ?? '').trim().toLowerCase()}`);
  return pairs.join('|');
}

export function detectDuplicatesAcrossRows<T extends DetectDuplicateItem>(
  rows: T[]
): (T & { isDuplicate: boolean; duplicateReferences: number[]; warnings: RowWarning[] })[] {
  const seenFingerprints = new Map<string, number[]>();

  return rows.map((row) => {
    const fingerprint = computeRowFingerprint(row.effectiveData);
    const existing = seenFingerprints.get(fingerprint);
    const warnings: RowWarning[] = (row.warnings as RowWarning[]) || [];

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
