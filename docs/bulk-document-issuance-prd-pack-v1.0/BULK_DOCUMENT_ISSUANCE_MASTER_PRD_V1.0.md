# Bulk Document Issuance — Master PRD v1.0

This file combines the master PRD, shared implementation specifications, all core vertical-slice PRDs and deferred future PRDs. The modular files are the editable source of truth.


---

<!-- Begin source: 01_MASTER_PRD.md -->

# Master Product Requirements Document (PRD)

**Product:** Bulk Document Issuance (working title) · **Version:** 1.0 · **Date:** 10 October 2026  
**Status:** Ready for implementation planning, subject to explicitly recorded proof-of-concept and hosting gates.

## 1. Summary

Bulk Document Issuance is a general-purpose web app for turning an existing supported PDF and a CSV/XLSX dataset into individualized documents. Organizers save PDF templates, confirm detected placeholders or visually map fields, validate their data, review every draft, approve an immutable snapshot, generate individual PDFs in the browser, and download files individually or as bounded ZIP archives.

Email delivery is part of the longer-term product but is **not enabled in the first live prototype**. A deferred PRD defines future delivery requirements. The first release must prove the PDF-to-download workflow, data correctness, recoverability and retention.

General-purpose refers to document category, not arbitrary file support. The initial compatibility boundary is searchable/text-based PDFs with capped multi-page support, `{{field}}` suggestions and a visual mapping fallback. Complex backgrounds, image-only/scanned PDFs and universal in-place text editing are not promised.

## 2. Problem and product thesis

Users creating event certificates, letters, acknowledgements, notices, awards and similar documents often repeat manual editing, spreadsheet cleanup, file naming, review, packaging and correction work. The product hypothesis is that a better end-to-end workflow can preserve an existing PDF design, reduce setup, catch data/layout errors before issuance, and handle larger batches reliably. These are market hypotheses to validate; this PRD does not claim a proven competitive advantage.

## 3. Goals

1. Save and reuse supported PDF designs as versioned templates.
2. Suggest fields automatically while requiring user confirmation; always provide visual placement when supported.
3. Import CSV/XLSX, map columns and validate each row independently.
4. Make every draft browseable before approval via on-demand previews using the same generation pipeline.
5. Freeze approved template/data/mapping/override state into an immutable snapshot.
6. Generate individual PDFs in bounded browser-worker chunks and resume after the user returns.
7. Download individual PDFs or bounded/split ZIP archives.
8. Show accurate persisted progress, errors and retention/deletion status.
9. Enforce strict ₹0 infrastructure spending for the private prototype.
10. Require security, recovery and workload tests before a wider launch.

## 4. Personas and permissions

- **Individual organizer:** owns templates, versions, batches, data, snapshots, outputs and settings; may access only owned resources.
- **Unauthenticated visitor:** can view public sign-in/privacy information only.
- **Recipient:** not an MVP account type; future email/verification capabilities have their own deferred PRDs.
- **Teams:** explicitly deferred; do not add team features in the MVP.

## 5. Core journey

1. Sign in with Google; Hono verifies identity and issues an application session.
2. Create/open a template and upload a supported PDF directly to private R2 using a short-lived scoped URL.
3. Inspect text/page layout; accept `{{name}}`, `{{date}}`, `{{organization}}` suggestions or manually map a field region; set basic text properties; preview and save as a new immutable template version.
4. Create a batch and import CSV/XLSX. For XLSX, select a worksheet; first non-empty row is the header. Map columns.
5. Validate rows independently; show errors, duplicate warnings and overflow/glyph issues. Invalid rows remain visible; valid rows can proceed.
6. Browse every draft through a paginated/searchable gallery; preview documents on demand; apply inline edits as overrides.
7. Re-import revisions with a diff; match only with reliable unique keys and send ambiguous matches to manual reconciliation.
8. Approve a specific revision; API creates an immutable snapshot of template/source/mapping/data/overrides.
9. Generate via bounded browser Web Worker chunks under one active batch lease; upload each output to R2 and persist checkpoint/status. Poll status; browser closure pauses processing.
10. Download individual documents or a ZIP; split or fail gracefully under measured browser-memory limits. Cancel preserves completed outputs.
11. Retain job files under 24h, 7d or 30d; default 7d. Saved template source persists until template deletion. Daily cleanup sweep retries failed deletes. Physical deletion may lag logical expiry.
12. Email is a future feature: individual attachment per recipient via Hono/server-side provider adapter with quota/expiry preflight. It is not enabled in the first live prototype.

## 6. Binding user decisions

- General-purpose audience and all document categories from launch, constrained by PDF compatibility.
- Existing-PDF-first workflow; text-based PDFs; automatic field suggestions plus confirmed visual fallback; clean placeholder regions when safe masking cannot be established.
- Text/date/number fields; double-brace placeholder convention; basic field controls; fit-then-flag; Unicode only where glyph support and shaping tests pass.
- Capped multi-page PDF support; actual caps benchmarked rather than invented.
- CSV/XLSX; worksheet choice; first non-empty row as header; invalid rows isolated; duplicates warned and preserved.
- Searchable/paginated gallery for all drafts; on-demand preview uses same pipeline as final; inline correction and re-import diff; manual reconciliation if matches are ambiguous.
- Immutable template versions and immutable approved snapshots.
- Browser generation/ZIP with bounded chunks; close pauses work; one active lease per batch; polling; pause/resume/cancel; preserve completed outputs.
- Filename defaults to sanitized recipient name plus template/document label with collision suffix.
- Google Identity Services only; MongoDB-backed hashed session token and HttpOnly cookie; same-origin API arrangement.
- React/Vite/TypeScript, Hono/TypeScript, separate frontend/API repositories, MongoDB, private R2, Zod, OpenAPI; GitHub Actions, npm/lockfiles, supported Node LTS, Vitest and Playwright direction.
- Strict ₹0 budget; Vercel Hobby only private non-commercial prototype candidate; public host remains a blocker.
- 24h/7d/30d retention presets, 7d default, strict deadlines, aggregate counts/timestamps only after personal-data expiry, daily cleanup sweep; template source retained until template delete.
- Private-first launch. Public registration is a future direction with sending safeguards.
- Nodemailer or equivalent was requested for investigation; no email provider/transport is selected.
- Public name/tagline/logo/domain remain unapproved; current title is internal only.

## 7. MVP scope

### Included
Authentication/session; template library/upload/versioning; PDF mapping and preview; spreadsheet import/mapping/validation; draft gallery and reconciliation; approval snapshot; resumable browser generation; individual/ZIP downloads; retention/cleanup/account deletion; CI/security/performance release gates for the private prototype.

### Excluded/deferred
Email delivery; Gmail/Outlook mailbox connection; full Canva-like editor; OCR/scanned PDFs; universal PDF replacement; image/signature fields; credential verification/QR; correction/revocation/reissue; teams; external integrations/public API; product analytics and monetization decisions; final branding and public launch.

## 8. Architecture direction

- Frontend repository: React + Vite + TypeScript.
- API repository: Hono + TypeScript.
- Identity: Google Identity Services, verified server-side (signature, audience, issuer, expiry); key user by Google `sub`, not email.
- Session: opaque random HttpOnly cookie; store only token hash, expiry and revocation state in MongoDB.
- Database: MongoDB for metadata, row states, snapshots, claims, outputs metadata, cleanup tasks and audit-minimal events.
- Object storage: private R2 for template PDFs, job source files, outputs and archives. Direct browser transfer using short-lived scoped URLs.
- PDF: PDF.js for render/text/geometry inspection; `pdf-lib` is a candidate for supported fields/overlays/font embedding. Exact feasibility proven using fixtures.
- Execution: bounded Web Worker chunks and MongoDB claims/leases advanced by the active browser. MongoDB queue records do not execute on their own.
- API contract: OpenAPI and Zod; generate/version frontend client types across repositories. Exact generator tooling remains open.
- Progress: polling persisted server state.
- First prototype: downloads-first, no live email sends.

## 9. Functional requirements

- **FR-01:** Google sign-in, verified identity, secure session, logout and session revocation.
- **FR-02:** Template CRUD, immutable versions, secure upload/reopen/delete.
- **FR-03:** PDF inspection, placeholder suggestions, visual field mapping, basic properties, preview, glyph/mask/overflow warnings.
- **FR-04:** CSV/XLSX import, worksheet/header/column mapping and row-level validation.
- **FR-05:** Browse every draft, inline edits, re-import diffs and explicit reconciliation.
- **FR-06:** Immutable snapshot creation with digest/count verification.
- **FR-07:** Resumable browser-side generation with single batch lease, checkpoints, pause/resume/cancel.
- **FR-08:** Individual downloads and bounded/split ZIP archives.
- **FR-09:** Expiry, cleanup ledger, daily sweep, account deletion and aggregate post-expiry history.
- **FR-10:** Private pilot readiness: CI, safe observability, resource caps, ownership and recovery tests.
- **FR-11 (deferred):** App-managed email with one PDF per recipient, quotas, detailed statuses, retries/reconciliation and strict expiry.

## 10. Non-functional requirements

- **Correctness:** zero wrong-recipient outputs in acceptance tests; no silent clipping; preview/final logic identical.
- **Reliability:** idempotent operations, version checks, persisted checkpoints and recoverable stale leases; progress derived from server state.
- **Security:** object-level authorization on every route, private object storage, server-only secrets, short-lived scoped URLs, upload validation, rate/resource caps and CSRF/origin protections.
- **Privacy:** PII/files expire; no personal row content, PDF text, cookies, tokens, signed URLs or provider secrets in logs; long-term history is aggregate only.
- **Performance:** no fixed SLA; benchmark preview latency, row imports, batch generation, memory and ZIP size before publishing limits.
- **Cost:** hard ₹0. Enforce application quotas and stop at caps; if a compliant public host cannot satisfy ₹0, raise for explicit decision rather than silently paying.
- **Honesty:** browser closure pauses compute; provider acceptance is not guaranteed inbox delivery; infrastructure deletion may lag the logical deadline.

## 11. Success measures (proposed; numeric goals not yet selected)

Template upload/preflight success; placeholder suggestion acceptance and correction rate; import validation time; percent of drafts reviewed; output checksum/recipient mismatch (must be zero in test); resume recovery rate; generation throughput and memory; ZIP completion; cleanup lag/failure count; pilot task success/repeat use. Email metrics begin only after email is approved and enabled.

## 12. Release gates and blockers

1. Validate same-origin routing/cookie/CSRF in actual preview deployment.
2. Prove PDF mapping, masking, Unicode/font behavior, multipage coordinates and preview/final parity on fixtures.
3. Benchmark file/page/row/worker/ZIP limits; do not promise 5,000 rows until evidence passes.
4. Verify MongoDB tier/index/connection constraints and R2 signing/usage/deletion behavior.
5. Implement cleanup ledger and test deletion before using real personal data.
6. Keep email disabled until provider, account eligibility, attachment limits, quota and webhook/reconciliation tests pass.
7. Vercel Hobby is private prototype only under its current applicable terms; public host under strict $0 remains unresolved.
8. Final brand name/tagline/logo/domain and initial market acquisition approach are unselected.

## 13. Definition of done

A slice is done when its real user workflow passes end-to-end; APIs/data contracts and state transitions are tested; authorization, edge cases and user-visible errors are covered; CI passes; logs avoid PII/secrets; acceptance criteria are verifiably satisfied; and unmeasured limits/open decisions remain explicitly labelled.

<!-- End source: 01_MASTER_PRD.md -->


---

<!-- Begin source: 02_VERTICAL_SLICE_MAP.md -->

# Development stages and vertical-slice dependency map

Each stage must deliver a coherent, testable user capability across UI, API, persistence and storage. This is a recommended order; visual design remains flexible.

| Stage | PRD | User-visible outcome | Dependencies | Exit gate |
|---|---|---|---|---|
| 0 | CORE-01 | User signs in and sees a private workspace | Google Identity, Hono, MongoDB sessions, same-origin route | Valid sign-in succeeds; invalid session/cross-user access fails |
| 1 | CORE-02 | User saves and reopens PDF templates | Auth, R2, signed URLs | Private upload and versioned template reuse work |
| 2 | CORE-03 | User maps fields and previews a sample | Template version, PDF.js, overlay generator, fonts | Correct preview, safe unsupported-layout path |
| 3 | CORE-04 | User imports spreadsheet and sees validated rows | Batch, parser, validation rules, MongoDB | Row errors and duplicate warnings are accurate |
| 4 | CORE-05 | User reviews every draft, edits and reconciles re-imports | Preview pipeline, import revisions | No silent row loss/matching |
| 5 | CORE-06 | User approves immutable data/template revision | Template/import versions and row state | Snapshot digest/count stable and immutable |
| 6 | CORE-07 | User generates PDFs with progress/resume | Snapshot, R2, MongoDB lease/checkpoint | Interruption/retries don't duplicate or misassign outputs |
| 7 | CORE-08 | User downloads PDFs/ZIP archives | Output records, signed URLs, ZIP strategy | Archive integrity and limits tested |
| 8 | CORE-09 | Files expire and deletion is retried | All resources plus cleanup ledger | Logical expiry, cleanup retry and account deletion pass |
| 9 | CORE-10 | Maintainer can run private pilot safely | All prior stages, CI, runbooks | Private pilot gates pass; public blocker documented |
| Deferred | D-01 | Send one attached PDF per recipient | Provider/account eligibility, quota/expiry preflight | Correct attachments, reconciliation and abuse controls pass |
| Deferred | D-02 | Lightweight PDF editor | CORE-02/03 | Edits save as immutable template versions |
| Deferred | D-03 | Authenticity verification/QR | Identifier and revocation model | Privacy-minimized public verification |
| Deferred | D-04 | Correct/revoke/reissue document | Snapshots and output lineage | Original/replacement history auditable |
| Deferred | D-05 | Integrations/public API | API security, scopes, quotas | Versioned, rate-limited contract |
| Deferred | D-06 | Teams/workspaces | Authorization abstraction | Tenant and role tests pass |
| Deferred | D-07 | Analytics/monetization exploration | Privacy model, usage/cost data | Metrics data-minimized; pricing validated |
| Deferred | D-08 | Brand and launch readiness | Name/market research, host terms | Truthful claims and availability screening |

## Integration rules

- Auth and PDF fixture work can proceed in parallel, but no real data before ownership/security tests pass.
- Import parsing should use bounded chunks, not one large JSON request.
- Review and snapshot creation must agree on import revisions, manual overrides, validation and canonical digest.
- One browser dispatcher owns a batch lease. The MongoDB queue records work but doesn't autonomously execute.
- Browser close pauses generation; persisted checkpoints enable recovery on return.
- Outputs are durable in R2, not only in browser memory. ZIP generation has tested memory/splitting limits.
- Retention and deletion are required before real-data pilots.
- Email is not a dependency of generation/downloads and remains disabled in the first live prototype.

## Release checkpoints

1. **Local proof:** local/test auth and synthetic PDF fixture; no personal recipients.
2. **Private integration prototype:** real Google sign-in, MongoDB, R2 and one supported PDF-to-download path.
3. **Private pilot:** retention, deletion, recovery and security tests pass using a limited test group.
4. **Public eligibility gate:** find compliant hosting under hard ₹0 terms or raise the conflict for a direct user decision. Do not infer approval for paid services.

<!-- End source: 02_VERTICAL_SLICE_MAP.md -->


---

<!-- Begin source: 03_UI_ROUTES_AND_COMPONENT_INVENTORY.md -->

# UI routes, layouts and component inventory

**Purpose:** Functional information architecture only. No pixel-perfect styling, palette, font, animation or final design system is prescribed.

## Route inventory (proposed)

| Route | Access | Main purpose | Required states |
|---|---|---|---|
| `/sign-in` | Public | Google sign-in/error recovery | idle, authenticating, failed, unavailable |
| `/app` | Authenticated | Dashboard/recent work | loading, empty, populated, partial failure |
| `/app/templates` | Authenticated | Template library/search | loading, empty, populated, error |
| `/app/templates/new` | Authenticated | Upload/preflight new PDF | selecting, uploading, inspecting, supported, warning, unsupported, failed |
| `/app/templates/:templateId` | Owner | Template detail/version list | loading, active, deleted/unavailable, error |
| `/app/templates/:templateId/versions/:versionId` | Owner | Mapping and formatting editor (not full design editor) | inspecting, mapping, preview, warning, saved/conflict |
| `/app/batches/new` | Authenticated | Select template/start batch | loading, selection, error |
| `/app/batches/:batchId/import` | Owner | Import CSV/XLSX and map columns | parsing, worksheet selection, mapping, invalid rows, ready, error |
| `/app/batches/:batchId/review` | Owner | Draft gallery/inline edit/re-import diff | loading, gallery, preview, edit, conflict/reconciliation |
| `/app/batches/:batchId/approve` | Owner | Validate and approve snapshot | ready, blocked, snapshot building, conflict, approved |
| `/app/batches/:batchId/progress` | Owner | Generation status and controls | queued, active, paused, recovering, cancelling, partial, failed, completed |
| `/app/batches/:batchId/results` | Owner | Individual/ZIP downloads | generating, ready, partial, ZIP building, expired, cleanup warning |
| `/app/settings/retention` | Authenticated | Default and per-job retention | loaded, saving, error |
| `/app/settings/account` | Authenticated | Sign-out/account deletion | normal, confirmation, deletion pending, signed out |
| `/privacy` | Public | Privacy/retention disclosure | content, unavailable notice |

Exact URL syntax can be refined, but step-specific persistent routes are the selected direction so refresh/back/forward can recover the correct step from server state.

## Layouts

### Public layout
Work title (internal working name), Google sign-in, status/error region, privacy link when copy is finalized.

### Authenticated shell
Header/account menu, navigation to templates/recent batches/settings, breadcrumb/current step, accessible status/error region, main content. Exact layout and styling are open.

### Batch workflow layout
Step sequence: template → import → review → approve → progress → results. Backend lifecycle controls permitted actions; front-end state alone cannot approve/complete work. Avoid exposing full names/emails in URLs or global navigation.

## Component inventory

### Shared/auth
`AppRouter`, `AuthGuard`, `SessionBootstrap`, `RouteErrorBoundary`, `AppShell`, `PageHeader`, `Breadcrumbs`, `StatusBanner`, `LoadingState`, `EmptyState`, `InlineError`, `ConfirmDialog`, `NoticeRegion`, `AccountMenu`, `GoogleSignInButton`, `SessionExpiredDialog`, `SignOutAction`, `DeleteAccountDialog`.

### Template/upload
`TemplateLibrary`, `TemplateCard/Row`, `TemplateSearch`, `NewTemplateAction`, `PdfUploadDropzone`, `UploadProgress`, `PdfCompatibilityReport`, `TemplateVersionList`, `TemplateDeleteDialog`.

### PDF mapping/preview
`PdfDocumentViewport`, `PdfPageNavigator`, `PdfPageThumbnailStrip`, `DetectedTokenList`, `FieldOverlayLayer`, `FieldSelectionTool`, `FieldPropertiesPanel`, `FontSelector`, `FontGlyphWarning`, `MaskPreview`, `TextFitPreview`, `LayoutWarningList`, `PreviewDocumentPane`, `PreviewLoadState`.

### Import/review
`DataFilePicker`, `WorksheetSelector`, `ImportSchemaSummary`, `ColumnMappingTable`, `ImportValidationSummary`, `RowErrorTable`, `DuplicateWarning`, `RowEditor`, `ReimportDiffReview`, `MatchResolutionTable`, `DraftGallery`, `RecipientPreviewPanel`, `OverflowBadge`, `DraftNavigation`, `FilterByIssue`, `InlineFieldEditor`.

### Approval/generation
`SnapshotDiffSummary`, `ApprovalCounts`, `ApprovalConfirmation`, `GenerationProgress`, `PhaseProgressSummary`, `RecipientStatusTable`, `PauseResumeControls`, `CancelJobDialog`, `LeaseStatusIndicator`, `ResumePrompt`, `PollStatusHook`.

### Downloads/retention
`OutputTable`, `OutputDownloadAction`, `ZipArchiveList`, `ArchiveSizeEstimate`, `SplitArchiveNotice`, `ExpiryCountdown/Label`, `ExpiredOutputNotice`, `CleanupStatusNotice`, `RetentionPresetSelector`.

## Required UI states

Every route defines loading, empty, success, validation error, recoverable error, terminal error, permission denial, resource expired/deleted and stale revision states as relevant. Polling reflects persisted server state; transport failure never resets progress to zero. Gallery is searchable/paginated so users can browse every draft without opening thousands of tabs. PDF canvas is paired with accessible field/value/error information.

## Design-neutral constraints

- Do not prescribe brand colors, fonts, rounded corners, shadows, animation or density.
- Table/list/gallery are implementation choices as long as functional flows remain.
- Primary test target: latest stable Chrome/Edge desktop; current Firefox secondary; Safari/mobile support provisional until benchmarked.

<!-- End source: 03_UI_ROUTES_AND_COMPONENT_INVENTORY.md -->


---

<!-- Begin source: 04_DOMAIN_MODEL_AND_API_CONTRACTS.md -->

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

### `outputs`
`_id`, owner/batch/snapshot/recipient IDs, kind `pdf|zip|manifest|preview`, opaque R2 key, checksum/bytes, safe file name, status, created/expiry times. One output must be associated with one recipient or clearly defined archive scope.

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

### Generation/output
- `POST /api/batches/:id/generation/claim`
- `POST /api/batches/:id/generation/checkpoint`
- `POST /api/batches/:id/pause`, `/resume`, `/cancel`
- Scoped upload authorization/completion for output PDFs
- `GET /api/batches/:id/outputs`
- `POST /api/outputs/:outputId/download-url`

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

<!-- End source: 04_DOMAIN_MODEL_AND_API_CONTRACTS.md -->


---

<!-- Begin source: 05_CROSS_CUTTING_REQUIREMENTS.md -->

# Cross-cutting functional, security, privacy and operational requirements

## Security and authorization

- Verify Google ID tokens server-side: signature, issuer, audience, expiry. Key identity by `sub`, not email.
- Use a cryptographically random opaque application session in Secure/HttpOnly cookie; store hash, expiry and revocation in MongoDB. Cookie domain/SameSite, rotation, CSRF and Origin checks must be verified against actual same-origin deployment.
- Every API route authorizes owner for every template/version/batch/import/row/snapshot/output/cleanup operation. Ignore client-supplied `ownerId`.
- Browser never connects to MongoDB or receives R2 secret credentials/email provider secret. Use short-lived scoped signed URLs and server-generated opaque object keys.
- Treat PDF/CSV/XLSX and metadata as untrusted. Validate signature and parseability, enforce configurable byte/page/row/CPU/memory limits, and handle malformed inputs safely.
- Rate-limit auth, uploads, URL issuance, row chunks, claims/checkpoints, deletion and abuse-sensitive endpoints. Enforce app-level storage/operation caps under hard ₹0 budget.
- Keep secrets server-only. Every `VITE_*` variable is public. No MongoDB/R2/session/email secret in frontend bundle.

## PDF correctness

- PDF.js for render/inspection/coordinate extraction; `pdf-lib` is a candidate for supported form fields/text drawing/overlays. Arbitrary existing PDF text cannot be universally edited in place.
- Standard token syntax: `{{name}}`, `{{date}}`, `{{organization}}`. Detection suggests; user confirms or visually maps.
- Require clean placeholder region when safe masking cannot be inferred. Flag/reject layouts where a mask may damage artwork; do not promise background reconstruction.
- Field types text/date/number. Basic controls include position/box, font, size range, color, alignment, mask and fit mode.
- Fit-then-flag: shrink only within configured bounds; flag unresolved overflow. Never silently clip.
- Unicode only when selected/embedded font covers glyphs and shaping tests pass. Missing glyphs block/flag; no silent substitution.
- Multi-page support is capped by benchmark. Scanned/image-only PDFs and OCR are not MVP promises.
- Preview and final generation use the same processing path.

## Import/review

- CSV/XLSX; XLSX worksheet selected by user; first non-empty row is header. Blank/duplicate headers must be explicitly reported.
- Dates/numbers use documented explicit parsing; ambiguous locale values are flagged. Formula cells with unreliable/missing cached values are not guessed.
- Server revalidates rows; don't trust client validity flags.
- Invalid rows isolated and correctable. Duplicate records/emails warned and preserved. No default merge by email.
- Inline edits are overrides; re-import creates a new revision/diff. Match reliable unique keys only; ambiguous matching must be manual. Never silently match by row order or non-unique name/email.

## Snapshot/generation

- Snapshot contains template version/source checksum, mapping/style hash, import revision, effective data, overrides and canonical digest.
- Staged snapshot is approved only after count/digest reconciliation.
- Each output tied to an immutable snapshot recipient.
- One active browser lease per batch. Chunk and concurrency limits configurable and benchmarked.
- Browser closure pauses work; persisted checkpoints enable resume after return.
- Cancel at safe boundary; preserve completed files. ZIP is bounded/split or stopped gracefully under tested cap.

## Retention/deletion

- Allowed presets: 24 hours, 7 days, 30 days; 7-day default, 30-day max.
- Saved template PDF retained until template deletion. Job imports, row PII, snapshots, previews, outputs and ZIPs follow job retention.
- Abandoned draft retention starts at creation; output timer starts when generation reaches terminal state; exact expiry is persisted and never silently extended.
- After job expiry, keep aggregate counts/timestamps only. Future unsent mail expires as `expired_unsent`.
- Daily cleanup sweep issues direct R2 deletes and records/retries errors; R2 lifecycle is backstop; MongoDB TTL is not cleanup for R2.
- Enforce logical expiry immediately, deny fresh download URLs and remove regular UI access even if physical deletion pending. Disclose possible physical deletion delay.
- Account deletion requires confirmation, immediate session revocation, stop new work and schedule owned-resource deletion. Retain only non-identifying cleanup evidence.

## Logging, errors and accessibility

- Structured logs: request ID, operation/resource IDs that are non-sensitive, phase, duration, counts and safe error codes.
- Never log full rows, names/emails, PDF content/text, cookie/token, signed URL, stack trace to user, or secrets.
- Persist progress; polling reflects server-confirmed state. Distinguish validation, unsupported file, permissions, quota, transient service error, lease loss, expiry and cleanup failure.
- Keyboard-accessible controls, semantic form labels and error associations, clear focus behavior, and a field/value/errors alternative to canvas-only PDF display.
- Search/pagination/filtering on draft gallery. Every page needs loading, empty, error, permission, expired/deleted and stale-revision states as relevant.

## Cost and hosting constraints

- Hard zero-cost budget is binding. Any plan that can create overage must be capped in application logic or omitted.
- Vercel Hobby is a private personal/non-commercial prototype candidate only under current terms; public service is blocked until eligible no-cost hosting is verified.
- MongoDB work records are not an autonomous queue; the active browser advances prototype work. Do not imply continuous background execution.
- Email is deferred. Nodemailer does not bypass provider quota; provider and transport are unselected.

<!-- End source: 05_CROSS_CUTTING_REQUIREMENTS.md -->


---

<!-- Begin source: 06_TEST_AND_RELEASE_PLAN.md -->

# Test strategy, acceptance gates and release plan

## Test layers

- **Unit:** CSV/XLSX normalization, token suggestions, coordinate transforms, mask checks, fit rules, Unicode glyph validation, snapshot digest, filename sanitizer, retention deadlines, status transitions and idempotency keys.
- **Component:** upload states, mapper/property panel, import mapping, row errors, draft gallery, re-import conflicts, approval summary, progress controls, downloads and expiry warnings.
- **API/contract:** Hono + Zod + OpenAPI; ownership, cookie/session, imports/chunk idempotency, claims/checkpoints, signed URL scope, lifecycle transitions and safe error envelope.
- **Integration:** Google token verification, MongoDB indexes, R2 upload/download/delete, row imports, generation checkpoint, cleanup sweep.
- **E2E (Playwright):** Sign-in/test fixture → template upload → mapping → CSV/XLSX import → review/edit/re-import → approve → generate → download/ZIP → expiry/cleanup simulation.
- **Performance/resource:** PDF fixtures, multipage/font cases, browser worker memory, repeated chunks, ZIP split limit, Atlas connection/index use, R2 usage caps.
- **Security:** cross-user access, expired/reused signed URL, malformed/oversized files, hostile filenames, CSRF/session revocation, content-type mismatch, key guessing, rate limits, cleanup authorization.
- **Manual:** gallery on large synthetic batches, long/Unicode strings, rotated pages, browser interruption/resume, low-memory device behavior.

## Fixture corpus

1. Single-page certificate with `{{name}}` and `{{date}}` in clean field regions.
2. Multi-page text PDF with fields on distinct pages.
3. Embedded font and supported Unicode script fixtures.
4. Long names/values causing shrink/overflow.
5. Rotated page/non-default dimensions.
6. Text region over unsafe pattern/artwork; expected warning/unsupported result.
7. Token split across PDF text fragments.
8. Scanned/image-only PDF; unsupported; no OCR claim.
9. Corrupt/encrypted/password-protected PDF.
10. CSV/XLSX with blank/duplicate headers, missing values, date/number ambiguity, formula with no cached value, duplicates and Unicode.
11. Batch sizes tested progressively at 500, 1,000 and 5,000 rows; maximum advertised capability only after measurements pass.

## Acceptance gates

### Identity/ownership
- Invalid Google ID-token claims rejected; sessions can be revoked; cookie behavior matches deployed topology.
- Cross-user template/batch/row/output requests denied.
- No DB/R2/session/email secrets in web bundle.

### Template/PDF
- Source remains private and reopens for owner only.
- Coordinates correct across scale/rotation/multipage fixture.
- Unsafe mask, missing glyph and overflow surfaced; no silent clipping or wrong output.
- Preview and final output use the same logic and pass text/raster baseline.

### Import/review/snapshot
- Header/worksheet rules applied; valid/invalid rows separated; duplicates preserved with warnings.
- Inline edits survive refresh and revalidate; re-import diff/manual match rules hold.
- Snapshot contains hashes/effective data and cannot mutate after approval.

### Generation/recovery
- Benchmarks completed before hard cap published.
- Close/reopen/refresh pauses then resumes without duplicate outputs or incorrect counters.
- Two-tab claim race permits one active lease; stale lease writes rejected.
- Pause/cancel at safe boundary; completed outputs preserved.
- Per-recipient failure does not block unrelated rows unless error is systemic.

### Downloads/retention
- ZIP entries map to outputs/recipients; no cross-owner or expired URL access.
- ZIP memory threshold respected or output split/gracefully stopped.
- Expired URL not issued; cleanup failures persisted/retried; PII removed from normal access/history.
- Account deletion revokes session immediately and schedules owned resource deletion.

### Future email gate
- Provider and sender eligibility, attachment size, quota and webhook validation verified.
- Different output attachment sent to correct recipient only.
- Send preflight respects strict expiry; ambiguous outcomes reconcile before retry; duplicate webhooks idempotent.
- Bounces/complaints suppressed and abuse/kill controls in place.

### Private pilot/public launch gate
- CI: format/lint/typecheck/unit/API contract/Playwright/build/dependency checks pass.
- Hard free-tier limits and error states tested.
- Cleanup/runbook and privacy language match behavior.
- Private prototype hosting use permitted; public launch blocked until a qualifying ₹0 host is verified or budget decision changes.
- Email remains disabled during downloads-first prototype.

## Key test matrix

| ID | Scenario | Expected result |
|---|---|---|
| OWN-01 | User guesses another user's output ID | safe denial; no signed URL |
| UP-01 | Non-PDF content named `.pdf` | reject before template activation |
| PDF-01 | Long value doesn't fit | shrink within bounds, then flag; never clip silently |
| FONT-01 | Missing glyph | visible error/blocker; no silent substitution |
| IMP-01 | Formula has no cached value | field flagged; no guessed value |
| IMP-02 | Repeated email | all rows preserved with warning |
| REV-01 | Re-import has no unique key | manual reconciliation; no positional merge |
| SNAP-01 | Template edited after approval | existing snapshot output unchanged |
| GEN-01 | Upload succeeds, checkpoint fails | resume reconciles output/checksum; no duplicate output |
| GEN-02 | Two tabs claim work | only one valid lease |
| GEN-03 | Cancel during chunk | safe-boundary cancellation; completed files remain |
| ZIP-01 | ZIP exceeds cap | split/stop gracefully with useful message |
| EXP-01 | Output expired | no new URL; future queued send becomes `expired_unsent` |
| CLN-01 | R2 delete fails | cleanup task stays pending/retryable |
| SES-01 | Revoked session reused | API denies access |

## Metrics (privacy-minimized)

Time to first preview; import validation duration; preview errors; generation throughput/memory; resume success; output mismatch (must be zero in tests); ZIP completion/split rate; R2 usage; cleanup lag/failures; API error rate and test pass rates. No recipient/document contents in analytics. Email metrics are deferred.

<!-- End source: 06_TEST_AND_RELEASE_PLAN.md -->


---

<!-- Begin source: PRD-CORE-01-AUTH-AND-SESSION.md -->

# PRD-CORE-01 — Google sign-in, application session and protected workspace

**Status:** Core MVP · P0. Exact route/schema names are implementation proposals.

## Objective

Securely authenticate individual organizers through Google Identity Services, verify identity in Hono, create a revocable MongoDB-backed application session, and ensure that each user can access only resources they own.

## User stories

- As a new organizer, I can sign in with Google and enter the workspace.
- As a returning organizer, I can refresh/reopen the app while the session remains valid.
- I can sign out and have the old session rejected.
- I cannot access another user's resources by guessing IDs or changing URLs.

## Scope

Google-only sign-in; server-side ID token verification; user upsert keyed by Google `sub`; opaque session token stored as a hash in MongoDB; HttpOnly cookie; session bootstrap/revocation; route guards; ownership middleware; minimal dashboard shell.

## Non-goals

Passwords, other identity providers, teams/RBAC, recipient portal and finalized brand styling.

## End-to-end flow

1. `/sign-in` displays GIS control and accessible progress/error state.
2. Browser posts credential to `POST /api/auth/google` via same-origin API.
3. Hono verifies signature, issuer, audience and expiration; invalid tokens fail closed.
4. Upsert user using verified `sub`; email is profile data, not key.
5. Generate high-entropy opaque session token; store hash, user, expiry and revocation state; set secure HttpOnly cookie.
6. App calls `GET /api/session` before rendering protected routes.
7. Logout calls `POST /api/auth/logout`, revokes server session and clears cookie.

## Routes and components

Routes `/sign-in`, `/app`, and settings account route. Components: `GoogleSignInButton`, `AuthErrorNotice`, `SessionBootstrap`, `AuthGuard`, `SessionExpiredDialog`, `AccountMenu`, `SignOutAction`, `RouteErrorBoundary`, `AppShell`. Visual treatment remains open.

## API/data

- `POST /api/auth/google`: accepts Google credential; returns safe profile and sets cookie. Must not echo credential.
- `GET /api/session`: returns safe user/session status.
- `POST /api/auth/logout`: revokes session and clears cookie.
- Collections: `users` (`googleSub` unique), `sessions` (`tokenHash` unique, expiry/user indexes).
- Cookie flags and session TTL/rotation must match final same-origin topology; exact settings are still implementation decisions.

## States and failures

Invalid token claims, expiry, DB outage, session persistence failure, revoked/expired session, Google config outage, CSRF/origin mismatch. Failure to verify/persist identity must fail closed. No insecure client-trusted fallback.

## Security/privacy

Token verification server-side; random session token, hash at rest; origin/CSRF protection even for same-site cookies; rate limits; never log credentials/cookie; no credentials in frontend bundle.

## Acceptance criteria

- AC1: Repeat login for same Google `sub` resolves to same account.
- AC2: Wrong signature/issuer/audience/expiry is rejected without a session.
- AC3: Session survives refresh and is revoked on logout.
- AC4: Expired/revoked sessions fail protected API calls.
- AC5: Cross-user resource access tests deny access.
- AC6: Raw cookie/session token is not stored/logged; production bundle contains no secret.

## Tests

Token-claim matrix, repeat login, expiry/revocation, CSRF/origin, DB outage, cross-tenant ID enumeration, log/bundle secret scan, Playwright login/refresh/logout.

## Dependencies/gate

Google client setup, Hono, MongoDB, same-origin deployment. No real recipient data before identity and ownership tests pass.

## Open details

Exact cookie lifetime/rotation, Google client IDs, CSRF mechanism, cookie path/attributes and local/test auth separation. Public hosting remains unresolved under ₹0.

<!-- End source: PRD-CORE-01-AUTH-AND-SESSION.md -->


---

<!-- Begin source: PRD-CORE-02-TEMPLATE-LIBRARY-AND-UPLOAD.md -->

# PRD-CORE-02 — Template library, immutable versions and secure PDF upload

**Status:** Core MVP · P0.

## Objective

Enable a user to upload a supported PDF into private R2 storage, save/reopen it as a reusable template, create immutable template versions, and delete a template intentionally. Template source files stay until template deletion; job data has separate retention.

## User stories

- I can create, list, search and reopen my templates.
- I see upload, compatibility and failure status.
- Editing a template creates a new version and does not mutate a version used by an approved batch.
- I can delete a template after explicit confirmation and understand cleanup status.

## Scope / non-goals

Scope: template metadata; direct browser-to-R2 upload through a short-lived scoped signed URL; server-side finalization checks; version list/create; rename; source URL; delete and cleanup scheduling. Not scope: full editor, arbitrary/scanned PDF support, team sharing, public links or email.

## End-to-end flow

1. User opens `/app/templates`, selects new template and file.
2. Client checks extension/size for feedback; Hono issues upload URL for a random server-generated object key.
3. Browser uploads to private R2 directly, not through a large API payload.
4. Browser submits completion; server checks object existence, byte size, checksum where supported, signature/parseability and configured prototype caps.
5. Create template + first `templateVersions` record with checksum/size/page count/compatibility result.
6. User can reopen template; source URL is short-lived and owner-scoped.
7. Mapping/style edits later create a new immutable version.
8. Delete confirmation immediately blocks new use and enqueues cleanup of every version object. Existing batch dependencies must be handled safely, never deleted mid-generation without explicit state transition.

## Routes/components

`/app/templates`, `/app/templates/new`, `/app/templates/:templateId`. Components: `TemplateLibrary`, `TemplateSearch`, `TemplateCard/Row`, `PdfUploadDropzone`, `UploadProgress`, `PdfCompatibilityReport`, `TemplateVersionList`, `TemplateDeleteDialog`, `TemplateEmptyState`.

## API/data

`GET/POST /api/templates`; `GET /api/templates/:id`; `POST /api/templates/:id/uploads`; completion endpoint; `GET /api/templates/:id/versions`; `POST /api/templates/:id/versions`; scoped source URL; `DELETE /api/templates/:id`. Collections: `templates`, `templateVersions`, `cleanupTasks`, minimal `auditEvents`.

## States/errors

Selecting, uploading, validating, active, warning, unsupported, upload failed, authorization denied, URL expired, R2 unavailable, duplicate completion, delete pending, delete failed. Retry completion idempotently; malformed files never activate silently.

## Security/privacy

Private bucket; opaque server-generated keys; short-lived URL; owner check; byte/signature validation; rate/storage limits; never log signed URLs. Files are untrusted inputs.

## Acceptance criteria

- AC1: Owner creates/lists/opens template; non-owner cannot access metadata or source.
- AC2: Upload bytes bypass API server payload.
- AC3: Server finalization stores checksum, bytes and page count.
- AC4: Version numbers are unique and versions immutable.
- AC5: Source persists until template deletion.
- AC6: Deletion enqueues every template object and reports pending/failure truthfully.
- AC7: Corrupt/non-PDF/unsupported source isn't activated.

## Tests

Real/fake PDF signatures, truncated/encrypted PDFs, URL expiry, duplicate completion, cross-owner, guessed object key, R2 outage, concurrent version creation, template deletion with active job, cleanup failure.

## Dependencies/gate

CORE-01, MongoDB, private R2, PDF.js preflight. Use synthetic files first.

## Open details

Max bytes/pages, encrypted file policy, exact source deletion/dependency semantics, R2 verification behavior and eligible public host.

<!-- End source: PRD-CORE-02-TEMPLATE-LIBRARY-AND-UPLOAD.md -->


---

<!-- Begin source: PRD-CORE-03-PDF-MAPPING-AND-PREVIEW.md -->

# PRD-CORE-03 — PDF inspection, field mapping, field styling and preview

**Status:** Core MVP · P0 · Highest PDF feasibility risk.

## Objective

Map data fields to a supported existing PDF with automatic placeholder suggestions and a visual fallback. Require user confirmation, basic formatting controls and an accurate preview made by the same processing pipeline as final output.

## User stories

- I can inspect page text and see suggested `{{fieldKey}}` candidates.
- I can confirm a detected token or manually draw/select the variable region.
- I can set field position/box, font, size, color, alignment and masking options.
- I see overflow, unsafe background and missing-glyph warnings before approval.
- I can save changes as a new immutable template version.

## Scope / exclusions

Scope: PDF.js render/text/geometry; double-brace token suggestion; visual field placement; capped multi-page fields; text/date/number types; basic styling; fit-then-flag; Unicode glyph validation; on-demand preview through same generator; mapping hash and version save. Excludes OCR, universal arbitrary text replacement, background reconstruction, image/signature fields and full Canva-like editing.

## End-to-end flow

1. Load a template version and render pages using PDF.js.
2. Inspect searchable text and geometry; propose detected placeholders/regions but apply none silently.
3. User confirms a suggestion or places a field region; transform viewport coordinates to canonical page coordinates accounting for scale and rotation.
4. User sets field key/type and basic controls (box, font/family, size limits, color, alignment, mask, fit behavior).
5. Preview sample/long values through same PDF generation logic then render output with PDF.js.
6. If solid masking may cover artwork or backgrounds, flag/reject unless a clean replacement area is confirmed.
7. Check selected/embedded font has required glyphs; unsupported character shaping becomes a visible blocker/warning.
8. Save confirmed mapping as a new immutable template version.

## Routes/components

`/app/templates/:templateId/versions/:versionId`. Components: `PdfDocumentViewport`, `PdfPageNavigator`, `PdfPageThumbnailStrip`, `DetectedTokenList`, `FieldOverlayLayer`, `FieldSelectionTool`, `FieldPropertiesPanel`, `FontSelector`, `FontGlyphWarning`, `MaskPreview`, `TextFitPreview`, `LayoutWarningList`, `PreviewDocumentPane`.

## API/data

Source URL API and `POST /api/templates/:id/versions`. `templateVersions.fieldMappings` records key, label/type, page index, canonical geometry, font, size bounds, fit mode, mask mode/color and format. Browser detection is a suggestion; server validates mapping structure/ownership before saving.

## States/errors

No searchable text; split token fragments; unclear detection; unsafe background; missing glyph; overflow; rotated page; preview worker error; version conflict. Manual mapping may be used for supported text PDFs but does not mean OCR is supported.

## Acceptance criteria

- AC1: Token suggestions appear where detectable and never auto-apply without confirmation.
- AC2: Visual mapping works for supported PDFs when auto detection fails.
- AC3: Coordinate mapping respects scale/rotation/multipage fixtures.
- AC4: Preview and final use identical generation code.
- AC5: Fit-then-flag prevents silent clipping.
- AC6: Missing glyph and unsafe mask are surfaced.
- AC7: Save creates new version; old mapping/hash remains unchanged.
- AC8: Fixture output passes visual/text parity test.

## Tests

Tokens intact/split; manual mapping; zoom/rotation; multi-page; long text; Unicode present/missing glyph; clean/unsafe backgrounds; embedded fonts; encrypted/corrupt PDFs; worker failure; preview/final parity.

## Dependencies/gate

CORE-02, PDF.js and a proven generation/overlay library (`pdf-lib` is a candidate), font selection/embedding/shaping tests and a fixture corpus.

## Open details

Library feasibility, coordinate convention, minimum font size, mask policy, font shaping and file/page limit must be settled by prototype, not assumed.

<!-- End source: PRD-CORE-03-PDF-MAPPING-AND-PREVIEW.md -->


---

<!-- Begin source: PRD-CORE-04-SPREADSHEET-IMPORT-AND-VALIDATION.md -->

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

<!-- End source: PRD-CORE-04-SPREADSHEET-IMPORT-AND-VALIDATION.md -->


---

<!-- Begin source: PRD-CORE-05-DRAFT-REVIEW-AND-RECONCILIATION.md -->

# PRD-CORE-05 — Draft gallery, inline correction and re-import reconciliation

**Status:** Core MVP · P0.

## Objective

Let organizers browse every draft before approval, inspect on-demand previews, edit values inline, and reconcile updated spreadsheet revisions without losing or silently reassigning records.

## User stories

- I can search/filter/page through all drafts and open any individual preview.
- I can correct a value inline and see validation update.
- I can import a new spreadsheet revision, review added/removed/changed rows and resolve ambiguous matches manually.
- I can see duplicate, overflow, invalid and preview-error states clearly.

## Scope / exclusions

Searchable/paginated gallery, on-demand preview, inline overrides, revision-aware row editing, re-import diff, reliable key matching, manual reconciliation, warnings and stale revision control. Excludes collaborative review, multiple approvers, team access and silent auto-merge by position/name/email.

## End-to-end flow

1. Review page displays server-calculated counts and issue filters.
2. Gallery lists rows and allows search/filter across all records, not just loaded page.
3. Opening a row loads needed data and renders its draft on demand via the same PDF pipeline as final generation.
4. Inline edit submits an override with expected row/import revision. API recomputes effective values and errors.
5. Re-import produces a new revision and diff.
6. Match rows only by a reliable chosen unique key. No key/collision/ambiguous match goes to manual resolution; never auto-match by row position or a non-unique field.
7. User confirms matches/new/removed records and sees conflicts. Override carry-forward must follow an explicit merge rule, and conflicting overrides cannot be silently applied.
8. Any material edit/re-import invalidates stale previews and the approval summary.

## Routes/components

`/app/batches/:batchId/review`. Components: `DraftGallery`, `RecipientPreviewPanel`, `RowEditor`, `FilterByIssue`, `OverflowBadge`, `ReimportDiffReview`, `MatchResolutionTable`, `DuplicateWarning`, `ImportRevisionSelector`, `InlineFieldEditor`.

## API/data

Paged `GET /api/batches/:id/rows`; `PATCH /api/batches/:id/rows/:rowId` with expected revision; re-import reconciliation endpoint receiving explicit old/new pair decisions. Collections `draftRows` and `batchImports`; imported data and overrides remain distinct.

## States/errors

Loading/empty/all-clear; invalid rows; preview loading/error; edit conflict; re-import analyzing; unresolved matching; confirmed reconciliation; stale row revision; expired/deleted resource.

## Acceptance criteria

- AC1: Every draft is reachable through search/pagination.
- AC2: Preview uses same pipeline as final generation.
- AC3: Inline edits persist and revalidate after refresh.
- AC4: Re-import shows added/removed/changed/conflicted records.
- AC5: Ambiguous matches require manual resolution.
- AC6: Duplicate warnings do not drop records.
- AC7: Edit/re-import invalidates stale approval state.
- AC8: Cross-user rows/previews are inaccessible.

## Tests

Review row 5,000; filter consistency; edit/refresh; concurrent edit; repeated names/email; no-key re-import; changed key; override conflict; new/removed records; preview cache stale; 5k gallery performance.

## Dependencies/gate

CORE-03/04, import revision model, stable pagination and reconciliation algorithm. Approval cannot be built before matching rules are implemented.

## Open details

Matching-key UX, exact override carry-forward policy, page size and cache/memory limit are to be validated; no automatic merge semantics may be invented.

<!-- End source: PRD-CORE-05-DRAFT-REVIEW-AND-RECONCILIATION.md -->


---

<!-- Begin source: PRD-CORE-06-APPROVAL-AND-IMMUTABLE-SNAPSHOT.md -->

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

<!-- End source: PRD-CORE-06-APPROVAL-AND-IMMUTABLE-SNAPSHOT.md -->


---

<!-- Begin source: PRD-CORE-07-RESUMABLE-PDF-GENERATION.md -->

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

<!-- End source: PRD-CORE-07-RESUMABLE-PDF-GENERATION.md -->


---

<!-- Begin source: PRD-CORE-08-DOWNLOADS-AND-ZIP.md -->

# PRD-CORE-08 — Individual PDF downloads and bounded ZIP packaging

**Status:** Core MVP · P0; output sizes measured.

## Objective

Let users download generated PDFs individually or as ZIP archives, with correct recipient mapping, safe deterministic file names, partial-result visibility and expiry enforcement.

## User stories

- I can download each completed PDF.
- I can download a ZIP of completed outputs.
- Large results split into multiple archives or stop with a clear recoverable path if they exceed safe browser limits.
- I can see generated/failed/cancelled counts and expiration.

## Scope / exclusions

Results route, paginated output listing, short-lived scoped download URLs, filename sanitization, collision suffixes, bounded/split browser ZIP generation, optional manifest (inclusion default still proposed), checksums and expiry. Excludes email, public links, cloud drive export and long-term archive.

## End-to-end flow

1. Results route loads status, counts, file sizes, expiry and cleanup state.
2. Individual download requests a short-lived URL from Hono after owner/expiry check and downloads directly from R2.
3. ZIP action chooses completed eligible outputs and packages them in bounded/streaming chunks supported by tested browser implementation.
4. If ZIP exceeds tested memory cap, split into numbered archives or stop gracefully rather than accumulate unbounded in-memory bytes.
5. Filename default is sanitized recipient name + template/document label + stable collision suffix. Strip path separators, control/reserved characters and overlong names.
6. If outputs are partial, report which files are included; do not misrepresent failed/skipped records as generated.
7. Expired outputs cannot be issued fresh URLs.

## Routes/components

`/app/batches/:batchId/results`; `OutputTable`, `OutputDownloadAction`, `ZipArchiveList`, `ArchiveSizeEstimate`, `SplitArchiveNotice`, `ExpiryCountdown/Label`, `ExpiredOutputNotice`, `CleanupStatusNotice`.

## API/data

`GET /api/batches/:id/outputs`; `POST /api/outputs/:id/download-url` with owner and expiry check. Output records identify snapshot/recipient, object key, checksum/bytes, safe name, kind/status and expiry.

## States/errors

Generating, ready, partial, ZIP building, ZIP ready, ZIP failed, missing output, expired, download denied, cleanup pending. If signed URL expires during download, request a new one only while output is still eligible. Archive must handle missing items according to explicit consistency behavior and report it.

## Security/privacy

Private R2, short-lived scoped URLs, authorization before URL issue, no public/shared URLs, sanitize filenames/path traversal, no signed URL in logs, only include outputs from user's selected snapshot.

## Acceptance criteria

- AC1: Owner can individually download outputs before expiry.
- AC2: Non-owner/expired requests cannot get URLs.
- AC3: ZIP content maps to successful output records/recipients.
- AC4: Filename sanitization and collision suffix prevent overwrite/path traversal.
- AC5: Oversized archive splits or stops gracefully within measured limits.
- AC6: Partial result summary is accurate.
- AC7: Expiration/cleanup state shown to user.

## Tests

Normal ZIP, Unicode/collision/hostile filenames, missing output, expired object, partial generation, size boundary, split archive count, checksum, cross-user access, URL expiration mid-download.

## Dependencies/gate

CORE-07, R2 output metadata and tested ZIP strategy. This slice completes the download-first primary user journey.

## Open details

ZIP library/streaming, split threshold, manifest default/content, byte caps and low-memory browser performance.

<!-- End source: PRD-CORE-08-DOWNLOADS-AND-ZIP.md -->


---

<!-- Begin source: PRD-CORE-09-RETENTION-AND-ACCOUNT-DELETION.md -->

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

<!-- End source: PRD-CORE-09-RETENTION-AND-ACCOUNT-DELETION.md -->


---

<!-- Begin source: PRD-CORE-10-PRIVATE-PILOT-AND-OPERATIONAL-READINESS.md -->

# PRD-CORE-10 — Private pilot, CI/CD and operational readiness

**Status:** Core release-readiness slice · P0 before private real-data pilot.

## Objective

Make the two-repository prototype reproducibly buildable, deployable and diagnosable. The slice adds tests, contract drift checks, safe logs, resource caps and an explicit release checklist rather than treating operational hardening as an undefined final task.

## User stories

- A developer can clone web and API repositories and run them using documented configuration.
- Every PR has automated checks; frontend/API contract drift is detectable.
- The maintainer can diagnose stuck jobs, lease recovery and cleanup failures without exposing recipient data.
- Users receive safe errors when free quotas/caps are reached instead of silent failure.

## Scope / exclusions

Separate repositories; Node LTS supported by actual host; npm lockfiles; TypeScript; lint/format; Vitest; Playwright; GitHub Actions; OpenAPI checks; `.env.example`; synthetic PDF/XLSX fixture set; request IDs/safe logs; application caps; private deploy smoke tests; runbooks. Excludes public launch, paid services, full on-call tooling and email activation.

## End-to-end flow

1. Developer sets up both repositories from READMEs and environment examples.
2. Local-only test auth can be used in isolated tests; production build must fail if test auth is enabled.
3. Pull request runs formatting/lint/typecheck/unit/API contract/build/dependency checks and relevant browser tests.
4. API generates/validates OpenAPI; frontend client/types are generated/versioned and CI fails on drift.
5. Preview deployment smoke-tests same-origin session cookie, API auth and scoped R2 upload.
6. Structured logs report request/operation IDs, phase, count, duration and safe error code only.
7. Private pilot gate tests cross-user access, malformed upload, tab close/resume, cleanup, resource caps and provider/hosting terms.
8. Email dispatch remains off. Public deployment is blocked until eligible zero-cost hosting is verified.

## UI/maintainer surfaces

User-facing service/error/limit/cleanup notices and safe request IDs. Maintainer surfaces are CI/deployment logs and authorized provider consoles/runbooks; no hidden unauthenticated admin route.

## API/config

Versioned OpenAPI, Zod validation, generated client/types. `.env.example` documents names only. `VITE_*` variables are public; MongoDB URI, R2 secret credentials, session secrets and email keys stay server-side. Runtime must fail closed if required production secret/config is missing.

## Failure behavior

DB/R2 outage gives safe error, no false success. Resource cap stops new work and explains next step. Stale API contract or tests block deployment. Ineligible public hosting means private prototype only. Email feature flag is off in first live prototype.

## Acceptance criteria

- AC1: Fresh clone of both repos builds/tests from README.
- AC2: PR checks format/lint/typecheck/unit/contract/build.
- AC3: CI detects stale OpenAPI/generated client.
- AC4: Smoke test validates same-origin cookie, Hono API and R2 signed upload.
- AC5: No secrets in web bundle or source repository.
- AC6: Fixture corpus includes supported and unsupported inputs.
- AC7: Safe correlation ID leads to sanitized diagnostic log.
- AC8: Free-tier caps enforced before overage.
- AC9: Prototype hosting use permitted; public host blocker remains visible.
- AC10: Email dispatch disabled by config/build for initial prototype.

## Tests

Clean clone; typecheck failure; stale contract; missing production secret; test auth accidentally enabled; R2 cap; MongoDB/R2 outage; log-redaction scan; origin mismatch; hosting terms gate; verify email flag locked off.

## Dependencies/gate

All core slices, GitHub Actions, contract tooling, R2/Atlas, fixture set. Required before private pilot.

## Open details

Exact OpenAPI/client tooling, commands, safe log solution, cleanup trigger and public hosting plan. No paid monitoring/hosting assumed.

<!-- End source: PRD-CORE-10-PRIVATE-PILOT-AND-OPERATIONAL-READINESS.md -->


---

<!-- Begin source: PRD-DEFERRED-01-EMAIL-DELIVERY.md -->

# PRD-DEFERRED-01 — App-managed email delivery with PDF attachments

**Status:** Deferred; excluded from the first live prototype. Not an authorization to enable email before the release gates pass.

## Objective and user stories

An organizer may later deliver one unique PDF attachment per eligible recipient, see quota/expiry feasibility before sending, control/pause sending, and recover failures without confusing “provider accepted” with “delivered”.

## Scope

Provider adapter and comparison (Brevo/Resend/others), sender verification, one attachment per recipient, email preview/body, per-user/account quotas, pacing, delivery state, webhooks, event deduplication, bounded retries/backoff/jitter, unknown-send reconciliation, bounce/complaint suppression, abuse reporting and kill switch. Nodemailer is a candidate library, not a provider or quota bypass.

## End-to-end flow

1. Feature flag prevents use until provider/account and test gates are approved.
2. User selects eligible recipient rows and views a preflight: provider quota, estimated sends, attachment size, remaining retention and likely completion feasibility.
3. If sends cannot plausibly finish before strict output expiry, block the dispatch or clearly explain a valid alternative; never silently extend retention.
4. User confirms sender identity and message.
5. Frontend initiates bounded chunk; Hono validates owner/snapshot/output, uses server-only provider credentials and sends one matching PDF attachment to one address.
6. Persist a delivery attempt/application idempotency key before request. If request outcome is ambiguous, mark `unknown` and reconcile by provider message/event before retry.
7. Verify and deduplicate webhooks; handle out-of-order status events explicitly.
8. Throttle by actual provider quota. Retry known transient errors with bounded schedule; permanent invalid address/content errors are surfaced rather than retried indefinitely.
9. At strict expiry, unsent work becomes `expired_unsent`; no new download/send URL and no silent retention extension.

## Routes/components/data

Future route `/app/batches/:batchId/delivery`; components `EmailPreflightSummary`, `RecipientEligibilityTable`, `SenderIdentityNotice`, `EmailContentPreview`, `Quota/EstimatedCompletionBanner`, `DeliveryProgress`, `DeliveryStatusTable`, `UnknownOutcomeReconciliationPanel`, `ExpiredUnsentNotice`. API proposals: `/email/preflight`, `/email/dispatch`, pause/resume/cancel, provider webhook endpoint. Collections `deliveryAttempts`, `providerEvents`, future delivery work items/statuses.

Provider adapter should support `sendOne(...)`, normalized error classes, quota/capabilities and webhook validation. `sendBatch` is optional only if the provider demonstrably supports a unique attachment per message/version.

## Acceptance criteria

- Each test recipient receives only their mapped PDF.
- Provider secrets absent from frontend assets.
- Account/sender eligibility and actual quotas enforced.
- Permanent errors do not receive automatic retry loops; transient retries bounded.
- Duplicate/out-of-order webhooks cannot corrupt state.
- Ambiguous sends reconcile before retry.
- Strict expiry blocks unsent attempts as `expired_unsent`.
- Browser closure pauses browser-driven dispatch; no autonomous-work claim.
- Bounce/complaint suppression, user limits and emergency sending kill switch work before public launch.

## Blockers

Provider and sender selection, plan eligibility, attachment limits, unique-attachment support, verified webhooks, acceptable-use constraints, public hosting and ₹0 feasibility. Free caps may make 5,000-recipient sending incompatible with default/maximum retention; do not alter retention/budget silently.

<!-- End source: PRD-DEFERRED-01-EMAIL-DELIVERY.md -->


---

<!-- Begin source: PRD-DEFERRED-02-LIGHTWEIGHT-PDF-EDITOR.md -->

# PRD-DEFERRED-02 — Lightweight PDF template editor

**Status:** Future capability; not part of the initial prototype.

## Objective

Offer minimal visual editing for supported templates so users can refine field layout/content without recreating the design externally.

## User stories

Users can select, move/resize and format supported fields, preview edits, undo/redo before save, and save a new immutable template version. Unsupported PDF features are identified rather than silently flattened/corrupted.

## Scope and non-goals

Candidate scope: editor canvas/page navigation, supported text/field elements, alignment, fonts, colors, sizing, mask controls, zoom/pan, undo/redo and preview. Not a full Canva-equivalent editor, arbitrary vector/PDF reconstruction tool, OCR editor, collaboration tool or image/signature-field product.

## Flow

Open a template version → enter editing mode → change supported element(s) → validate mask/font/overflow → preview through same PDF pipeline → save new immutable version. Existing approved snapshots remain unchanged.

## Routes/components/data

Potential `/app/templates/:templateId/versions/:versionId/edit`; `EditorCanvas`, `PageLayer`, `ElementToolbar`, `PropertiesPanel`, `HistoryControls`, `ZoomControls`, `FontGlyphWarning`, `MaskSafetyWarning`, `PreviewPane`, `SaveVersionDialog`. Persist only new `templateVersions`.

## Acceptance criteria

- Supported edits are undoable until save.
- Preview and generated result match.
- Save creates new version; approved snapshot hashes unchanged.
- Unsupported elements produce actionable warning/failure.
- Keyboard alternatives work for field properties/selection.

## Dependencies/open questions

CORE-03 engine proof, template versioning, user research. Start only if feedback shows field mapping/basic formatting is insufficient.

<!-- End source: PRD-DEFERRED-02-LIGHTWEIGHT-PDF-EDITOR.md -->


---

<!-- Begin source: PRD-DEFERRED-03-DOCUMENT-VERIFICATION.md -->

# PRD-DEFERRED-03 — Document identifiers and authenticity verification

**Status:** Future capability; not committed to MVP.

## Objective

Optionally add a unique identifier/QR code to generated documents and provide privacy-minimized public authenticity status.

## User stories

Organizer enables verification, previews QR placement, and gets unique issuance identifiers. A verifier can check status and a limited detail set. Revoked/superseded documents are not represented as currently valid.

## Candidate scope

Unique non-guessable token, QR generation/placement, verification landing page, privacy rules for visible details, rate limiting, revocation integration and status lookup.

## Exclusions

No claim of cryptographic proof of PDF integrity unless separately specified; no accreditation/legal validity; no full contact/recipient PII display; no blockchain unless evidence supports it.

## Flow/routes/data

Enable verification → configure QR/ID placement in template version → preview → freeze settings in snapshot → generate issuance-specific token → public `/verify/:token` shows minimal status. Tokens must not embed PII or expose sequential DB IDs.

## Acceptance criteria

- Tokens unique/unpredictable and tied to one issuance.
- Public output reveals minimal data and is rate-limited.
- Invalid tokens leak no internal identifiers.
- QR preview and final document point to same record.
- Revocation/reissue states integrate with future PRD-DEFERRED-04.

## Dependencies/open items

Public hosting, privacy design, document correction/reissue semantics, token lifetime and whether verification should validate artifact integrity or only issuance status.

<!-- End source: PRD-DEFERRED-03-DOCUMENT-VERIFICATION.md -->


---

<!-- Begin source: PRD-DEFERRED-04-CORRECTION-REVOCATION-AND-REISSUE.md -->

# PRD-DEFERRED-04 — Corrections, revocation and reissue

**Status:** Future capability; not in initial prototype.

## Objective

Correct a generated/issued document without pretending the original never existed. Maintain an auditable relationship between original and replacement while respecting retention/privacy.

## User stories

- I can identify an output and request correction.
- I can preview the replacement before issuance.
- I can mark the original superseded/revoked and create a new issuance revision.
- I can inspect history without retaining unnecessary PII indefinitely.

## Rules and workflow

- Never overwrite original output in place.
- Reissue creates a new snapshot/output/issuance ID linked to the original with reason, actor and timestamp.
- If email is active, replacement delivery has an independent status; old ambiguous delivery history is not rewritten.
- Verification page reports revoked/superseded status only if verification capability is enabled.
- Retention applies to old and new PII; long-lived audit facts are minimal.

## UI/API/data

Potential `IssuanceHistory`, `CorrectionRequestPanel`, `ReissuePreview`, `ReasonForReissue`, `ReissueDiffView`, `RevocationStatus`. Server validates original ownership and creates new immutable revisions.

## Acceptance criteria

- New issuance has a distinct ID/snapshot/output.
- Original file/history isn't silently overwritten.
- Email and verification states remain consistent but independent.
- Owner and retention checks apply to original and replacement.
- Audit records omit unnecessary PII.

## Dependencies/open questions

Core snapshot/output model, optionally email/verification, classification of typo vs major correction, and permitted post-expiry audit data.

<!-- End source: PRD-DEFERRED-04-CORRECTION-REVOCATION-AND-REISSUE.md -->


---

<!-- Begin source: PRD-DEFERRED-05-INTEGRATIONS-AND-PUBLIC-API.md -->

# PRD-DEFERRED-05 — Integrations and public API

**Status:** Future capability; no integration was selected for MVP.

## Objective

Allow trusted external tools to provide data/create jobs using the same validation, approval and retention rules as the UI.

## Candidate capabilities

Google Sheets import; scoped API credentials/OAuth; idempotent job creation; rate limits/quotas; signed webhooks; event replay protection; API versioning/deprecation; usage reporting.

## Non-goals

No public API key management, webhook subscriptions or Google Sheets OAuth in the initial prototype. No integration may bypass approval, owner authorization or quota caps.

## Workflow

An owner authorizes integration → app records bounded permissions → external caller submits import/job idempotently → same validation and snapshot pipeline runs → caller polls job or receives signed events → credentials can be revoked/rotated.

## UI/data/API

Future integration settings, API credential create/revoke and webhook management. Store only hash of API secrets; show secret once; scope permissions. Use OpenAPI contract; webhooks signed and deduplicated.

## Acceptance criteria

- External jobs follow same row validation/snapshot rules.
- Revoked/under-scoped key denied.
- Request/event replay doesn't duplicate work.
- Secrets not logged and only hash retained.
- Rate/quota enforcement works.
- Public API only published after public hosting/security gate.

## Dependencies/open questions

Public host, scopes, OAuth model, Google Sheets permissions, quota model and stable versioned contract.

<!-- End source: PRD-DEFERRED-05-INTEGRATIONS-AND-PUBLIC-API.md -->


---

<!-- Begin source: PRD-DEFERRED-06-TEAM-WORKSPACES.md -->

# PRD-DEFERRED-06 — Team workspaces, roles and shared templates

**Status:** Future capability; MVP is individual-account-only.

## Objective

Allow multiple people within an organization to share templates/jobs and roles while preserving strict tenant isolation.

## User stories

- Workspace owner invites/removes members.
- Members receive roles and permissions.
- Templates and jobs can be shared inside workspace.
- Revoked users immediately lose access and activity is auditable.

## Candidate scope

Workspace entity, membership/roles (owner/admin/editor/reviewer/viewer to validate), invitations, shared templates, permissions/audit events and multi-user approval where demand supports it.

## Non-goals

No team access/workspaces in MVP; do not add incomplete team fields or RBAC prematurely.

## Data/API implications

Likely future `workspaces`, `workspaceMembers`, optional `workspaceId` on resources and centralized resource-authorization policy. Current `ownerId` model should be isolated so a future migration is possible without implementing teams now.

## Acceptance criteria

Cross-workspace requests denied; member removal revokes access; shared template versioning preserves snapshots; every mutation checks role; invitation expiry/revocation works; audit data minimizes PII.

## Dependencies/open questions

Validated team demand, role definitions, approval workflows, ownership on member departure and possible billing/plan rules.

<!-- End source: PRD-DEFERRED-06-TEAM-WORKSPACES.md -->


---

<!-- Begin source: PRD-DEFERRED-07-ANALYTICS-AND-MONETIZATION.md -->

# PRD-DEFERRED-07 — Privacy-minimized analytics and monetization exploration

**Status:** Research/future PRD. No business model or pricing has been decided.

## Objective

Learn which workflows users value and whether a sustainable model can fund storage, compute and future email volume without collecting document contents unnecessarily.

## Candidate metrics/events

`template_created`, `template_upload_completed`, `template_compatibility_failed`, `import_completed`, counts-only validation summaries, `draft_review_started`, `batch_approved`, `generation_started/completed/interrupted/resumed`, `download_completed`, `cleanup_completed/failed`. Email aggregate events only after the feature is enabled.

Do not send recipient names/emails, spreadsheet cells, PDF text/content, signed URLs, credentials or raw exception payloads to analytics without explicit privacy/necessity review.

## Hypotheses to validate

Existing-PDF workflow is valuable; templates drive repeat usage; review/recovery is a differentiator; free-capped email may not satisfy large batches; usage costs may eventually exceed free allowances.

## Potential models (not selected)

Free core + paid high usage; organization subscriptions; pay-per-batch/document; open-source/community; sponsorship/education tier. Do not invent a price or paywall in the MVP.

## Acceptance criteria

Event schema reviewed for PII; analytics can be disabled/limited; no events require document content; product metrics are reliable; monetization proposal is backed by cost and willingness-to-pay evidence.

## Dependencies/open items

Pilot metrics, cost per batch, free-tier caps, customer segment, privacy disclosures and interviews.

<!-- End source: PRD-DEFERRED-07-ANALYTICS-AND-MONETIZATION.md -->


---

<!-- Begin source: PRD-DEFERRED-08-BRAND-AND-LAUNCH-READINESS.md -->

# PRD-DEFERRED-08 — Brand, positioning and launch readiness

**Status:** Deferred. “Bulk Document Issuance” is an internal working name only.

## Objective

Validate a public name and positioning and create launch material that reflects tested product behavior.

## Scope

Naming, tagline, value proposition, logo, palette/type, domain/name/trademark review, audience-specific messaging, landing page/onboarding, privacy and retention copy, demo fixtures/screenshots, FAQ and launch/presentation assets.

## Positioning hypotheses

- “Create personalized documents from the PDFs and spreadsheets you already have.”
- Preserve existing design, review before issuance, recoverable batch generation, transparent progress and simple downloads.
- Prior tagline candidate: “One template. Every document. Ready to send.” It remains unapproved and may be misleading while email is deferred; test or rewrite for downloads-first.

## Truthful claims rules

Do not claim arbitrary/scanned PDF support, OCR, fixed generation times, untested 5,000 record throughput, autonomous work when browser is closed, email delivery before enablement, instant physical deletion or public availability before a compliant host is identified.

## Acceptance criteria

Name/domain/trademark research recorded; tagline tested; public claims trace to acceptance test; screenshots use synthetic data; retention/hosting/email limitations disclosed accurately.

<!-- End source: PRD-DEFERRED-08-BRAND-AND-LAUNCH-READINESS.md -->


---

<!-- Begin source: 07-TRACEABILITY-AND-OPEN-DECISIONS.md -->

# PRD traceability, decision status and open decisions

## Status labels

- **USER-DECIDED:** explicit direct selection by the user.
- **USER-TARGET:** stated direction but measurable limit still open.
- **PROPOSED:** implementation recommendation; not an approved decision unless explicitly selected.
- **DEFERRED:** intentionally not in initial live prototype.
- **OPEN/BLOCKER:** must be resolved before its dependent release gate.
- **DATED TECHNICAL FACT:** recheck before implementation/launch.

## Round 10 choices incorporated

| Area | Status | Requirement |
|---|---|---|
| Scope all PRDs | USER-DECIDED | Master, per-slice core and future PRDs required. |
| Template revisions | USER-DECIDED | Immutable versions; edit creates new version. |
| Placeholder syntax | USER-DECIDED | `{{name}}` convention plus detection/visual fallback. |
| Field styling | USER-DECIDED | Basic controls: position/box, font, size, color, alignment, mask and fit. |
| Unicode/font | USER-DECIDED | Support where selected/embedded font has glyphs; test shaping; missing glyphs surfaced. |
| Spreadsheet parsing | USER-DECIDED | First non-empty header row; XLSX worksheet selector. |
| Preview timing | USER-DECIDED | On-demand preapproval preview; same pipeline as final. |
| Retention default | USER-DECIDED | 7 days default; 24h/7d/30d presets; 30d maximum. |
| Output file names | USER-DECIDED | Sanitized recipient name + template/document label + collision suffix. |
| Session storage | USER-DECIDED | MongoDB-backed session; hash opaque token. |
| Multi-tab processing | USER-DECIDED | One active lease per batch; other tabs status-only until release/expiry. |
| Cancellation | USER-DECIDED | Preserve completed outputs; cancel unstarted/pending work at safe boundary. |
| MongoDB shape | USER-DECIDED DIRECTION | Separate collections, not one batch document embedding thousands of rows. Exact schema proposed. |
| Browser support | USER-DECIDED TARGET | Latest stable Chrome/Edge desktop primary; current Firefox secondary; Safari/mobile provisional. |
| Navigation | USER-DECIDED | Persistent step routes for import, review, approve, progress and results. |
| Account deletion | USER-DECIDED | Explicit confirmation, revoke sessions immediately, schedule owned data/file cleanup. |
| Brand | USER-DECIDED STATUS | “Bulk Document Issuance” internal working name; public brand not finalized. |

## Earlier decisions preserved

- General-purpose document categories; existing PDF first; compatible searchable text PDFs only; capped multipage; no universal OCR or arbitrary in-place text editing promise.
- React/Vite/TypeScript, Hono/TypeScript, separate web/API repos, Google Identity Services, same-origin HttpOnly cookie, MongoDB, private Cloudflare R2, Zod and OpenAPI.
- PDF mapping/preview/final generation run in the browser in bounded chunks; MongoDB claim/lease records advanced by active browser; polling shows persisted progress. Browser closure pauses CPU work and user can resume on return.
- CSV/XLSX import, invalid rows isolated, duplicates warned/preserved, inline overrides + re-import diff, manual resolution of ambiguous matches, full draft browsing, immutable approval snapshot.
- Individual PDFs and ZIP; strict expiry; daily cleanup sweep; template PDF stays until template deletion; aggregate counts/timestamps only after job personal data expires.
- Hard ₹0 infrastructure budget. Vercel Hobby is a private prototype candidate only; public hosting eligibility under $0 unresolved.
- Downloads-first; email deferred. Future email uses individual attachments. Nodemailer/equivalent requested for investigation, not chosen as transport/provider, and cannot override upstream provider quotas.
- Launch private-first; future public signup/email needs safeguards. Brand name/tagline/logo/domain/trademark all open.

## Open blockers / unselected choices

1. Public hosting eligible for intended public/commercial service at strict ₹0.
2. Maximum PDF bytes/pages, rows, fields, worker chunk, output size, ZIP split point, active jobs and throughput.
3. PDF.js/pdf-lib/font embedding/shaping feasibility; supported Unicode script matrix.
4. Actual same-origin deployment/rewrite, cookie lifetime/rotation/CSRF and production Google IDs.
5. OpenAPI generator and frontend client generation strategy.
6. Spreadsheet parser and exact date/number locale rules, formula cache behavior and required fields.
7. R2 signed-URL details, CORS, private bucket policy, usage caps and physical deletion lag.
8. MongoDB Atlas tier/index/connection capacity; lease duration and reconciliation algorithm.
9. Daily cleanup trigger permitted under hosting terms and exact retry/confirmation behavior.
10. Email provider, account/sender eligibility, actual unique-attachment capability, quotas, webhook verification/error taxonomy.
11. Future email preflight under strict expiry and free quotas; `expired_unsent` is required at deadline.
12. Brand, acquisition channel, market segment validation, analytics and business model.
13. Exact account/template deletion behavior when running job references a version. Must resolve before corresponding endpoint ships.

## Conflicts that must not be silently changed

- **Strict zero cost vs public hosting:** don't add paid service without new decision. Private prototype may proceed if terms allow.
- **Browser execution vs “background”:** no work while browser is closed; app resumes when user returns.
- **Strict expiry vs email quotas:** future email must preflight queue completion against deadline; if infeasible, block/disclose options; unsent work expires as `expired_unsent`.
- **Any document category vs PDF support:** category scope is broad; supported file/layout remains constrained.
- **Nodemailer vs throughput:** it cannot create quota; provider limit controls sending.
- **Logical vs physical deletion:** system can enforce logical expiry immediately but infrastructure object deletion may lag and must be retryable.

## Source authority

The source project archive is included in `references/bulk-document-issuance-project-docs-v1.0.zip` and historical logs v0.3–v0.9 in `references/decision-logs/`. Latest direct user decisions supersede assistant recommendations and older snapshots.

<!-- End source: 07-TRACEABILITY-AND-OPEN-DECISIONS.md -->


---

<!-- Begin source: 08-PRD-CHANGELOG-AND-GOVERNANCE.md -->

# PRD pack change control

## v1.0 — 10 October 2026

- Converts product discovery through Round 10 into a master PRD, ten core vertical-slice PRDs, eight deferred PRDs, route/component inventory, domain/API/state contracts, cross-cutting requirements and test/release plan.
- Adds explicit distinction between user decisions, recommendations, deferred capability and blockers.
- Preserves the prior project documentation ZIP and the decision logs v0.3–v0.9 as references.
- Keeps exact routes/schema field names, library/provider choices, browser and ZIP thresholds, and public host provisional where not decided or benchmarked.

## Rules for future updates

1. Update the relevant PRD and traceability register together when a decision is made.
2. Do not convert a recommendation into a user decision without explicit approval.
3. Preserve earlier versions unchanged; publish v1.1/v2.0 for material revisions.
4. Every change records reason, impacted slices, migration/cost/security effects, acceptance changes and tests.
5. Recheck time-sensitive provider quotas, plan terms and API capabilities before implementation and launch.
6. Preserve cross-slice invariants: owner authorization, immutable templates/snapshots, output-recipient linkage, strict expiry, private R2, browser-paused processing, and no secrets in frontend.
7. If a conflict blocks a specific next step, ask a focused decision question. Otherwise document as release gate and continue.

## Recommended implementation workflow

- Product owner approves scope and acceptance criteria.
- Engineering confirms implementation feasibility and updates API/schema states.
- Security/privacy reviews resource ownership, file handling, retention and logs.
- Build one vertical slice end-to-end before advancing to dependent slices.
- Mark each acceptance criterion passed with a test/demo evidence reference; do not mark done based only on code existing.

<!-- End source: 08-PRD-CHANGELOG-AND-GOVERNANCE.md -->
