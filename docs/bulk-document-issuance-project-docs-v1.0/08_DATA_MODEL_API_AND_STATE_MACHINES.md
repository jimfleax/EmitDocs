# Data Model, API and State Machines

## 18. Proposed data model (implementation draft; requires review)

The schema intentionally keeps large binary data out of MongoDB and separates mutable draft data from immutable approved recipient snapshots. Exact field naming can evolve, but the invariants should not.

### 18.1 Collections and key fields

#### `users`

```ts
{
  _id: ObjectId;
  googleSub: string;               // verified Google `sub`, unique identity key
  email: string;
  emailVerified: boolean;
  displayName?: string;
  status: "active" | "suspended" | "deletion_pending";
  createdAt: Date;
  updatedAt: Date;
  limits: { maxRowsPerBatch: number; maxActiveBatches: number; emailQuota: number };
}
```

Never use email as the provider identity key. Google documents the `sub` claim as the stable, unique identifier; verify signature, audience, issuer and expiry server-side.

#### `templates`

```ts
{
  _id: ObjectId;
  ownerId: ObjectId;
  name: string;
  currentVersionId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  retention: { sourcePdfRetainedUntilDeleted: true };
}
```

#### `templateVersions`

```ts
{
  _id: ObjectId;
  templateId: ObjectId;
  ownerId: ObjectId;
  version: number;
  sourceObjectKey: string;         // opaque, server-generated R2 key
  sourceSha256: string;
  sourceBytes: number;
  pageCount: number;
  pdfCompatibility: "supported" | "warning" | "unsupported";
  fieldMappings: Array<{
    fieldKey: string; label: string; type: "text" | "date" | "number";
    pageIndex: number; x: number; y: number; width: number; height: number;
    align: "left" | "center" | "right"; fontFamily?: string;
    minFontSize?: number; maxFontSize?: number;
    fitMode: "shrink-then-flag" | "wrap-then-flag" | "strict";
    mask: { mode: "none" | "solid-fill"; color?: string };
  }>;
  createdAt: Date;
  createdBy: ObjectId;
  status: "draft" | "active" | "superseded";
}
```

Mappings are versioned. Do not mutate a template version referenced by an approved batch. Coordinate units and the conversion from PDF.js viewport coordinates to PDF page coordinates must be defined once and tested against page rotation and scale.

#### `batches`

```ts
{
  _id: ObjectId;
  ownerId: ObjectId;
  templateId: ObjectId;
  name: string;
  lifecycle: "draft" | "importing" | "review" | "approved" | "active" |
             "paused" | "canceling" | "canceled" | "completed" |
             "partial" | "failed" | "expiring" | "expired";
  currentImportRevision: number;
  approvedSnapshotId?: ObjectId;
  generation: { status: GenerationStatus; total: number; pending: number;
                processing: number; generated: number; failed: number };
  delivery: { status: DeliveryStatus; eligible: number; queued: number;
              attempting: number; accepted: number; delivered: number;
              bounced: number; complained: number; failed: number; unknown: number };
  flags: { pauseRequested: boolean; cancelRequested: boolean };
  retention: { presetHours: 24 | 168 | 720; expiresAt?: Date };
  createdAt: Date;
  updatedAt: Date;
  version: number;                  // compare-and-set / optimistic concurrency
}
```

Counters are an eventually consistent summary for fast UI polling, not the only source of truth. A reconciliation routine must be able to recompute them from rows/work items.

#### `batchImports`

```ts
{
  _id: ObjectId;
  batchId: ObjectId;
  ownerId: ObjectId;
  revision: number;
  status: "uploading" | "parsing" | "validating" | "ready" | "rejected" | "superseded";
  rowCountExpected?: number;
  rowCountReceived: number;
  columnMap: Record<string, string>; // target field -> imported column name
  reconciliationKey?: string;
  counts: { valid: number; invalid: number; duplicateWarnings: number; conflicts: number };
  createdAt: Date;
  completedAt?: Date;
}
```

#### `draftRows`

```ts
{
  _id: ObjectId;
  batchId: ObjectId;
  importId: ObjectId;
  ownerId: ObjectId;
  rowKey: string;                    // stable only within this import revision
  sourceRowNumber: number;
  naturalKey?: string;
  importedData: Record<string, string | number | null>;
  overrides: Record<string, string | number | null>;
  effectiveData: Record<string, string | number | null>;
  validationErrors: Array<{ field?: string; code: string; message: string }>;
  duplicateWarnings: Array<{ code: string; relatedRowKey?: string }>;
  editedAt?: Date;
  updatedAt: Date;
}
```

`effectiveData` should be a derived/canonical value after validating `importedData + overrides`; do not let the client send arbitrary “valid” flags. Revalidate server-side on every edit, import chunk and approval request.

#### `approvedSnapshots`

```ts
{
  _id: ObjectId;
  batchId: ObjectId;
  ownerId: ObjectId;
  snapshotRevision: number;
  templateVersionId: ObjectId;
  templateSourceSha256: string;
  mappingSha256: string;
  rowCount: number;
  snapshotDigest: string;             // digest of a canonical ordered representation
  state: "building" | "ready" | "failed" | "superseded";
  approvedAt?: Date;
  createdAt: Date;
}
```

#### `approvedRecipients`

```ts
{
  _id: ObjectId;
  batchId: ObjectId;
  snapshotId: ObjectId;
  ownerId: ObjectId;
  recipientKey: string;
  sourceRowNumber: number;
  dataSnapshot: Record<string, string | number | null>; // immutable
  emailNormalized?: string;
  generationStatus: "pending" | "leased" | "generated" | "failed" | "skipped";
  generationAttempts: number;
  generationLease?: { owner: string; expiresAt: Date };
  outputObjectKey?: string;
  outputSha256?: string;
  outputBytes?: number;
  deliveryStatus: "not_requested" | "queued" | "leased" | "retry_wait" | "accepted" |
                  "delivered" | "bounced" | "complained" | "failed_permanent" |
                  "unknown" | "paused" | "canceled";
  deliveryAttempts: number;
  nextAttemptAt?: Date;
  providerMessageId?: string;
  lastErrorCode?: string;
  lastErrorSafeMessage?: string;
  updatedAt: Date;
}
```

Keep name/address/email data separate from long-term aggregate history and delete it on expiry. Do not log `dataSnapshot`, source text, email content, signed URLs, tokens, or provider secrets.

#### `workItems`

```ts
{
  _id: ObjectId;
  ownerId: ObjectId;
  batchId: ObjectId;
  snapshotId: ObjectId;
  recipientId: ObjectId;
  phase: "generate" | "send" | "cleanup";
  operationKey: string;               // deterministic logical operation key
  status: "queued" | "leased" | "retry_wait" | "completed" | "dead" | "canceled";
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  leaseOwner?: string;
  leaseExpiresAt?: Date;
  lastErrorCode?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

For this architecture, `workItems` is a persisted lease/dispatch ledger driven in chunks by an active browser, not a claim of autonomous execution when no browser is active. Unique `operationKey` prevents duplicate logical work creation. The approved recipient row remains authoritative for final state.

#### `deliveryAttempts`

```ts
{
  _id: ObjectId;
  ownerId: ObjectId;
  batchId: ObjectId;
  snapshotId: ObjectId;
  recipientId: ObjectId;
  attemptNumber: number;
  appIdempotencyKey: string;          // durable for the app's retention period
  providerIdempotencyKey?: string;    // provider window/behavior may be limited
  providerMessageId?: string;
  status: "started" | "accepted" | "known_transient_failure" |
          "known_permanent_failure" | "unknown" | "reconciled";
  startedAt: Date;
  finishedAt?: Date;
  errorCode?: string;
}
```

#### `providerEvents`

```ts
{
  _id: ObjectId;
  provider: string;
  providerEventId: string;
  providerMessageId?: string;
  recipientId?: ObjectId;
  normalizedType: string;
  receivedAt: Date;
  processedAt?: Date;
  minimalPayload: Record<string, unknown>; // allowlisted fields only
}
```

Verify webhook signature before accepting events. Use a unique `(provider, providerEventId)` index. Events may be duplicate or out of order; derive state using transition rules, not last-write-wins blindly.

#### `cleanupTasks` and `auditEvents`

`cleanupTasks` contains an opaque object key, related owner/template/batch IDs, `dueAt`, attempt count, status, lease, and last error code. It is required because MongoDB TTL does not delete R2 objects. `auditEvents` records security-meaningful actions with actor, resource ID, action and timestamp; never copy full PII or signed URLs into the event.

### 18.2 Index plan

Create indexes through explicit migrations/startup checks rather than waiting for production queries to fail:

- `users`: unique `{ googleSub: 1 }`; optionally normalized email index for account lookup (not identity).
- `templates`: `{ ownerId: 1, updatedAt: -1 }`; `{ ownerId: 1, deletedAt: 1 }` for active-template listing.
- `templateVersions`: unique `{ templateId: 1, version: 1 }`; `{ ownerId: 1, templateId: 1, createdAt: -1 }`.
- `batches`: `{ ownerId: 1, updatedAt: -1 }`; `{ lifecycle: 1, updatedAt: 1 }` only if needed for operational queries.
- `batchImports`: unique `{ batchId: 1, revision: 1 }`.
- `draftRows`: unique `{ importId: 1, rowKey: 1 }`; `{ batchId: 1, importId: 1, sourceRowNumber: 1 }`; index selected reconciliation key only as a normal/non-unique index unless uniqueness is validated.
- `approvedSnapshots`: unique `{ batchId: 1, snapshotRevision: 1 }`; `{ state: 1, createdAt: 1 }` for recovery.
- `approvedRecipients`: unique `{ snapshotId: 1, recipientKey: 1 }`; `{ batchId: 1, snapshotId: 1, generationStatus: 1, sourceRowNumber: 1 }`; `{ batchId: 1, snapshotId: 1, deliveryStatus: 1, nextAttemptAt: 1 }`.
- `workItems`: unique `{ operationKey: 1 }`; `{ status: 1, availableAt: 1, leaseExpiresAt: 1, phase: 1 }`; `{ batchId: 1, snapshotId: 1, phase: 1, status: 1 }`.
- `deliveryAttempts`: unique `{ appIdempotencyKey: 1 }`; `{ recipientId: 1, attemptNumber: 1 }`; sparse index `{ providerMessageId: 1 }` where supported.
- `providerEvents`: unique `{ provider: 1, providerEventId: 1 }`; `{ providerMessageId: 1 }`.
- `cleanupTasks`: `{ status: 1, dueAt: 1, leaseExpiresAt: 1 }`; unique cleanup operation key to keep deletion idempotent.

Avoid a unique index on email per batch. Multiple rows may legitimately use the same email. Test the actual Atlas Free feature/index/storage limits before choosing the final index set.

## 19. Proposed Hono API contract

All routes are versioned under `/api/v1`. Responses use consistent error bodies such as `{ error: { code, message, requestId, retryable? } }`. User-facing messages must not disclose provider secrets or internal exception strings. Zod validates every external body, query, route param, and critical worker payload.

### 19.1 Authentication and account

- `POST /api/v1/auth/google/session` — accepts a Google credential, validates token signature/audience/issuer/expiry, validates request origin/CSRF protections appropriate to the GIS mode, resolves user by Google `sub`, and sets the app session cookie.
- `POST /api/v1/auth/logout` — revoke/expire server session and clear cookie.
- `GET /api/v1/me` — return minimal user profile and capability/quota summary.

Use an opaque, random session ID stored server-side if practical, or a signed session with rotation/revocation semantics. Cookie attributes should include `HttpOnly`, `Secure` in production, a deliberate `SameSite` setting, path scoping, and no unnecessary domain widening. Credentialed CORS must allow only known origins. A cross-site front end/API deployment can break cookie behavior; deployment topology is still an open decision.

### 19.2 Template lifecycle and upload

- `POST /api/v1/templates` — create draft template metadata; returns template ID and an upload intent.
- `POST /api/v1/uploads/presign` — accepts only an enumerated purpose and owned resource; Hono creates a random opaque object key and returns a short-lived R2 PUT URL. Client cannot choose arbitrary buckets/keys.
- `POST /api/v1/templates/:templateId/source/complete` — verify ownership, object existence, byte limit, expected type, checksum where available and supported PDF signature; record an immutable template version.
- `GET /api/v1/templates` and `GET /api/v1/templates/:templateId` — return metadata only; issue separate short-lived GET URL when the browser needs the source PDF.
- `PATCH /api/v1/templates/:templateId` — create a new immutable template version for mapping/style changes; don't mutate versions referenced by approved snapshots.
- `DELETE /api/v1/templates/:templateId` — soft-delete metadata and enqueue source/version object cleanup; deletion completion is a separate status.

### 19.3 Batch/import/review/approval

- `POST /api/v1/batches` — create draft batch linked to an explicit template version.
- `POST /api/v1/batches/:batchId/imports` — create an import revision and define column mapping/reconciliation key.
- `POST /api/v1/batches/:batchId/imports/:importId/rows` — ingest a bounded JSON chunk of parsed rows; server-side Zod validates and canonicalizes each record. Each response gives accepted/invalid row counts and row-level codes. Keep each request comfortably below Vercel's 4.5 MB payload cap.
- `POST /api/v1/batches/:batchId/imports/:importId/complete` — finalize expected row count; mark revision `ready` only when all chunks are accounted for and validation is complete.
- `GET /api/v1/batches/:batchId/review` — paginated/searchable rows, validation warnings, draft preview metadata and diff summary.
- `PATCH /api/v1/batches/:batchId/rows/:rowId` — apply a draft-only field override; revalidate the row and record a minimal audit entry.
- `POST /api/v1/batches/:batchId/reimports/:importId/compare` — produce a proposed diff (added/removed/changed/duplicates/conflicts) without mutating the current draft.
- `POST /api/v1/batches/:batchId/reimports/:importId/apply` — apply the confirmed reconciliation in a new draft revision. Existing approved revisions remain untouched.
- `POST /api/v1/batches/:batchId/approve` — server verifies no unresolved blocking errors, stores/finalizes an immutable approved snapshot, and uses a compare-and-set transition so two simultaneous approvals cannot create competing active snapshots.
- `GET /api/v1/batches/:batchId` and `GET /api/v1/batches/:batchId/progress` — return persisted state and aggregate counters, never all PII unless requested for a paginated authorized view.

### 19.4 Browser generation and output upload

- `POST /api/v1/batches/:batchId/generation/claim` — atomically claim a small set of eligible recipient rows with a browser-run ID and lease expiry; return approved data and a short-lived template GET URL.
- `POST /api/v1/batches/:batchId/recipients/:recipientId/output-upload-intent` — confirm that recipient is claimed and authorized, then return a single-object R2 PUT URL and server-generated output key.
- Browser Worker generates the PDF, uploads it directly to R2, and computes a SHA-256/checksum and byte size.
- `POST /api/v1/batches/:batchId/recipients/:recipientId/generation/complete` — verifies current lease/approved revision, records key/checksum/size, and atomically marks the recipient generated. Repeated completion with the same checksum is idempotent; a conflicting checksum is rejected and audited.
- `POST /api/v1/batches/:batchId/generation/fail` — record a safe structured failure. Only retry conditions classified as transient; mark permanent incompatibility/input errors for correction.
- `POST /api/v1/batches/:batchId/actions/pause`, `/resume`, `/cancel` — update desired state. Pause/cancel are cooperative and checked at unit boundaries; accepted email cannot be unsent.

### 19.5 Email dispatch, delivery events, downloads and deletion

- `POST /api/v1/batches/:batchId/delivery/prepare` — validate consent/authorization checkbox, quota, generated PDF presence, valid email address and batch approval; create logical send intents with stable keys.
- `POST /api/v1/batches/:batchId/delivery/dispatch` — frontend trigger for a small bounded unit of due items; Hono claims each item, fetches approved PDF from private R2, calls provider, persists the attempt and returns per-item outcomes. The route must have a bounded timeout and should not attempt a full 5,000-email batch in one invocation.
- `POST /api/v1/webhooks/email/:provider` — verify provider signature, insert event idempotently, then update recipient delivery state under allowed transition rules. Never trust unsigned event bodies.
- `POST /api/v1/batches/:batchId/downloads/presign` — authorize ownership and issue short-lived GET URL for one generated PDF/object; ZIP generation stays in the browser and uses bounded local processing.
- `POST /api/v1/batches/:batchId/retention/run` — internal/authorized housekeeping entry point to process due deletion tasks. It must not be a public unauthenticated endpoint. A scheduled call is only a best-effort safety net under constrained hosting; API requests may also opportunistically process a small cleanup chunk.
- `GET /api/v1/batches/:batchId/cleanup-status` — report retention deadline and cleanup status without exposing expired recipient data.

The exact route names are proposed, not user-approved. The API schema should eventually be published in OpenAPI or generated from the shared Zod schema package.

## 20. State machines and invariants

### 20.1 Batch lifecycle

`draft → importing → review → approved → active → (paused ↔ active) → completed | partial | failed | canceled → expiring → expired`

Not every batch needs every status. `partial` means terminal mixed outcomes (for example, some recipient PDFs generated while a subset permanently failed). A batch can be generation-complete but email-incomplete, so lifecycle must be paired with independent generation and delivery state axes rather than a single overloaded status.

### 20.2 Generation state per approved recipient

`pending → leased → generated`

`leased → pending` after an expired lease or a known retryable worker interruption.

`leased → failed` for a terminal error such as an unsupported template/row value after bounded retry policy.

`pending/leased → canceled` only for work not already committed; if generation finished and object upload succeeded, retain the result and mark it completed rather than deleting it silently.

A generated row is valid only when an approved snapshot exists, the object key is server-scoped to that row/revision, the upload is confirmed, and the checksum/size are recorded.

### 20.3 Delivery state per recipient

`not_requested → queued → leased/attempting → accepted`

From `accepted`, provider events can progress to `delivered`, `bounced`, or `complained` if the provider reports them. A known transient error enters `retry_wait → queued` if attempts remain. A known permanent address/content error enters `failed_permanent`. A network timeout after the request may have reached the provider enters `unknown → reconciliation_pending` (can be a substate or associated work item); it must not be treated as safe-to-retry by default. Pause prevents new claims but does not reverse accepted sends. Cancel marks unsent work canceled while preserving attempted/accepted delivery facts.

Delivery events may arrive out of order. Rules should be monotonic where sensible (e.g. don't turn a delivered event back into queued); complaints/bounces remain terminal flags even if another event arrives. Keep raw provider event payloads minimal and process each provider event ID at most once.

### 20.4 MongoDB concurrency protocol

- Claim work using an atomic predicate on status and eligibility (`availableAt <= now`, no active lease or expired lease) and set `leaseOwner`, `leaseExpiresAt`, and `status=leased` in one update.
- Use compare-and-set filters for every status transition (expected prior state and snapshot/revision match). MongoDB guarantees atomicity at a single-document write level; multi-document bulk writes are not atomic as a whole.
- Never rely only on an in-memory JS mutex, browser state, or an incremented counter to avoid duplicate work.
- Use unique indexes on the logical operation key and delivery key as the last line of defense against races.
- Reconcile summary counters periodically/on progress requests from recipient states; treat counters as denormalized cache, not truth.
- Use a two-phase import/approval pattern instead of one enormous multi-document transaction: ingest into a revision; validate expected counts/digest; create immutable snapshot rows in chunks; only then atomically mark snapshot `ready` and batch `approved`.

## 20. State machines and invariants

### 20.1 Batch lifecycle

`draft → importing → review → approved → active → (paused ↔ active) → completed | partial | failed | canceled → expiring → expired`

Not every batch needs every status. `partial` means terminal mixed outcomes (for example, some recipient PDFs generated while a subset permanently failed). A batch can be generation-complete but email-incomplete, so lifecycle must be paired with independent generation and delivery state axes rather than a single overloaded status.

### 20.2 Generation state per approved recipient

`pending → leased → generated`

`leased → pending` after an expired lease or a known retryable worker interruption.

`leased → failed` for a terminal error such as an unsupported template/row value after bounded retry policy.

`pending/leased → canceled` only for work not already committed; if generation finished and object upload succeeded, retain the result and mark it completed rather than deleting it silently.

A generated row is valid only when an approved snapshot exists, the object key is server-scoped to that row/revision, the upload is confirmed, and the checksum/size are recorded.

### 20.3 Delivery state per recipient

`not_requested → queued → leased/attempting → accepted`

From `accepted`, provider events can progress to `delivered`, `bounced`, or `complained` if the provider reports them. A known transient error enters `retry_wait → queued` if attempts remain. A known permanent address/content error enters `failed_permanent`. A network timeout after the request may have reached the provider enters `unknown → reconciliation_pending` (can be a substate or associated work item); it must not be treated as safe-to-retry by default. Pause prevents new claims but does not reverse accepted sends. Cancel marks unsent work canceled while preserving attempted/accepted delivery facts.

Delivery events may arrive out of order. Rules should be monotonic where sensible (e.g. don't turn a delivered event back into queued); complaints/bounces remain terminal flags even if another event arrives. Keep raw provider event payloads minimal and process each provider event ID at most once.

### 20.4 MongoDB concurrency protocol

- Claim work using an atomic predicate on status and eligibility (`availableAt <= now`, no active lease or expired lease) and set `leaseOwner`, `leaseExpiresAt`, and `status=leased` in one update.
- Use compare-and-set filters for every status transition (expected prior state and snapshot/revision match). MongoDB guarantees atomicity at a single-document write level; multi-document bulk writes are not atomic as a whole.
- Never rely only on an in-memory JS mutex, browser state, or an incremented counter to avoid duplicate work.
- Use unique indexes on the logical operation key and delivery key as the last line of defense against races.
- Reconcile summary counters periodically/on progress requests from recipient states; treat counters as denormalized cache, not truth.
- Use a two-phase import/approval pattern instead of one enormous multi-document transaction: ingest into a revision; validate expected counts/digest; create immutable snapshot rows in chunks; only then atomically mark snapshot `ready` and batch `approved`.
