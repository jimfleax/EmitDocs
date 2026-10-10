# PRD-CORE-09 — Retention, cleanup ledger and account deletion

**Status:** Core MVP · P0 before real personal data.

## Objective

Make data expiry and deletion predictable, visible and retryable. Job data has strict 24-hour/7-day/30-day presets (7-day default); saved template sources remain until the template is deleted. Daily direct-delete sweep retries cleanup failures.

## User stories

- I choose a retention preset and see the deadline.
- After expiry, I cannot retrieve job PII or obtain new download URLs.
- Cleanup failures are recorded and retried, not silently lost.
- I can explicitly delete my account; sessions are revoked immediately and owned resources are scheduled for deletion.

## Scope / exclusions

Retention setting, expiry timestamps, abandoned draft timer, template lifetime, cleanup tasks/leases/retry, daily sweep, R2 lifecycle backstop, aggregate post-expiry history, account-delete confirmation/session revocation/cascading cleanup. No promise of instantaneous physical erasure, no retention beyond 30 days, no legal hold or named compliance certification.

## End-to-end flow

1. Job uses allowed preset 24h/7d/30d; default 7d. Abandoned draft timer starts at creation; output/job-data timer starts when generation reaches terminal state.
2. UI displays deadline and explains physical deletion can lag. Deadline persists and does not slide when reopened.
3. At logical expiry, deny new downloads, mark data expired, hide PII in product UI and create cleanup tasks for R2 objects plus database PII.
4. Daily sweep leases due tasks, requests direct R2 deletes, verifies absent where possible, records success/error and schedules bounded retry. R2 lifecycle is only backstop.
5. After expiry preserve only aggregate counts/timestamps, not recipient-level identity/status/object key.
6. Template source persists until explicit template deletion. Delete revokes future access and schedules all version objects after resolving active references safely.
7. Account deletion requires explicit confirmation; immediately revoke sessions, mark `deletion_pending`, stop new work and schedule deletion of owned templates/jobs/outputs. Retain only non-identifying cleanup evidence.

## Routes/components

`/app/settings/retention`, `/app/settings/account`, template-delete and results screens. `RetentionPresetSelector`, `ExpiryCountdown/Label`, `ExpiredOutputNotice`, `CleanupStatusNotice`, `DeleteAccountDialog`, `DeletionPendingNotice`.

## API/data

`PATCH /api/settings/retention`; `DELETE /api/account`; `DELETE /api/templates/:id`. `cleanupTasks` has resource link, opaque object key, due date, attempt count/status/lease/error/deleted confirmation. MongoDB TTL is not used as sole R2 cleanup mechanism.

## States/errors

Scheduled, due, deleting, deleted, retry-wait, cleanup failed; expired but physical delete pending; account deletion pending; active job during deletion. Logical expiry is immediate even if delete fails. Never claim success if object is still present/unknown. Account deletion stops new claims and safely transitions active work.

## Security/privacy

Owner-only retention/deletion; confirmation and CSRF/replay safeguards; cleanup credentials and triggers are not public owner-controlled authority; no PII in long-term audit facts; logs scrubbed.

## Acceptance criteria

- AC1: Only 24h/7d/30d accepted; default is 7d.
- AC2: Exact logical expiry timestamp is stable.
- AC3: Expired output cannot obtain a fresh download URL.
- AC4: Daily sweep detects/deletes due R2 objects and retries failures.
- AC5: Cleanup failure remains visible and retryable.
- AC6: Expired recipient data removed; only allowed aggregates persist.
- AC7: Template source remains until template deletion.
- AC8: Account deletion revokes session immediately and schedules all owned cleanup.
- AC9: Copy discloses physical deletion may lag logical expiry.

## Tests

All presets, abandoned draft, output expiry, signed URL expired, R2 failure/retry, repeat sweep idempotency, partial DB/object deletion, active job/template deletion, account delete during generation, post-expiry PII/log scan, cross-user delete.

## Dependencies/gate

CORE-01 through CORE-08, R2 delete API and cleanup ledger. Must pass before using real recipient data.

## Open details

Actual daily sweep scheduler allowed by hosting terms, retry schedule, delete verification and source template behavior if approved jobs still reference it.
