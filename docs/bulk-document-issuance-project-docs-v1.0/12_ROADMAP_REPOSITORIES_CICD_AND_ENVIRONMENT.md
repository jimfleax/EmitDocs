# Roadmap, Repositories, CI/CD and Environment

## 30. Implementation roadmap — proposed, not yet user-approved

This roadmap is recommended to de-risk the product in dependency order. The key principle is **prove browser-side PDF fidelity and same-origin auth/storage first; do not build all product screens before these experiments succeed.**

### Milestone 0 — Repository and platform feasibility spike

**Deliverables**
- Two separate repositories (provisional names: `bulk-document-web` and `bulk-document-api`; names not a user decision).
- Web: React + Vite + TypeScript; API: Hono + TypeScript + Zod.
- Vercel projects for private prototype only, with `/api/*` rewrite to the API deployment. No assumption of eligibility for a later public launch.
- MongoDB Atlas Free connection from Hono with one cached/reused client per warm invocation environment where appropriate.
- R2 private bucket, scoped PUT/GET presigned URLs, and CORS restricted to prototype origin.
- Google Identity credential -> Hono ID-token verification -> app cookie -> `GET /api/v1/me` smoke test.

**Acceptance criteria**
- Requests from the frontend use `/api/*` on the frontend browser origin.
- Cookie set through the rewrite is stored and sent on the next API request in current Chromium and Firefox; cookie has intended path/security attributes.
- Invalid, expired, wrong-audience and missing Google credentials are rejected.
- API secrets never appear in frontend build output or source maps.
- A source PDF larger than the function body limit can be uploaded directly to R2 using a short-lived presigned URL; the API never receives the PDF bytes.
- Wrong-origin CORS requests and cross-account object access fail.

### Milestone 1 — PDF vertical-slice prototype

**Deliverables**
- PDF.js rendering/extraction and candidate placeholder detection.
- Visual field mapping for a manually selected region; page/viewport-to-PDF coordinate transforms with rotation/page-size handling.
- `pdf-lib` overlay masking + font embedding + text drawing, with field-level alignment and fit-to-width behavior.
- A shared transformation module used by draft previews and final PDFs.
- A representative fixture corpus before claiming support for complex PDFs.

**Acceptance criteria**
- Placeholder candidates are suggestions, not unreviewed automatic changes.
- Token-over-pattern/background is rejected or requires explicit confirmation; no silent unsafe white rectangle on a textured background.
- Test UTF-8/Unicode names, long strings, numbers/dates, font embedding, multiple page sizes, rotation, multi-page fields, split token fragments, corrupted/encrypted/image-only files and visual overlap.
- Every preview comes from the same PDF-generation code path as the final artifact; visible rendering uses PDF.js.
- At least 500 records can be run in a repeatable browser benchmark on the chosen pilot fixtures without tab freeze/crash; record peak memory/time rather than promising a universal time.

### Milestone 2 — Secure account, templates and storage lifecycle

**Deliverables**
- Google-only registration/login with verified ID tokens and app session cookie.
- Per-user template CRUD/versioning; original template PDF is retained until user deletes its template.
- Object metadata records size, content type, checksum, creator, purpose, opaque key and lifecycle status.
- Draft/source upload constraints and private download URLs.
- Deletion task ledger and idempotent cleanup path.

**Acceptance criteria**
- All templates/jobs/objects are scoped to owner; cross-user access test matrix passes.
- PDF bytes and recipient spreadsheets are never stored in MongoDB document fields.
- Object deletion failures are recorded and retried; cleanup ledger does not store recipient names/emails.
- Template versions used by an approved snapshot remain immutable until that job no longer requires them.

### Milestone 3 — CSV/XLSX import, validation, diff and review gallery

**Deliverables**
- CSV/XLSX parsing in the browser with file limits and typed normalization; Hono re-validates untrusted values at API boundaries.
- Explicit column mapping for text/date/number fields.
- Staged, chunked import endpoint and `batchImports` revision model.
- Inline correction, validation feedback, and re-import preview showing added/removed/changed/duplicate/conflicting records.
- Manual reconciliation for uncertain matches; no silent row-index merge.
- Review gallery with pagination/search and on-demand preview generation using the shared pipeline.

**Acceptance criteria**
- Invalid rows are individually blocked; valid rows remain available for the batch.
- Duplicate emails are warnings and never cause automatic row deletion.
- Import request chunks remain under Vercel payload limits; no single request tries to push an entire large XLSX/JSON dataset.
- User edits are represented as explicit overrides; re-import diff is reviewed before applying.
- Every draft can be browsed before approval, with long/missing/overflow-risk fields highlighted.

### Milestone 4 — Approval snapshot, generation and resume

**Deliverables**
- Immutable approved snapshot containing template version/checksum, mappings, formatting settings, data revision and effective per-row data.
- MongoDB-backed work-item claim/lease protocol with unique operation keys.
- Browser Web Worker generating bounded chunks and uploading each PDF to R2; finalize after checksum/size validation.
- Batch progress and cooperative pause/resume/cancel operations.
- Polling UI backed by persisted state.

**Acceptance criteria**
- Double-submit or concurrent claims cannot generate two authoritative outputs for one `(snapshotId, recipientKey)`.
- Refresh/browser close leaves completed work recorded; expired leases can be reclaimed without overwriting a completed result.
- Pause stops claiming new work and is honored at chunk boundaries; cancel stops unsent/unstarted work while keeping completed records.
- Approving a new revision creates a new snapshot rather than mutating outputs already generated/sent.
- Benchmark 500, 1,000 and 5,000 recipient fixtures on representative low-memory hardware; publish only measured limits.

### Milestone 5 — ZIP, individual downloads and retention

**Deliverables**
- Browser-bounded ZIP packaging; split to multiple archives when the tested memory/output limit requires it.
- Optional individual download through an authorized, short-lived URL.
- Retention presets of 24 hours, 7 days and 30 days; abandoned drafts expire from creation, generated-output timer begins at terminal generation as selected.
- Cleanup tasks processed by an idempotent sweep; R2 lifecycle is a backstop, not the only deadline mechanism.

**Acceptance criteria**
- ZIP/individual outputs contain exactly the expected recipient files; safe deterministic filenames and no path traversal.
- ZIP completion can recover from a failed attempt without corrupting or silently omitting files.
- Cleanup is repeatable and records object deletion outcomes; the UI discloses configured expiry and realistic cleanup lag.
- The retention-vs-pending-delivery conflict in Section 28.1 is resolved before email delivery is enabled for large batches.

### Milestone 6 — Email provider proof-of-concept and delivery reliability

**Deliverables**
- Provider-adapter interface with `sendOne`, `getCapabilities`, `normalizeWebhookEvent` and provider error classification. Do not select a provider until the comparison matrix is tested.
- Verified sender setup; individual recipient intents and attachment-size checks.
- API-side send in bounded units initiated by the browser; durable attempt records, provider IDs and HMAC/signature-verified webhooks.
- Distinct `accepted`, `delivered`, `bounced`, `complained`, `failed`, `unknown` and `expired_unsent` states as supported by provider capabilities.
- Bounded retries (proposed maximum five attempts for eligible transient failures) with exponential backoff/jitter and `Retry-After` handling; never blind-retry an unknown outcome.

**Acceptance criteria**
- Provider keys appear only in server-side environment configuration.
- Test one individual attachment per recipient; verify that each attachment hash matches that recipient's approved output.
- Duplicate dispatch, webhook replay, webhook out-of-order, provider 429/5xx, ambiguous timeout after acceptance, permanent bad recipient and account quota exhausted all result in non-duplicating recoverable states.
- Provider daily/monthly cap is enforced by Hono with per-account and global budgets; UI shows that sending may take days and can pause when browser dispatch is inactive.
- No bulk sending to real recipients during first test; use test inboxes and provider sandbox/test mode where available.

### Milestone 7 — Private pilot hardening

**Deliverables**
- End-to-end/fault-injection suite, security review, upload abuse limits, email-sending kill switch, quota dashboards, alert/log policy, account deletion behavior and acceptable-use/recipient-authorization UX.
- Usage guardrails to protect zero-cost provider limits: per-user active batch cap, file/row/total-output budgets, request rate limits and storage alerts.
- Privacy/retention page that clearly distinguishes application deadline from provider/lifecycle cleanup delay.

**Acceptance criteria**
- All auth, cross-account access, upload validation, no-secret-in-client, retry/idempotency, paused/canceled batch, cleanup and unknown-delivery tests pass.
- 5,000-recipient support is not advertised until browser PDF generation, output storage, ZIP creation and job recovery have been benchmarked end-to-end.
- Public sign-up and public bulk sending remain disabled until a compliant public hosting option is established under the intended use and zero-cost constraint is re-evaluated.

## 31. Separate repository setup and CI/CD — recommended plan

### 31.1 Repositories

Maintain separate repositories as selected. Suggested names are provisional:

- `bulk-document-web`: React, Vite, PDF.js preview, browser Web Worker, `pdf-lib` output, import/review gallery and polling client.
- `bulk-document-api`: Hono routes, Google ID-token verification, cookie/session lifecycle, Zod request validation, MongoDB repositories, work leases, R2 presigned URLs, email-provider adapter, webhook verification and cleanup route.

Avoid copying API types manually without drift detection. Recommended contract workflow: generate an OpenAPI JSON document from Hono/Zod routes in the API repository; version/commit that contract as a CI artifact or generated file in the web repo; use a generated TypeScript client/types on the frontend; CI fails when a route/schema change has not updated the contract. This gives separate repos an explicit contract without requiring a monorepo or paid private package registry.

### 31.2 Branch and pull request checks

For each repository, require PR checks before merging to the default branch:
1. Install exact lockfile dependencies in frozen/CI mode.
2. Format check and ESLint.
3. TypeScript typecheck.
4. Unit tests and contract/schema tests.
5. Production build.
6. Dependency/security checks and secret scan.

Web repository should add Playwright smoke tests for login route, template upload flow, import/review and job progress with network fixtures. API repository should include route/auth tests plus MongoDB integration tests in a disposable CI service/container where supported. Use test doubles for email and R2 in routine PRs, then run an explicit integration smoke suite against a dedicated test bucket/provider test inbox outside the production namespace.

### 31.3 Deployment promotion

- Pull requests: checks and preview deployments using non-production settings and fake/mock email sender.
- Main branch: deploy the private prototype's Vercel web project and separate Hono API project.
- Environment promotion: use separate development/test/prototype credentials, bucket prefixes or buckets, and database namespace. Never use one broad R2 credential for all environments if narrower credentials are possible.
- Public launch: not permitted by this plan until hosting eligibility and always-on/background-service expectations are resolved. Vercel Hobby's non-commercial terms are a prototype constraint, not a public-product decision.
- Rollback: each deployment must be reversible without mutating approved snapshot schemas. Use additive schema changes first and include an explicit rollback note for API routes and database migrations.

## 32. Environment configuration and secret management

### Frontend (`bulk-document-web`)

Example non-secret build-time variables:

```text
VITE_GOOGLE_CLIENT_ID=
VITE_API_BASE_URL=/api
```

Any `VITE_*` variable is bundled into client code and must be treated as public. Never put `MONGODB_URI`, R2 secret keys, email API keys, session secrets or webhook secrets in the frontend environment.

### API (`bulk-document-api`)

Required variables should be documented in `.env.example` with empty placeholders, never real credentials:

```text
NODE_ENV=development
APP_ORIGIN=http://localhost:5173
GOOGLE_CLIENT_ID=
MONGODB_URI=
MONGODB_DATABASE=
SESSION_HMAC_SECRET=
R2_ACCOUNT_ID=
R2_ENDPOINT=
R2_BUCKET_NAME=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
EMAIL_PROVIDER=disabled
EMAIL_API_KEY=
EMAIL_FROM=
EMAIL_WEBHOOK_SECRET=
CRON_SECRET=
```

Notes:
- If using opaque random session IDs stored server-side, `SESSION_HMAC_SECRET` may instead serve CSRF/state-token signing; document its specific purpose rather than adding unused secrets.
- Keep provider disabled by default. Deployment should fail closed or expose downloads-only behavior if `EMAIL_PROVIDER` is disabled or credentials are missing.
- `CRON_SECRET` only applies if a scheduled cleanup endpoint is used; require an authorization check for its invocation.
- Validate required variables at startup and return safe configuration errors without printing credentials.
- In development, use a local `.env` excluded from Git; in deployment use the platform's secret manager/environment settings. Rotate credentials immediately if exposed in logs or repository history.
- Presigned URLs are bearer capabilities: make them short-lived, object-specific, method-specific, and never log their full query strings.

## 33. End-to-end acceptance criteria for the complete MVP

A release candidate is acceptable only when the following end-to-end journey succeeds:

1. A user signs in with Google; Hono verifies the token and creates an app session. The browser uses the same-origin `/api` path. Another account cannot access the user's resources.
2. The user uploads a supported text PDF directly to a private R2 object with an authorized short-lived URL. The template stores a checksum and version; PDF contents are not stored in MongoDB.
3. The user maps detected placeholders or visual regions, previews masking, and gets a clear rejection/warning for unsupported background/layout behavior.
4. The user imports CSV/XLSX, maps columns, sees normalized rows, missing values, invalid dates/numbers, duplicate addresses and likely overflow. Valid rows remain usable while invalid rows are individually blocked.
5. Re-import creates a diff. Stable unique matches are reconciled, ambiguous matches require manual review, and inline overrides are preserved or explicitly resolved.
6. The user browses every draft through the shared preview/final-generation pipeline, including long-name and boundary-value examples.
7. Approval creates one immutable snapshot. Changing a draft later cannot mutate that snapshot or its outputs.
8. The browser generates PDFs using bounded Worker chunks and direct R2 uploads. A tab close leaves completed work recorded; reopening the app resumes uncompleted work after lease recovery without duplicating authoritative outputs.
9. Pause/cancel stops new work at chunk boundaries. All completed files and prior send outcomes remain accurately recorded.
10. The user downloads a valid ZIP (or multiple bounded ZIP parts) and any authorized individual PDF. File names are deterministic, safe and mapped to the correct records.
11. If email is enabled, every sent message has one intended recipient and the matching recipient's PDF, is authorized by Hono, and obeys provider/global/account quotas. Detailed provider states are visible where supported.
12. Injected provider timeout after acceptance creates an `unknown` state and is reconciled rather than blindly resent. Retryable errors use bounded backoff; permanent errors are actionable; signed webhook events are deduplicated.
13. At retention deadline, unsent/unknown cases are surfaced to the organizer before cleanup. The chosen unresolved policy must define whether pending recipients become `expired_unsent`, use a separately disclosed delivery-retention window, or are blocked from creating batches that cannot fit the configured retention.
14. Cleanup works with the browser closed, at least through a verified scheduled sweep plus lifecycle backstop for the private prototype. Every deletion is idempotent, failures remain visible, and expired recipient PII is not retained in cleanup history.
15. The actual measured batch, bytes, page count, preview latency and ZIP memory usage are captured as benchmark results. Only measured capabilities become documented limits; no untested fixed completion-time promise is made.
