# Decision Register — Source Extracts

## 2. Confirmed decisions from discovery

| Area | Current decision | Notes / implications |
|---|---|---|
| Audience | General-purpose users | Generality is the long-term vision; a narrower first-market segment still needs validation. |
| Launch scope | All document categories from launch | Categories can be flexible while PDF compatibility remains constrained and documented. |
| Initial PDF support | Text-based PDFs with automatic field suggestions | Scanned/image-only PDFs and arbitrary-layout OCR are not committed for MVP. |
| Field placement | Detect tokens and use confirmed visual overlays | Overlay-based masking must be safe; clean placeholder areas are required when the background cannot be reconstructed reliably. |
| User interaction | Mostly automatic detection with explicit confirmation | Confidence, fallback, visual preview, and safe failure behavior need specification. |
| Variable field types | Text, dates, and numbers | Image fields, personalized photos, signatures, IDs, and QR codes are future possibilities, not MVP commitments. |
| Data import | CSV and XLSX with column mapping | Validation and column matching are necessary. Copy/paste and Google Sheets integration have not been decided. |
| Target batch size | 500–5,000 recipients initially | Performance testing must include the upper end and account for PDF size and email quotas. |
| Draft review | Users can browse every draft before final approval | A paginated/searchable gallery and on-demand previews should avoid generating and persisting all full PDFs before approval. |
| Invalid rows | Block only affected rows and process valid rows | The UI needs row-level validation, errors, and a correction/retry path. Delivery may be unavailable for rows without valid email addresses. |
| Delivery | App-managed email with one PDF attachment per recipient | Email provider and sending quotas remain undecided. Sending through a connected organizer mailbox is deferred. |
| Sending behavior | Automatically throttle; retry transient failures; expose permanent failures | Need per-recipient states, bounded retries, provider webhooks/events, and duplicate-send safeguards. |
| Sender identity | Organizer mailbox integration later | Initial sending is app-managed; branding and custom-domain sending policy remain open. |
| Downloads | ZIP of individual PDFs plus optional individual downloads | ZIP creation should stream or operate from object storage rather than requiring all output in application memory. |
| Accounts | Individual user accounts | Team workspaces and shared organization permissions are not MVP commitments. Design ownership fields so teams can be added later. |
| Reusable templates | Accounts with reusable templates and temporary job history | A saved template retains its original PDF until the user deletes the template. |
| Retention | User-configurable deletion | Job inputs/outputs are governed separately from saved template source files. Exact options, minimum/maximum retention, and deletion guarantees remain open. |
| Batch controls | Pause, resume, and cancel unsent work | Completed generation/sends remain recorded; cancellation cannot unsend already accepted email. |
| First extension priority | Delivery tracking and automatic retries | This is core reliability work, not merely cosmetic post-MVP polish. |
| Business model | Completely free initially; monetization may be considered later | Must not promise unlimited email or compute on third-party free plans. |
| Future direction | Lightweight visual PDF editor and broader customization | Do not build a Canva-scale editor before validating need. |
| Preferred technology | TypeScript, Node.js, MongoDB, related JS ecosystem | Exact frontend framework, server framework, job queue, storage and email provider remain open. |

## 36. Round 9 decisions and current implementation status (authoritative)

This section is the latest source of truth for Round 9. It supplements, rather than erases, the previous discovery history. Earlier prompts that ask the same question are historical; the status below prevails.

### 36.1 Choices explicitly selected by the user

| Area | Round 9 choice | Consequence |
|---|---|---|
| Pending email vs output expiry | **Strict deadline** | Do not silently extend the selected output-retention period because an email is pending or has unknown status. At expiry, stop unsent attempts, mark them `expired_unsent`, inform the organizer, and allow a deliberate new job only if required source data remains available. This was the selected answer's stated behavior. |
| First provider experiment | **Downloads-first** | Do not send live emails in the first prototype. Prove PDF generation, review, resumability, ZIP downloads and cleanup first. Email-provider comparison is still required before a later email-enabled stage. |
| Physical deletion under strict-zero prototype | **Daily sweep** | Use an idempotent daily cleanup sweep plus object-storage lifecycle rules as a backstop. Disclose that physical deletion can lag the requested timestamp and may take longer if cleanup fails. |
| API contract | **OpenAPI** | OpenAPI generated from the Hono/Zod API is the planned contract source of truth; the frontend uses generated types/client code and CI checks the contract for drift. Exact generator/tool choice remains a technical implementation detail. |
| Development tooling | **Recommended stack** | Use a currently supported Node.js LTS version where supported by the selected host, npm and committed lockfiles, Vitest, Playwright, and GitHub Actions. Confirm the current Node.js LTS and platform runtime when scaffolding. |
| Email throughput request | **Use Nodemailer or an equivalent mechanism to send more emails at a time** | This is a requirement to investigate batching/throughput. It does **not** establish Nodemailer as the provider, does not authorize sending multiple recipients one another's documents, and does not override the hard $0 budget or provider quota limits. See Section 37. |

### 36.2 Existing choices that remain in force

- React + Vite + TypeScript frontend, separate web and API repositories, Hono + TypeScript API, Vercel only for the private prototype, Google Identity Services, secure HttpOnly application cookie, and same-origin API routing.
- PDF inspection/mapping/preview and final PDF generation in the browser; pause/resume after browser closure, with no claim of continuous processing while the browser is closed.
- MongoDB-backed persistent metadata/work claims and Cloudflare R2 as the candidate private object store. Do not store routine PDF binary contents in MongoDB.
- CSV/XLSX import, column mapping, inline edits plus import re-reconciliation, manual review of ambiguous matches, duplicate warnings without auto-discard, and immutable approved snapshots.
- Review every draft using the same preview and output pipeline; benchmark before advertising 5,000-recipient support.
- Bounded browser ZIP generation, individual download option, polling of persisted progress, strict server-side trust boundaries, Zod validation, and a private-first launch.
- Provider credentials remain server-side. Frontend may orchestrate sends later, but Hono must authorize/perform each provider operation. Emails are per recipient and must not expose other recipients' addresses or documents.

### 36.3 Round 9 implementation interpretation

**Strict deadline and free daily quota:** The chosen 24-hour, 7-day and 30-day job-output retention presets remain unchanged. Because sending on a free provider may take days, the application must compute an estimated dispatch schedule before email delivery is enabled in a later milestone. It should warn or block when the batch cannot reasonably complete within the selected retention period. If output still expires with pending delivery, the strict rule applies: do not send after the deadline; record `expired_unsent`, surface it to the organizer, and never silently retain the PDF to finish the queue. Since the first prototype is downloads-first, this policy is specified now but will not be activated against live email in Milestone 0–4.

**Daily deletion sweep:** At the configured deadline, mark metadata eligible for cleanup, revoke/stop issuing download URLs, attempt direct deletion of job objects, and persist cleanup outcomes. Repeat failed deletes idempotently. Object lifecycle is a backstop, not proof of exact-time erasure. Keep only the approved post-expiry aggregate counts/timestamps; do not preserve recipient PII in cleanup logs. Saved template PDFs remain until the user deletes that template, consistent with the earlier decision.

**OpenAPI:** Keep source and generated artifacts reproducible. The API repository generates and validates the OpenAPI schema from route/Zod definitions; the web repository consumes a pinned/versioned schema artifact to generate its API types/client. A breaking contract change must be accompanied by a planned frontend compatibility update. This is preferred over manually duplicating endpoint types across separate repositories.

**Development tools:** Use npm by default unless initial prototyping gives a concrete reason to change. Pin Node through an `.nvmrc` or equivalent compatible with the actual runtime. CI should install from lockfiles, run format/lint/typecheck/unit/contract/build checks, and run Playwright end-to-end tests with test-only storage/email fixtures. Never run live sends as a routine pull-request test.

## 38. Latest change-control summary — version 0.9

### User-selected choices through Round 9

All choices recorded in previous sections remain in force. Round 9 adds: (a) strict output deadline for unsent/unknown email cases, (b) downloads-first prototype before live provider integration, (c) daily cleanup sweep with realistic deletion-lag disclosure, (d) OpenAPI as the API contract mechanism, (e) Node LTS/npm/Vitest/Playwright/GitHub Actions recommended tooling accepted as the initial default, and (f) investigation of Nodemailer or a comparable sending mechanism for efficient high-volume dispatch.

### Recommendations, not yet final user choices

- Brevo should be the first provider investigated, not treated as selected.
- Prefer HTTPS API integration in Hono and use Nodemailer only if needed. Provider selection must be based on tests of per-recipient PDF attachments, quotas, webhook delivery events and account eligibility.
- Reject or warn before starting an email batch when quota and retention calculations show it is unlikely to complete before the strict deadline.
- Keep downloads independent from email availability; do not activate live bulk email in the first prototype.
- Public launch hosting remains unresolved. Vercel Hobby is restricted to personal/non-commercial use; Vercel is selected for the private prototype only, not as an established compliant public hosting solution.

### Next implementation steps

1. **Private vertical slice:** scaffold the separate web/API repositories, configure same-origin `/api`, Google ID-token verification, secure cookie session, MongoDB metadata and private R2 upload/download with no real emails.
2. **PDF compatibility prototype:** implement PDF.js inspection, confirmed mapping/overlay, same-pipeline on-demand preview/final output, and a fixture set including long names, multiple pages, embedded fonts and invalid/unsupported backgrounds.
3. **CSV/XLSX and review:** staged import, Zod validation, row-level errors, inline overrides, diff/reconciliation, duplicate warnings, and searchable/paginated review gallery.
4. **Immutable generation and downloads:** snapshot only after approval, generate in bounded Web Worker chunks, checkpoint and recover after refresh/close, package bounded ZIP parts, and persist R2 object cleanup status.
5. **CI/contract and security:** OpenAPI generation/drift checks, Vitest unit/contract tests, Playwright E2E tests, cross-account access tests, upload-bomb/type spoofing checks, secret scanning, and cleanup fault injection.
6. **Email proof-of-concept only after downloads passes:** compare Brevo/Resend, explicitly test per-recipient attachment batching, implement provider-neutral adapter and quotas, and keep real sends limited to controlled test inboxes until retry/reconciliation tests pass.
7. **Pre-publication gate:** measure supported bytes/pages/rows/ZIP size on representative hardware, test retention deadlines and R2 deletion lag, resolve an eligible $0 public host, and only then advertise the tested limits or enable open bulk sending.

## 39. Sources checked for Round 9

- Nodemailer transport types and SMTP: https://nodemailer.com/transports ; https://nodemailer.com/smtp
- Brevo free plan: https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans
- Brevo free quota FAQ: https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan
- Brevo batch transactional API: https://developers.brevo.com/docs/batch-send-transactional-emails
- Brevo single transactional API/attachments: https://developers.brevo.com/reference/send-transac-email
- Brevo SMTP relay: https://developers.brevo.com/docs/smtp-integration
- Resend current pricing: https://resend.com/pricing
- Vercel Terms (Hobby restrictions): https://vercel.com/legal/terms
- Google ID token verification for backend: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token

Checked: 10 October 2026. Recheck provider pricing, limits, terms and API behavior before implementation and launch.
