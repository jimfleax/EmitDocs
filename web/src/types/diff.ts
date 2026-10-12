export interface DiffSummary {
  addedCount: number;
  removedCount: number;
  changedCount: number;
  unchangedCount: number;
  conflictedCount: number;
  ambiguousCount: number;
}

export interface AddedDiffItem {
  newRowId: string;
  rowKey: string;
  sourceRowNumber: number;
  data: Record<string, any>;
}

export interface RemovedDiffItem {
  oldRowId: string;
  rowKey: string;
  sourceRowNumber: number;
  data: Record<string, any>;
}

export interface ChangedDiffItem {
  oldRowId: string;
  newRowId: string;
  rowKey: string;
  diffs: Record<string, { old: any; new: any }>;
}

export interface UnchangedDiffItem {
  oldRowId: string;
  newRowId: string;
  rowKey: string;
}

export interface ConflictedDiffItem {
  oldRowId: string;
  newRowId: string;
  rowKey: string;
  field: string;
  oldImported: any;
  newImported: any;
  override: any;
}

export interface AmbiguousDiffItem {
  id: string;
  revision: number;
  rowKey: string;
  sourceRowNumber: number;
  reason: 'COLLISION' | 'MISSING_KEY' | 'UNMAPPED_KEY';
  data: Record<string, any>;
}

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
