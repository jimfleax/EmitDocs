# PRD-CORE-04 — CSV/XLSX import, column mapping and row validation

**Status:** Core MVP · P0.

## Objective

Import structured record data, map sheet columns to template fields, normalize supported text/date/number values and validate each row independently. Invalid records remain visible/correctable; valid records can proceed.

## User stories

- I can import CSV or XLSX for the planned 500–5,000 row workload, subject to benchmarks.
- I can choose an XLSX worksheet and map columns.
- I can see missing fields, invalid dates/numbers, duplicate warnings and overflow signals.
- I can correct the current data or re-import an updated revision without silent merging.

## Scope / exclusions

CSV/XLSX file selection, first non-empty row as header, worksheet selector, column mapping, parser normalization, required-field validation, duplicate/header/formula warnings, chunk persistence and import finalization. No live Google Sheets sync, paste-only workflow, image fields, formula execution or universal locale guessing.

## End-to-end flow

1. User creates batch against selected template/version.
2. Select CSV/XLSX; file goes to private temporary storage if retained for re-import, while client checks provide immediate feedback.
3. For XLSX, user selects sheet; first non-empty row is header. Duplicate/blank headers are identified and disambiguated, never merged silently.
4. Suggest obvious mappings; require confirmation where ambiguous.
5. Parse/normalize text/date/number. Ambiguous locale values are flagged; formula cells without reliable cached values are not guessed/evaluated.
6. Validate each row and produce field errors/warnings. Duplicate rows/emails are warnings and preserved.
7. Persist records in bounded idempotent chunks; finalize counts/checksum and show valid/invalid summary.
8. Proceed to review while invalid rows remain visible/editable.

## Routes/components

`/app/batches/:batchId/import`. Components: `DataFilePicker`, `WorksheetSelector`, `ImportSchemaSummary`, `ColumnMappingTable`, `ImportValidationSummary`, `RowErrorTable`, `DuplicateWarning`, `ImportProgress`.

## API/data

Create batch, create import revision, issue upload URL, complete upload, submit bounded row chunks with `chunkId`, finalize import. Collections `batchImports`, `draftRows`, `batches`. Server recalculates authoritative status.

## States/errors

No file, parsing, choose worksheet, mapping, valid/invalid rows, duplicate header, ambiguous date, formula cache missing, import interrupted, repeated chunk, unsupported/corrupt/too-large file, row cap reached. A failed/incomplete import cannot be marked ready.

## Acceptance criteria

- AC1: CSV/XLSX follow header/worksheet rules.
- AC2: Mappings persist after refresh.
- AC3: Invalid rows have actionable field-level codes.
- AC4: Duplicates are warned and preserved.
- AC5: Ambiguous dates/numbers/formulas are not silently guessed.
- AC6: Retried row chunks do not create duplicate records.
- AC7: Finalization requires consistent chunk/row counts.
- AC8: Re-import creates a new revision.

## Tests

CSV quoting/newline, multi-sheet XLSX, empty leading rows, duplicate headers, empty file, invalid/date ambiguity, Unicode, missing formula cache, 500/1k/5k synthetic rows, interrupted/repeated chunks, byte/row caps and malformed input.

## Dependencies/gate

CORE-01/02/03, batch/import models, Zod and parser selection.

## Open details

Parser library, max bytes/sheets/rows, date formats/locales, required fields and chunk size require prototype measurements.
