# Test Matrix and Acceptance Criteria

## 24. Test matrix / acceptance gates

### 24.1 Unit and contract tests

- Zod schemas for every API body/query/path; invalid and oversized requests.
- Google token validation: expired, wrong audience, wrong issuer, wrong signature, absent subject; session cookie and CSRF/origin failure.
- Import normalization: Unicode, CSV quoting/line endings, date/number formats, missing required values, duplicate addresses, shared address with multiple documents, re-import diff, conflicting inline overrides.
- Field coordinates: viewport-to-PDF transforms, rotation, page dimensions, multi-page mapping, fit/wrap/min-font rules.
- State transition guards; paused/canceled jobs cannot acquire new work; old snapshot cannot mutate; an invalid transition has no side effect.
- Application idempotency unique key; duplicate click and parallel dispatch; idempotent provider webhooks.
- Retry classification: 429, 5xx, network timeout, retry-after, known permanent 4xx and ambiguous outcomes.
- Retention deadline logic, cleanup idempotency, cleanup retry and PII redaction.

### 24.2 PDF visual fixture suite

Use fixture files for standard tokens, token split across text fragments, Unicode/long names, long numbers/dates, missing fonts, rotated pages, different page sizes, transparent or textured backgrounds, field collision with logos, multiple pages, password-protected/encrypted documents, corrupted PDFs, image-only/scanned PDFs, and unsupported form/XFA content. Use rendered image comparisons to catch white-mask blocks, misaligned text, cut glyphs and accidental overlap. The app should clearly reject unsupported cases instead of silently issuing bad output.

### 24.3 Browser and ZIP benchmarks

Test Chrome and Firefox plus at least one lower-memory device for 500, 1,000 and 5,000 rows using small/simple and large/complex representative PDFs. Measure peak memory, UI responsiveness, row/chunk completion time, R2 upload recovery, resume after refresh, duplicate completion protection, and ZIP creation/download memory. Compare a bounded/streaming ZIP library against a simple approach; JSZip docs warn that `generateAsync` holds the full result in memory. Choose per-chunk archive size and concurrency only after these measurements.

### 24.4 Integration/fault-injection tests

- Browser closed at each generation stage; expired lease reclaimed; one uploaded file not duplicated after resume.
- R2 signed URL expires, is reused, has wrong content type, or is attempted against another object's key.
- MongoDB transient error, contention during claim, duplicate upsert, lost response after successful state write, and summary-counter drift.
- Email provider rate limit, daily quota exhausted, accepted response followed by Hono timeout, webhook duplicate/out-of-order, attachment size rejection, provider credentials missing, and sender domain not verified.
- Batch paused/canceled while items are claimed, between upload and finalize, and between intent and send response.
- Cleanup while job is active, object deletion failure, database record deletion before R2 deletion, and retention expiry while a send is unknown.

### 24.5 Minimum private-prototype release gate

Before testing with real recipients: keep sending disabled or tightly limited; only use a verified/approved sender and test inboxes; test auth ownership boundaries; verify R2 is private; validate source upload; prevent repeated dispatch on double click; establish basic rate limits and a global send kill switch; verify PII redaction; and ensure every job has a resumable status. Before public bulk-email launch, also require signed webhooks, bounce/complaint suppression, global/per-account quotas, abuse reporting, cleanup verification/retries, attachment-size policy, and the full fault-injection suite.

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
