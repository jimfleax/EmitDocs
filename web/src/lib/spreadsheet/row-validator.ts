import {
  normalizeDateValue,
  normalizeNumberValue,
  normalizeTextValue,
  type DateFormatHint,
} from './data-normalizer.js';

export interface FieldMappingItem {
  key: string;
  label?: string;
  type?: 'text' | 'date' | 'number' | string;
  required?: boolean;
}

export interface RowFieldError {
  field: string;
  code: string;
  message: string;
}

export interface ValidateDraftRowParams {
  rowData: Record<string, any>;
  sourceRowNumber: number;
  fieldMappings: FieldMappingItem[];
  columnMap: Record<string, string>;
  dateFormatHints?: Record<string, DateFormatHint>;
}

export interface ValidateDraftRowResult {
  status: 'valid' | 'invalid';
  effectiveData: Record<string, any>;
  errors: RowFieldError[];
}

/**
 * Validates a single spreadsheet row against template field definitions and selected column mappings.
 * Generates actionable error codes (REQUIRED_FIELD_MISSING, INVALID_DATE, AMBIGUOUS_DATE, etc.).
 */
export function validateDraftRow({
  rowData,
  fieldMappings,
  columnMap,
  dateFormatHints,
}: ValidateDraftRowParams): ValidateDraftRowResult {
  const errors: RowFieldError[] = [];
  const effectiveData: Record<string, any> = {};

  for (const field of fieldMappings) {
    const sheetColumn = columnMap[field.key];
    const fieldLabel = field.label || field.key;
    const isRequired = field.required !== false;

    if (!sheetColumn) {
      if (isRequired) {
        errors.push({
          field: field.key,
          code: 'UNMAPPED_FIELD',
          message: `Field "${fieldLabel}" is required but not mapped to any spreadsheet column.`,
        });
      }
      continue;
    }

    const rawVal = rowData[sheetColumn];
    const isBlank =
      rawVal === null ||
      rawVal === undefined ||
      (typeof rawVal === 'string' && rawVal.trim().length === 0);

    if (isBlank) {
      if (isRequired) {
        errors.push({
          field: field.key,
          code: 'REQUIRED_FIELD_MISSING',
          message: `Field "${fieldLabel}" is required but empty.`,
        });
      } else {
        effectiveData[field.key] = '';
      }
      continue;
    }

    // Normalization based on field type
    const fieldType = field.type || 'text';
    if (fieldType === 'date') {
      const hint = dateFormatHints?.[field.key];
      const norm = normalizeDateValue(rawVal, hint);
      if (norm.error) {
        errors.push({
          field: field.key,
          code: norm.error.code,
          message: `Field "${fieldLabel}": ${norm.error.message}`,
        });
      } else {
        effectiveData[field.key] = norm.value;
      }
    } else if (fieldType === 'number') {
      const norm = normalizeNumberValue(rawVal);
      if (norm.error) {
        errors.push({
          field: field.key,
          code: norm.error.code,
          message: `Field "${fieldLabel}": ${norm.error.message}`,
        });
      } else {
        effectiveData[field.key] = norm.value;
      }
    } else {
      const norm = normalizeTextValue(rawVal);
      if (norm.error) {
        errors.push({
          field: field.key,
          code: norm.error.code,
          message: `Field "${fieldLabel}": ${norm.error.message}`,
        });
      } else {
        effectiveData[field.key] = norm.value;
      }
    }
  }

  return {
    status: errors.length > 0 ? 'invalid' : 'valid',
    effectiveData,
    errors,
  };
}
