# Proposed domain model, API contracts and state machines

**Status:** Implementation baseline proposal, not a frozen migration. Separate collections, immutable snapshots, MongoDB claim/lease records and OpenAPI are decided. Exact field names/routes remain proposed.

## 1. Invariants

1. Every resource is scoped to `ownerId`; ignore client-supplied owner IDs.
2. Verify Google ID token server-side and key users by Google `sub`, not email.
3. PDF/CSV/XLSX/ZIP bytes belong in private R2, not regular MongoDB documents.
4. Template versions and approved snapshots are immutable once saved/approved.
5. Draft imported values, manual overrides and effective validated values are distinct.
6. Snapshot fixes template/version/checksum, field mappings/styles, import revision, effective data and overrides.
7. Every output maps to exactly one snapshot recipient; never use row position as identity.
8. Retried operations are idempotent; server state is authoritative.
9. A MongoDB queue record does not execute itself. The active browser dispatcher advances work under one batch lease; closing the browser pauses generation.
10. Counters are reconcilable summaries, not the only record of per-recipient state.
11. Strict expiry wins over unsent work; future unsent mail becomes `expired_unsent`.
12. Logs never contain raw token/cookie, signed URL, document text, full recipient rows or provider secrets.

## 2. Proposed MongoDB collections

### `users`
`_id`, unique `googleSub`, normalized email/profile fields, `status: active|suspended|deletion_pending|deleted`, created/updated timestamps, `defaultRetentionHours` (default 168; allowed 24/168/720). Optional limits are server-owned config, never browser-authoritative.

### `sessions`
`_id`, `userId`, unique `tokenHash`, `createdAt`, `expiresAt`, `lastSeenAt`, `revokedAt?`. Cookie carries the raw opaque random token; database stores only a hash. Index expiration/user ID; revocation must not depend on TTL deletion.

### `templates`
`_id`, `ownerId`, `name`, `currentVersionId`, timestamps, `deletedAt?`. Source PDF persists until template deletion.

### `templateVersions`
`_id`, `templateId`, `ownerId`, unique `version`, `sourceObjectKey`, SHA-256, bytes/page count, compatibility result, immutable field mappings, timestamp/actor, `draft|active|superseded`. Field mapping contains key/label/type (`text|date|number`), page index, canonical PDF coordinates/dimensions, alignment, font/embed reference, min/max font size, fit mode, masking mode/color and formatting. Standard token syntax is `{{fieldKey}}`.

### `batches`
`_id`, `ownerId`, `templateId`, name, lifecycle, current import revision, approved snapshot ID, generation counts, pause/cancel flags, retention preset, expiry, version for compare-and-set, timestamps. Summary counts must be recomputed/reconciled from child records.

### `batchImports`
`_id`, batch/owner IDs, revision, original source object key/checksum, worksheet name, status, row count, column map, optional reconciliation key, validation/duplicate/conflict counts, timestamps. XLSX uses user-selected worksheet; first non-empty row is header.

### `draftRows`
`_id`, batch/import/owner IDs, revision-local `rowKey`, source row number, `importedData`, `overrides`, derived `effectiveData`, validation errors/warnings, duplicate references, version and timestamps. Server recomputes effective values and validity.

### `approvedSnapshots`
`_id`, batch/owner IDs, snapshot revision, template version/source checksum, mapping hash, import revision, canonical digest, row count, `building|ready|failed|superseded`, approval actor/time. Build in stages; never expose partially copied snapshot as approved.

### `approvedRecipients`
`_id`, batch/snapshot/owner IDs, `recipientKey`, source row reference, immutable data snapshot, generation status/attempts/lease/output key/checksum/size; optional future email fields. Delete personal data at expiry.

### `workItems`
`_id`, owner/batch/snapshot/recipient IDs, phase `generate|send|cleanup`, unique `operationKey`, status `queued|leased|retry_wait|completed|dead|canceled`, attempts/max, `availableAt`, lease owner/expiry, safe last-error code, timestamps. In prototype the browser dispatcher advances generation work; email is deferred.

### `outputs` (Deprecated / Replaced by JIT generation)
Generated recipient PDFs are generated on-the-go on the client and are NOT stored as individual records in MongoDB or Cloudinary. Snapshots (`ApprovedSnapshot` and `ApprovedRecipient`) contain all deterministic inputs needed to regenerate any document or ZIP archive instantaneously.

### `cleanupTasks` and `auditEvents`
Cleanup record has owner/resource link, opaque key, due date, attempts, status, lease and safe last error. Audit event has actor/resource/action/time/outcome and minimal safe metadata, never raw PII or signed URL.

### Deferred email collections
`deliveryAttempts`: recipient, attempt number, durable application idempotency key, optional provider key/message ID, status `started|accepted|known_transient_failure|known_permanent_failure|unknown|reconciled`, timestamps and safe error. `providerEvents`: provider/event ID, message ID, normalized type, times and allowlisted payload. Unique provider/event ID; verified signatures; duplicate/out-of-order event handling.

## 3. Index proposals

Unique: `users.googleSub`, `sessions.tokenHash`, `(templateId, version)`, `(batchId, revision)` for imports, `(importId,rowKey)`, `(batchId,snapshotRevision)`, `(snapshotId,recipientKey)`, `workItems.operationKey`, `deliveryAttempts.appIdempotencyKey`, `(provider,providerEventId)` when email is enabled. Add indexes for owner/updated lists, due cleanup tasks, status/availableAt/lease expiry, outputs by batch/recipient and session expiry. Verify Atlas plan limits and query explain results before final migration.

## 4. API contract conventions

- All app endpoints under `/api`; metadata/control uses JSON. Large bytes go directly to R2 through short-lived scoped URLs.
- OpenAPI is the cross-repository contract; Zod validates at API boundaries. Generator/client package is still unselected. CI should detect schema/client drift.
- Mutations that can be retried include an idempotency/operation key. Version-sensitive updates include expected revision/version. Do not accept client `isValid=true` as authority.
- Proposed safe error shape:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Some rows need correction.",
    "requestId": "opaque-id",
    "fieldErrors": [{"field":"date","code":"INVALID_DATE","message":"Use a supported date format."}]
  }
}
```

No raw stack traces, storage secrets, provider details or signed URLs in normal response/logs.

## 5. Proposed route catalogue

### Session/account
- `GET /api/session`
- `POST /api/auth/google`
- `POST /api/auth/logout`
- `DELETE /api/account` (confirmation and idempotency protected)

### Templates
- `GET/POST /api/templates`
- `GET /api/templates/:id`
- `POST /api/templates/:id/uploads` and `/uploads/complete`
- `GET /api/templates/:id/versions`
- `POST /api/templates/:id/versions`
- `GET /api/templates/:id/versions/:versionId/source-url`
- `DELETE /api/templates/:id`

### Batches/import/review/approval
- `POST /api/batches`, `GET /api/batches`, `GET /api/batches/:id`
- `POST /api/batches/:id/imports`
- `POST /api/batches/:id/imports/:importId/complete`
- `POST /api/batches/:id/imports/:importId/rows` (bounded idempotent chunks)
- `POST /api/batches/:id/imports/:importId/finalize`
- `GET /api/batches/:id/rows?cursor=&filter=&query=`
- `PATCH /api/batches/:id/rows/:rowId`
- `POST /api/batches/:id/reimports/:importId/reconcile`
- `POST /api/batches/:id/approve`

### Generation/output (On-demand JIT)
- `GET /api/batches/:id/snapshot` (retrieve frozen mapping configuration & template version)
- `GET /api/batches/:id/snapshot/recipients` (stream approved recipients with effective data)
- `GET /api/templates/:id/versions/:version/file` (stream authorized base template PDF from Cloudinary)
- `POST /api/batches/:id/generation/audit` (optional export completion audit log)

### Retention/future email
- `PATCH /api/settings/retention`
- Internal cleanup sweep only through an authorized scheduler/mechanism; never expose an unauthenticated public cleanup action.
- Future email APIs: `/api/batches/:id/email/preflight`, `/dispatch`, pause/resume/cancel, and provider webhook route. Do not implement in downloads-first release.

Names/payloads are proposals, but ownership, idempotency, immutable snapshot and expiry semantics are requirements.

## 6. State machines

### Batch
`draft → importing → review → awaiting_approval → approved → generating → ready_for_download`. Control states: `paused`, `cancelling`, `cancelled`. Outcomes: `completed`, `partially_completed`, `failed`, `expiring`, `expired`. Batch generation status is separate from delivery status.

### Draft row
`unvalidated → valid|invalid`. Duplicates are warnings and preserved. Edits recompute effective data/errors. After approval, changes create a new revision/job.

### Generation recipient
`pending → leased → generated|failed`; lease can expire and be reclaimed. Deterministic operation key and object checksum support recovery. Pending items can become `cancelled`/`skipped`; completed outputs remain.

### Cleanup
`scheduled → due → deleting → deleted`, or `retry_wait` on error. Failure remains visible/retriable; daily sweep + R2 lifecycle are backstops. Logical expiry doesn't assert instantaneous physical erasure.

### Future email
`not_requested → queued → leased/sending → accepted_by_provider → delivered` when supported by provider events; alternate terminal/failure states `bounced|complained|failed_permanent|unknown|expired_unsent|paused|cancelled`. Provider acceptance is not inbox delivery; ambiguous send is reconciled before retry.

## 7. Claim/lease protocol (proposed)

- Only one active browser worker lease per batch, acquired by atomic conditional update.
- Checkpoint validates session/owner, current lease token, snapshot and job revision.
- Work chunks are bounded and configurable by benchmark.
- Deterministic output operation keys derive from snapshot + recipient + generation version. Repeated checkpoint returns existing status.
- If upload succeeded but checkpoint did not, browser resume inspects deterministic object/checksum and reconciles rather than blindly generating again.
- Browser polling reads persisted status; browser memory is never source of truth.
- Cancellation stops new claims and is honored at safe chunk boundaries; completed artifacts remain.

## 8. Open implementation details

PDF/row/archive caps; browser chunk size/concurrency; ZIP strategy; font shaping; spreadsheet parser; session TTL/rotation/CSRF; OpenAPI generator/client; same-origin deployment/rewrite; Atlas tier/limits; R2 signed URL and deletion behavior; cleanup trigger; public host and future email provider all require implementation validation.
