/**
 * @file row-validator.ts
 * @description Schema validation engine evaluating ingested spreadsheet rows against template field mappings.
 * @architecture Enforces required field constraints, invokes data-normalizer routines for text/number/date
 *               types, and constructs normalized `effectiveData` alongside structured `RowFieldError` items.
 *               Called during chunk ingestion, finalization re-validation, and inline cell editing.
 * @agent_note A row is marked with `status: 'invalid'` if one or more errors are generated. Missing required
 *             fields or ambiguous dates/numbers produce blocking errors, whereas empty optional fields default to ''.
 */

import {
  normalizeDateValue,
  normalizeNumberValue,
  normalizeTextValue,
  DateFormatHint,
} from './data-normalizer.js';

/**
 * @interface FieldMappingItem
 * @description Minimal contract required for a template field definition.
 * @property {string} key - Field identifier.
 * @property {string} [label] - Optional display label.
 * @property {'text' | 'date' | 'number' | string} [type] - Expected field data type.
 * @property {boolean} [required] - Whether field must be populated.
 */
export interface FieldMappingItem {
  key: string;
  label?: string;
  type?: 'text' | 'date' | 'number' | string;
  required?: boolean;
}

/**
 * @interface RowFieldError
 * @description Representation of a field-level error blocking row generation.
 * @property {string} field - Target template field key.
 * @property {string} code - Error code identifier.
 * @property {string} message - Descriptive error explanation.
 */
export interface RowFieldError {
  field: string;
  code: string;
  message: string;
}

/**
 * @interface ValidateDraftRowParams
 * @description Input parameters supplied to the row validator.
 * @property {Record<string, any>} rowData - Raw or combined key-value data for the row.
 * @property {number} sourceRowNumber - Original 1-based row index.
 * @property {FieldMappingItem[]} fieldMappings - Field definitions from active TemplateVersion.
 * @property {Record<string, string>} columnMap - Mapping from template field keys to spreadsheet column headers.
 * @property {Record<string, DateFormatHint>} [dateFormatHints] - Per-field date formatting hints.
 */
export interface ValidateDraftRowParams {
  rowData: Record<string, any>;
  sourceRowNumber: number;
  fieldMappings: FieldMappingItem[];
  columnMap: Record<string, string>;
  dateFormatHints?: Record<string, DateFormatHint>;
}

/**
 * @interface ValidateDraftRowResult
 * @description Outcome of row validation.
 * @property {'valid' | 'invalid'} status - Overall validity status.
 * @property {Record<string, any>} effectiveData - Normalized field values ready for document generation.
 * @property {RowFieldError[]} errors - List of blocking validation errors.
 */
export interface ValidateDraftRowResult {
  status: 'valid' | 'invalid';
  effectiveData: Record<string, any>;
  errors: RowFieldError[];
}

/**
 * @desc Validates a single draft row against template field mappings and column headers.
 * @param {ValidateDraftRowParams} params - Validation context and input data.
 * @returns {ValidateDraftRowResult} Normalized effective data and validation errors.
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
