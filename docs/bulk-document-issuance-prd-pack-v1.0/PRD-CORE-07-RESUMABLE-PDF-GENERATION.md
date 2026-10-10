# PRD-CORE-07 — Resumable browser-side PDF generation

**Status:** Core MVP · P0; limits benchmark-driven.

## Objective

Generate one PDF per valid approved recipient in bounded Web Worker chunks, store outputs and checkpoints durably, and resume when a user returns after refresh, interruption or browser closure. Work does not continue while no browser dispatcher is active.

## User stories

- I can start generation and see server-confirmed progress.
- I can pause, resume and cancel work.
- Reopening the app recovers state and pending work without duplicate outputs.
- A recipient-specific failure does not automatically block unrelated recipients.
- Completed files remain available until their normal expiration even when the job is cancelled.

## Scope / exclusions

Single active batch lease; bounded work claims; Web Worker; PDF generation using approved snapshot; direct R2 output upload; checksum/size metadata; checkpoint; polling; pause/resume/cancel; stale lease recovery. Excludes always-on server worker, fixed SLA, email and paid compute.

## End-to-end flow

1. User starts generation for `ready` snapshot.
2. Browser requests atomic batch lease + bounded list of pending recipients/operation keys.
3. Browser loads source from scoped R2 URL and generates PDFs in a Web Worker.
4. For each PDF, obtain scoped output upload authorization; upload to R2; then submit checkpoint metadata (recipient ID, snapshot ID, operation key, checksum/bytes).
5. Hono validates owner, lease, snapshot, object key policy and idempotency; persist result. Repeated checkpoint returns existing state.
6. Poll `GET /api/batches/:id` for counters/phase.
7. Pause stops new claims and finishes/abandons at safe chunk boundary; resume reacquires lease. Closing browser stops CPU; expired lease can be reclaimed on return.
8. Cancel stops future claims and marks pending work cancelled; completed outputs remain.
9. End state is ready/partial/failed as appropriate.

## Routes/components

`/app/batches/:batchId/progress`; `GenerationProgress`, `PhaseProgressSummary`, `RecipientStatusTable`, `PauseResumeControls`, `CancelJobDialog`, `LeaseStatusIndicator`, `ResumePrompt`, `PollStatusHook`.

## API/data

`POST /api/batches/:id/generation/claim`; scoped output upload URL endpoint; `POST /api/batches/:id/generation/checkpoint`; `POST /api/batches/:id/pause|resume|cancel`; `GET /api/batches/:id`. Collections: `workItems`, `approvedRecipients`, `outputs`, `batches`, `approvedSnapshots`.

## States/errors

Queued, active, paused, stale lease, recovering, cancel pending, partial failure, complete, terminal/systemic failure, expired. If upload succeeded but checkpoint failed, resume inspects deterministic object/checksum and reconciles. A systemic template/engine problem may pause the batch; one recipient error is isolated where safe.

## Security/privacy

Claim/checkpoint verifies owner, session, current lease, batch state and snapshot. Object keys are server-generated. Enforce file/page/row/worker/storage limits; avoid PII in logs; poll persisted state, not client memory.

## Acceptance criteria

- AC1: One active worker lease per batch across tabs.
- AC2: Refresh/reopen resumes from persisted state.
- AC3: Browser close pauses CPU work; status does not claim autonomous completion.
- AC4: Retries/duplicate checkpoints do not duplicate outputs or counters.
- AC5: Upload-before-checkpoint interruption is reconciled via operation key/checksum.
- AC6: Pause/cancel occurs at safe boundary; completed outputs persist.
- AC7: One-recipient error does not block unrelated work unless systemic.
- AC8: Counters reconcile with recipient/work-item records.

## Tests

Two-tab claim race; lease expiry; close during each phase; R2 upload then API timeout; repeated checkpoint; worker crash; corrupt row; systemic source error; pause/cancel; 500/1k/5k load and memory measurement.

## Dependencies/gate

CORE-03/06, private R2, MongoDB leases, PDF generator and stable operation keys. Publish workload cap only after representative benchmarks.

## Open details

Chunk size, worker concurrency, lease duration, deterministic output key and recovery algorithm, maximum memory/runtime, and PDF library compatibility.
