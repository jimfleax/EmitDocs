# PRD-CORE-06 — Approval and immutable snapshot

**Status:** Core MVP · P0.

## Objective

Freeze the exact reviewed template/mapping/import revision into an immutable, canonical snapshot for generation, so later changes cannot alter the batch that was approved.

## User stories

- I can review counts, warnings, selected template version, import revision and retention before approval.
- I can approve a defined revision and receive a stable snapshot ID.
- I know which invalid rows will be excluded.
- Changes after approval cannot rewrite that batch's data or design.

## Scope / exclusions

Approval summary, invalid-row policy, canonical serialization/digest, staged recipient copying, counts/checksum reconciliation, idempotent approval, conflict handling and immutability enforcement. No multi-person approvals, digital-signature system or email.

## End-to-end flow

1. UI loads current template/import/batch revisions from API.
2. It shows valid rows, invalid rows, duplicate warnings, overflow/glyph warnings, chosen retention, and expected output count. Invalid rows are excluded explicitly; valid rows may proceed without the entire batch being blocked by unrelated invalid rows.
3. User confirms approval.
4. API checks expected revisions/versions and owner authorization.
5. API creates snapshot in bounded stages: canonical ordered rows, template version/source checksum, mapping/style hash, effective values and overrides. Copy recipient records with deterministic recipient keys.
6. Reconcile copied row count and digest. Only then set snapshot `ready` and batch `approved`.
7. Duplicate approval request with same idempotency key returns the same logical snapshot. Stale revision returns conflict and requires review.

## Routes/components

`/app/batches/:batchId/approve`; `SnapshotDiffSummary`, `ApprovalCounts`, `TemplateVersionSummary`, `InvalidRowsNotice`, `RetentionPresetSelector`, `ApprovalConfirmation`, `ApprovalProgress`.

## API/data

`POST /api/batches/:id/approve` with expected import/template/batch revisions and idempotency key. Collections: `approvedSnapshots`, `approvedRecipients`, `batches`, `templateVersions`. Hash/canonical serializer version must be stable.

## States/errors

Not ready, unresolved hard errors, snapshot building, stale version conflict, digest/count mismatch, partial build recovery, approved. Interrupted builds are idempotently recovered; incomplete snapshot is never exposed as approved.

## Security/privacy

Server recalculates/validates effective values; client can't submit authoritative `isValid` flags. Access control at every record. Snapshot contains PII and must expire under job retention; do not log data payloads.

## Acceptance criteria

- AC1: Approval summary matches server-calculated counts.
- AC2: Snapshot stores source version/checksum, mapping hash, import revision and overrides/effective values.
- AC3: Identical canonical input produces stable digest.
- AC4: Approved data cannot be mutated through row/template endpoints.
- AC5: Interrupted snapshot build recovers without duplicate recipient records.
- AC6: Concurrent/stale approvals fail safely or return same idempotent result.
- AC7: Invalid rows are visibly excluded; valid rows can proceed.

## Tests

Canonical digest; interrupted 5k copy; duplicate/concurrent approval; template edited after approval; invalid row exclusion; owner boundary; snapshot expiry/deletion.

## Dependencies/gate

CORE-02 through CORE-05; MongoDB version/claim semantics. Do not start batch generation until snapshot consistency tests pass.

## Open details

Canonical serializer/hash version, snapshot copy chunk size and treatment of retained validation information for excluded invalid rows.
