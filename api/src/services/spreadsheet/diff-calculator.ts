/**
 * @file diff-calculator.ts
 * @description 4-way re-import diff engine comparing prior batch revisions against prospective uploads.
 * @architecture Categorizes differences between an existing revision's rows and a newly uploaded spreadsheet
 *               into six mutually exclusive sets: added, removed, changed, unchanged, conflicted (where incoming data
 *               differs from both old imported data AND manual user overrides), and ambiguous (missing or duplicate reconciliation keys).
 * @agent_note Reconciliation relies on a specified `reconciliationKey` (e.g. studentId, email, or row identifier).
 *             Conflicted items require explicit user resolution before applying overrides forward.
 */

/**
 * @interface DiffSummary
 * @description Statistical counter breakdown of re-import diff results.
 * @property {number} addedCount - Count of new rows present only in the new import.
 * @property {number} removedCount - Count of old rows absent from the new import.
 * @property {number} changedCount - Count of matching rows where source values have changed cleanly.
 * @property {number} unchangedCount - Count of matching rows with identical data.
 * @property {number} conflictedCount - Count of rows with 3-way conflicts between old data, user overrides, and new import.
 * @property {number} ambiguousCount - Count of rows with missing or duplicate reconciliation keys.
 */
export interface DiffSummary {
  addedCount: number;
  removedCount: number;
  changedCount: number;
  unchangedCount: number;
  conflictedCount: number;
  ambiguousCount: number;
}

/**
 * @interface AddedDiffItem
 * @description New row found only in the incoming revision.
 */
export interface AddedDiffItem {
  newRowId: string;
  rowKey: string;
  sourceRowNumber: number;
  data: Record<string, any>;
}

/**
 * @interface RemovedDiffItem
 * @description Existing row missing from the incoming revision.
 */
export interface RemovedDiffItem {
  oldRowId: string;
  rowKey: string;
  sourceRowNumber: number;
  data: Record<string, any>;
}

/**
 * @interface ChangedDiffItem
 * @description Existing row where cell data changed between revisions without conflicting with user overrides.
 */
export interface ChangedDiffItem {
  oldRowId: string;
  newRowId: string;
  rowKey: string;
  diffs: Record<string, { old: any; new: any }>;
}

/**
 * @interface UnchangedDiffItem
 * @description Row with identical imported and effective values across revisions.
 */
export interface UnchangedDiffItem {
  oldRowId: string;
  newRowId: string;
  rowKey: string;
}

/**
 * @interface ConflictedDiffItem
 * @description 3-way conflict where a field was manually edited by a user and also changed in the new spreadsheet.
 */
export interface ConflictedDiffItem {
  oldRowId: string;
  newRowId: string;
  rowKey: string;
  field: string;
  oldImported: any;
  newImported: any;
  override: any;
}

/**
 * @interface AmbiguousDiffItem
 * @description Row that cannot be uniquely matched due to duplicate or missing reconciliation key values.
 */
export interface AmbiguousDiffItem {
  id: string;
  revision: number;
  rowKey: string;
  sourceRowNumber: number;
  reason: 'COLLISION' | 'MISSING_KEY' | 'UNMAPPED_KEY';
  data: Record<string, any>;
}

/**
 * @interface ReimportDiffResult
 * @description Complete classified diff output between two batch revisions.
 */
export interface ReimportDiffResult {
  summary: DiffSummary;
  reconciliationKey: string;
  added: AddedDiffItem[];
  removed: RemovedDiffItem[];
  changed: ChangedDiffItem[];
  unchanged: UnchangedDiffItem[];
  conflicted: ConflictedDiffItem[];
  ambiguous: AmbiguousDiffItem[];
}

/**
 * @interface CalculateDiffOptions
 * @description Optional column mapping parameters for old and new revisions.
 */
export interface CalculateDiffOptions {
  oldColumnMap?: Record<string, string>;
  newColumnMap?: Record<string, string>;
}

function extractKey(
  row: any,
  keyField: string,
  columnMap?: Record<string, string>
): string | null {
  let val: any = undefined;

  if (row.effectiveData && row.effectiveData[keyField] !== undefined) {
    val = row.effectiveData[keyField];
  } else if (
    columnMap &&
    columnMap[keyField] &&
    row.importedData &&
    row.importedData[columnMap[keyField]] !== undefined
  ) {
    val = row.importedData[columnMap[keyField]];
  } else if (row.importedData && row.importedData[keyField] !== undefined) {
    val = row.importedData[keyField];
  }

  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  return str.length === 0 ? null : str;
}

function getImportedVal(row: any, fieldKey: string, columnMap?: Record<string, string>): any {
  if (
    columnMap &&
    columnMap[fieldKey] &&
    row.importedData &&
    row.importedData[columnMap[fieldKey]] !== undefined
  ) {
    return row.importedData[columnMap[fieldKey]];
  }
  if (row.importedData && row.importedData[fieldKey] !== undefined) {
    return row.importedData[fieldKey];
  }
  if (row.effectiveData && row.effectiveData[fieldKey] !== undefined) {
    return row.effectiveData[fieldKey];
  }
  return undefined;
}

function isDiff(a: any, b: any): boolean {
  if (a === b) return false;
  const aBlank = a === null || a === undefined || (typeof a === 'string' && a.trim() === '');
  const bBlank = b === null || b === undefined || (typeof b === 'string' && b.trim() === '');
  if (aBlank && bBlank) return false;
  return String(a ?? '').trim() !== String(b ?? '').trim();
}

/**
 * @desc Compares draft rows between the current revision and a prospective import revision,
 *       computing a 4-way diff classification using a reconciliation key.
 * @param {any[]} oldRows - List of draft rows from the currently active revision.
 * @param {any[]} newRows - List of draft rows from the prospective new import revision.
 * @param {string} reconciliationKey - Target field key used to pair rows (e.g. 'studentId', 'email').
 * @param {any[]} [fieldMappings=[]] - Active template field mappings used for attribute comparison.
 * @param {CalculateDiffOptions} [options] - Header column mapping dictionaries for old and new revisions.
 * @returns {ReimportDiffResult} Structured reconciliation summary and lists of categorized rows.
 */
export function calculateReimportDiff(
  oldRows: any[],
  newRows: any[],
  reconciliationKey: string,
  fieldMappings: any[] = [],
  options?: CalculateDiffOptions
): ReimportDiffResult {
  const oldColumnMap = options?.oldColumnMap || {};
  const newColumnMap = options?.newColumnMap || {};

  const oldMissing: any[] = [];
  const oldKeyGroups = new Map<string, any[]>();
  for (const r of oldRows) {
    const k = extractKey(r, reconciliationKey, oldColumnMap);
    if (!k) {
      oldMissing.push(r);
    } else {
      const g = oldKeyGroups.get(k) || [];
      g.push(r);
      oldKeyGroups.set(k, g);
    }
  }

  const newMissing: any[] = [];
  const newKeyGroups = new Map<string, any[]>();
  for (const r of newRows) {
    const k = extractKey(r, reconciliationKey, newColumnMap);
    if (!k) {
      newMissing.push(r);
    } else {
      const g = newKeyGroups.get(k) || [];
      g.push(r);
      newKeyGroups.set(k, g);
    }
  }

  const ambiguous: AmbiguousDiffItem[] = [];

  for (const r of oldMissing) {
    ambiguous.push({
      id: r._id?.toString() || r.id || r.rowKey,
      revision: r.revision,
      rowKey: r.rowKey,
      sourceRowNumber: r.sourceRowNumber,
      reason: 'MISSING_KEY',
      data: r.effectiveData || r.importedData || {},
    });
  }
  for (const r of newMissing) {
    ambiguous.push({
      id: r._id?.toString() || r.id || r.rowKey,
      revision: r.revision,
      rowKey: r.rowKey,
      sourceRowNumber: r.sourceRowNumber,
      reason: 'MISSING_KEY',
      data: r.effectiveData || r.importedData || {},
    });
  }

  const collidingKeys = new Set<string>();
  for (const [k, rows] of oldKeyGroups.entries()) {
    if (rows.length > 1) collidingKeys.add(k);
  }
  for (const [k, rows] of newKeyGroups.entries()) {
    if (rows.length > 1) collidingKeys.add(k);
  }

  for (const k of collidingKeys) {
    const oRows = oldKeyGroups.get(k) || [];
    for (const r of oRows) {
      ambiguous.push({
        id: r._id?.toString() || r.id || r.rowKey,
        revision: r.revision,
        rowKey: r.rowKey,
        sourceRowNumber: r.sourceRowNumber,
        reason: 'COLLISION',
        data: r.effectiveData || r.importedData || {},
      });
    }
    const nRows = newKeyGroups.get(k) || [];
    for (const r of nRows) {
      ambiguous.push({
        id: r._id?.toString() || r.id || r.rowKey,
        revision: r.revision,
        rowKey: r.rowKey,
        sourceRowNumber: r.sourceRowNumber,
        reason: 'COLLISION',
        data: r.effectiveData || r.importedData || {},
      });
    }
  }

  const validOldMap = new Map<string, any>();
  for (const [k, rows] of oldKeyGroups.entries()) {
    if (!collidingKeys.has(k) && rows.length === 1) {
      validOldMap.set(k, rows[0]);
    }
  }

  const validNewMap = new Map<string, any>();
  for (const [k, rows] of newKeyGroups.entries()) {
    if (!collidingKeys.has(k) && rows.length === 1) {
      validNewMap.set(k, rows[0]);
    }
  }

  const added: AddedDiffItem[] = [];
  const removed: RemovedDiffItem[] = [];
  const changed: ChangedDiffItem[] = [];
  const unchanged: UnchangedDiffItem[] = [];
  const conflicted: ConflictedDiffItem[] = [];

  for (const [k, oldRow] of validOldMap.entries()) {
    if (!validNewMap.has(k)) {
      removed.push({
        oldRowId: oldRow._id?.toString() || oldRow.id,
        rowKey: oldRow.rowKey,
        sourceRowNumber: oldRow.sourceRowNumber,
        data: oldRow.effectiveData || oldRow.importedData || {},
      });
    }
  }

  for (const [k, newRow] of validNewMap.entries()) {
    if (!validOldMap.has(k)) {
      added.push({
        newRowId: newRow._id?.toString() || newRow.id,
        rowKey: newRow.rowKey,
        sourceRowNumber: newRow.sourceRowNumber,
        data: newRow.effectiveData || newRow.importedData || {},
      });
    }
  }

  const compareKeys = new Set<string>();
  for (const fm of fieldMappings) {
    if (fm.key) compareKeys.add(fm.key);
  }

  for (const [k, oldRow] of validOldMap.entries()) {
    const newRow = validNewMap.get(k);
    if (!newRow) continue;

    const allKeys = new Set<string>(compareKeys);
    if (oldRow.overrides) {
      for (const f of Object.keys(oldRow.overrides)) allKeys.add(f);
    }
    if (oldRow.importedData) {
      for (const f of Object.keys(oldRow.importedData)) allKeys.add(f);
    }
    if (newRow.importedData) {
      for (const f of Object.keys(newRow.importedData)) allKeys.add(f);
    }

    const pairConflicts: ConflictedDiffItem[] = [];
    const pairDiffs: Record<string, { old: any; new: any }> = {};

    for (const field of allKeys) {
      const oldImported = getImportedVal(oldRow, field, oldColumnMap);
      const newImported = getImportedVal(newRow, field, newColumnMap);
      const hasOverride = oldRow.overrides && oldRow.overrides[field] !== undefined;

      if (hasOverride) {
        const override = oldRow.overrides[field];
        if (isDiff(newImported, oldImported) && isDiff(newImported, override)) {
          pairConflicts.push({
            oldRowId: oldRow._id?.toString() || oldRow.id,
            newRowId: newRow._id?.toString() || newRow.id,
            rowKey: newRow.rowKey,
            field,
            oldImported,
            newImported,
            override,
          });
        }
      }

      const oldVal =
        oldRow.effectiveData?.[field] !== undefined ? oldRow.effectiveData[field] : oldImported;
      const newVal =
        newRow.effectiveData?.[field] !== undefined ? newRow.effectiveData[field] : newImported;

      if (isDiff(newImported, oldImported)) {
        pairDiffs[field] = { old: oldVal, new: newVal };
      }
    }

    if (pairConflicts.length > 0) {
      conflicted.push(...pairConflicts);
    } else if (Object.keys(pairDiffs).length > 0) {
      changed.push({
        oldRowId: oldRow._id?.toString() || oldRow.id,
        newRowId: newRow._id?.toString() || newRow.id,
        rowKey: newRow.rowKey,
        diffs: pairDiffs,
      });
    } else {
      unchanged.push({
        oldRowId: oldRow._id?.toString() || oldRow.id,
        newRowId: newRow._id?.toString() || newRow.id,
        rowKey: newRow.rowKey,
      });
    }
  }

  const summary: DiffSummary = {
    addedCount: added.length,
    removedCount: removed.length,
    changedCount: changed.length,
    unchangedCount: unchanged.length,
    conflictedCount: conflicted.length,
    ambiguousCount: ambiguous.length,
  };

  return {
    summary,
    reconciliationKey,
    added,
    removed,
    changed,
    unchanged,
    conflicted,
    ambiguous,
  };
}
