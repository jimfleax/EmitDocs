# Bulk Document Issuance — Decision Log & Preliminary Implementation Specification

> **Versioning note:** This document preserves earlier discovery history. Where an earlier section labels a question “open” or asks it again, the latest authoritative decision in Section 17 and subsequent sections supersedes the historic prompt. Explicit user choices, recommendations, and technical constraints are labeled separately.

**Version:** 0.7 (working draft; Rounds 1–7 decisions incorporated)  
**Updated:** 10 October 2026  
**Status:** Discovery in progress; Round 7 choices recorded; implementation contracts proposed but not yet frozen

## 1. Product direction

Build a web application that lets people upload an existing text-based PDF, import recipient or record data from CSV/XLSX, map data fields to placeholders or visual regions, review personalized draft documents, generate a batch of individual PDFs, download them as a ZIP, and optionally send each PDF to its intended recipient. The longer-term vision includes lightweight visual PDF editing and additional workflow features.

The product is intended to work across document categories rather than being limited to certificates. Likely document types include event certificates, education/training documents, letters, invitations, acknowledgements, notices, and business documents. The initial technical scope remains intentionally narrower than “any PDF”: text-based PDFs with automatic field suggestions and explicit visual confirmation.

### Product hypothesis

The product will be differentiated by a low-friction existing-PDF workflow, clear review and validation, reliable per-recipient processing, transparent delivery states, and recoverability when some rows or emails fail. CSV/XLSX support, free usage, and bulk generation alone are not sufficient differentiation.

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

## 3. Critical analysis and risks

### 3.1 “Any document category” is not the same as “any PDF”

A common processing engine can support many document use cases, but the application should publish a compatibility boundary. Text-based PDFs can still have fragmented text, embedded fonts, rotated content, complicated layouts, multiple pages, or placeholders printed over non-uniform backgrounds. A detected token does not mean the old glyphs can be edited out safely.

**MVP rule:** support recognized placeholders and user-confirmed visual fields in text-based PDFs. If the placeholder cannot be hidden without damaging content, require a clean field region or manual masking confirmation; reject unsupported layouts clearly rather than silently producing bad files.

### 3.2 PDF libraries are complementary, not interchangeable

PDF.js can be used for rendering and text extraction/position inspection. `pdf-lib` can modify PDF structure, draw text/images, embed fonts, and work with form fields. Its published limitations state that it does not provide APIs to extract ordinary page text or remove/edit text drawn on a page outside a form field. Therefore, do not design the MVP around universal in-place text replacement through `pdf-lib` alone.

A practical first pipeline is:
1. Render and inspect the PDF.
2. Extract searchable text and candidate token positions with PDF.js.
3. Suggest field mappings and ask the user to confirm them.
4. Render a safe mask over the original placeholder region where possible.
5. Draw the replacement value using selected fonts and alignment rules.
6. Render proof previews and perform visual regression checks on supported templates.

### 3.3 Review every draft without needless full-document generation

The explicit requirement to browse every draft is important, but requiring thousands of full final PDFs to be stored before approval would waste resources. Use a review gallery with pagination, search, document-level preview, and anomaly highlighting (e.g. missing values, unusually long text, likely overflow). Render previews on demand when possible. Before final approval, preserve a versioned snapshot of the dataset and mappings. After approval, generate final PDFs from that immutable snapshot.

A future interview question must decide whether users can edit individual record values in the gallery or must correct the spreadsheet and re-import. This affects auditability and complexity.

### 3.4 Reliability is more than retries

BullMQ supports retry/backoff and rate limiting, but retrying an email send can produce duplicate delivery if the provider accepted the message and the worker crashed before saving the result. Email does not generally offer end-to-end exactly-once delivery as an application-level guarantee.

Use small, separately tracked jobs and idempotent state transitions. Record a recipient delivery intent before send; use provider message IDs, webhooks/events where available, and an explicit `unknown/pending reconciliation` case when send outcome is ambiguous. Never automatically retry permanent recipient failures or invalid content indefinitely.

### 3.5 Free infrastructure is an MVP strategy, not a reliability guarantee

Render's free web services sleep after 15 minutes without inbound traffic, may restart at any time, and have ephemeral filesystems. Its free Key Value instances are in-memory and lose data on restart. Render documents free services as intended for exploration/testing rather than production, and free web services cannot send outbound traffic on SMTP ports 25, 465, or 587. An API-based email provider may still work, but background processing and durable queue behavior need separate investigation.

Potential discovery-stage candidates include MongoDB Atlas Free for small metadata volumes, Upstash Redis for a modest BullMQ prototype, and Cloudflare R2 or another S3-compatible object store for PDFs. Each provider's current terms, limits, regions, data residency, quotas and production suitability must be confirmed before commitment. No free tier should be treated as a guaranteed production SLA.

### 3.6 Retention needs more than a MongoDB TTL index

MongoDB TTL indexes remove eligible documents asynchronously and do not guarantee immediate deletion. Binary files held in object storage need their own deletion process/lifecycle policy. The user-facing guarantee should define a deadline and the application should track cleanup outcomes. For deletion requests, revoke access immediately where possible and perform asynchronous physical deletion with retry and audit of the cleanup operation.

Saved template configuration and source PDF should be retained until the user deletes the template. Recipient spreadsheets, generated PDFs and detailed recipient-level records should follow separate configurable expiry rules. Define whether aggregates without personal data survive expiry.

### 3.7 Attachment limits affect the experience

Email providers and recipient systems enforce message-size limits; attachment encoding increases the wire size. Large attachments may bounce or be rejected by recipient mail systems even if the sending provider accepts them. The application should enforce per-file and estimated message-size limits, clearly surface non-sendable rows, and eventually consider secure expiring links as an alternative. The current product decision is individual PDF attachments, so links remain an option for later, not an assumed default.

## 4. Preliminary user workflow

1. User signs in and creates a job or selects a reusable template.
2. User uploads the PDF if creating a new template; uploads CSV/XLSX data.
3. System validates file type, size, schema, row count, and parseability.
4. System extracts text and proposes placeholder matches or candidate field locations.
5. User maps fields to spreadsheet columns and confirms field coordinates, font, size, alignment, and supported mask behavior.
6. System validates rows independently, identifies duplicate/missing values, invalid email addresses (if sending), and potential overflow.
7. User browses the drafts via a searchable, paginated review gallery. Each record can be previewed; likely problems are highlighted.
8. User approves a versioned dataset + mapping snapshot.
9. Generation workers create individualized PDFs and update row/document status independently.
10. System creates a ZIP archive and allows individual downloads.
11. If email delivery is enabled, delivery jobs send one attachment per valid recipient while respecting provider quotas.
12. Provider delivery/bounce events update statuses when available; transient failures retry with bounded backoff; permanent failures are shown with actionable reasons.
13. User can pause, resume, or cancel pending work. Completed actions are retained in job history until the applicable retention deadline.
14. A scheduled cleanup process deletes temporary inputs/outputs and associated personal data according to the user's retention setting, while reusable template files persist until the template is deleted.

## 5. Candidate architecture (not yet frozen)

- **Frontend:** TypeScript web app; React/Vite is a candidate, but not yet decided.
- **API:** Node.js + TypeScript; Express/Fastify remains undecided.
- **Application database:** MongoDB for users, templates, jobs, row states, delivery attempts, and cleanup state. Avoid storing PDF binaries in MongoDB unless a specific use case proves appropriate.
- **Object storage:** S3-compatible storage for source PDFs, generated files, preview thumbnails and ZIP archives; private by default, accessed via short-lived signed URLs or authenticated proxy downloads.
- **PDF inspection:** PDF.js for rendering and text/coordinate extraction.
- **PDF generation:** `pdf-lib` for overlays, text drawing, font embedding, and form-field support where appropriate.
- **Queue:** BullMQ + Redis is a candidate. Queue jobs should contain identifiers and metadata, not large files or full recipient datasets.
- **Workers:** Separate validation/preview/generation/delivery/cleanup tasks logically; separate deployment processes can be introduced when hosting permits.
- **Email:** Provider API rather than raw SMTP is preferred for deployment compatibility; provider choice is undecided.
- **Deployment:** Free static frontend + API may be suitable for an early demo, but persistent storage, queue durability, worker availability, CPU/RAM and cold-start behavior need a real test before accepting 5,000-recipient workloads.

### Suggested logical records

- `User`: authentication subject, account status, preferences.
- `Template`: owner, source-object key, page size metadata, field mappings, fonts, masks, schema/version, retention metadata.
- `BatchJob`: owner, template version, source data object key, status, counts, creation/expiry times, processing options, cancellation flag.
- `RecipientRecord`: job ID, row index, normalized fields, validation status/errors, generated object key, generation status, delivery status. Keep PII retention explicit.
- `DeliveryAttempt`: recipient/job ID, attempt number, provider message ID, response category, timestamps, sanitized error details.
- `CleanupTask` or cleanup state: object key, due date, attempts, last error, deleted confirmation.

These are conceptual entities; actual schema boundaries and retention of recipient PII still need design.

## 6. Candidate job and recipient states

**Batch/job lifecycle:** `uploaded → validating → mapping_required → preview_ready → awaiting_approval → approved → generating → ready_for_download → sending → completed/partially_completed`; with `paused`, `cancelling`, `cancelled`, and `failed` as controlled states. A job may be `ready_for_download` even if email delivery has not been selected.

**Recipient/document lifecycle:** `pending → invalid` or `valid → previewed → approved → queued_for_generation → generating → generated`; delivery independently: `not_requested → queued → sending → accepted_by_provider → delivered` where provider events support confirmation, or `bounced/complained/failed/unknown`. Avoid treating the provider accepting a message as proof that it reached the inbox.

**Retry classes:** transient API/network errors and provider rate limits can be retried with bounded exponential backoff and jitter; invalid email addresses, unsupported file conditions, and other permanent 4xx responses generally need user correction rather than automatic retries. Specific classification must follow the selected provider's documented error model.

## 7. Security and privacy baseline to design

- Treat all PDFs and spreadsheets as untrusted input.
- Validate file signatures and parseability, not only filename/MIME type; enforce upload limits and row/page limits.
- Keep uploads outside any executable/public web root; use private object storage, short-lived authorization and least-privilege credentials.
- Isolate processing workers and impose CPU, memory, page-count and runtime limits to reduce denial-of-service risk from malformed or expensive PDFs.
- Use authentication, object-level ownership checks, rate limits, CSRF protections where applicable, secure session/token handling and password-reset protections.
- Do not log full recipient rows, PDF contents, email addresses or signed URLs unnecessarily. Sanitize errors and keep secrets out of client bundles.
- Prevent cross-user access to templates, ZIPs, PDFs, job details and preview endpoints.
- Track delete requests and cleanup failures. Explain to users that provider backups/logs can have separate retention terms where applicable.
- For email, include abuse prevention, sender verification, suppression/bounce handling, and acceptable-use controls before public launch.

## 8. Open questions to resolve in later interview rounds

### Product and workflow
- Which initial audience should be recruited first for user interviews despite the general-purpose long-term vision?
- Can users correct one recipient directly in the review gallery, or must they edit/re-import source data?
- What exact actions are allowed once any emails have been sent?
- Should generated ZIPs include a manifest/CSV mapping recipient to file and status?
- Do users need an event/session ID, certificate number, or public verification at launch? (Not committed.)
- Should recipients be allowed to download their own document without an account? (Not committed.)

### Performance and limits
- Exact maximum upload bytes, page count, rows per job, fields per page, and maximum output size.
- Target time to first preview and expected processing throughput on chosen free/low-cost instances.
- Concurrent job count and fairness between users.
- How long generation results, logs, recipient rows and delivery outcomes remain available.

### Authentication and account lifecycle
- Email/password, passkeys, OAuth, or combination; verification and recovery mechanism.
- Whether email address is required for a user account even for download-only jobs.
- Rate limits, abuse controls, account deletion, and whether users can export/delete their data.

### Technical/deployment
- Frontend and API framework choice.
- MongoDB hosting and backup strategy.
- Object storage provider and lifecycle/deletion behavior.
- Redis/BullMQ deployment and persistence; whether a managed queue alternative is safer for early hosting.
- Email provider, free quotas, production approval requirements, webhooks, domain verification, unsubscribe/suppression policies and error taxonomy.
- Whether a separate worker can run reliably on chosen free hosting.
- Logging/metrics/alerts and a recovery procedure for stuck jobs.

### Business and validation
- Initial acquisition channel and early adopter group.
- Product analytics that respect data minimization.
- What metrics define success: completed jobs, documents generated, delivery success, time saved, repeat use, or conversion.
- What paid capability—if any—could eventually fund variable email/storage/compute costs.

## 9. Current public technical references

Links were checked during discovery on 10 October 2026. Pricing, quotas and product terms may change; re-check before implementation.

- PDF.js project: https://github.com/mozilla/pdf.js
- `pdf-lib` features and documented limitations: https://github.com/Hopding/pdf-lib
- BullMQ idempotent jobs: https://docs.bullmq.io/patterns/idempotent-jobs
- BullMQ retries: https://docs.bullmq.io/guide/retrying-failing-jobs
- BullMQ rate limiting: https://docs.bullmq.io/guide/rate-limiting
- MongoDB TTL indexes and delayed expiration behavior: https://www.mongodb.com/docs/v8.0/core/index-ttl/
- Render free service constraints: https://render.com/docs/free
- Render FAQ on ephemeral filesystems: https://render.com/docs/faq
- MongoDB Atlas pricing/free tier: https://www.mongodb.com/pricing
- Upstash Redis pricing: https://upstash.com/pricing/redis
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Resend pricing: https://resend.com/pricing
- Amazon SES sending quotas: https://docs.aws.amazon.com/ses/latest/dg/manage-sending-quotas.html
- Amazon SES attachment limits: https://docs.aws.amazon.com/ses/latest/dg/attachments.html
- OWASP file-upload risks: https://owasp.org/www-community/attacks/Unrestricted_File_Upload

## 10. Next interview focus: architecture, security, and measurable limits

Round 4 selected asynchronous processing with visible, accurate progress and no fixed completion-time promise. Most other Round 4 items remain undecided: authentication, inline recipient editing, multi-page templates, overflow policy, upload/page limits, post-expiry history, sensitivity scope, operating budget, and email policy. The launch preference is open registration with minimal restrictions, but it must be reconciled with bulk email abuse prevention and safe resource limits. Avoid prematurely locking the implementation to any specific host or email provider.

## 11. Round 4 assessment and updated decisions

### 11.1 Confirmed choice: progress over an unvalidated speed promise

The product should process batches asynchronously and show meaningful progress: rows validated, previews available, documents generated, ZIP ready, emails queued/sent/confirmed/bounced/failed, retries pending, and cleanup pending where relevant. Do not promise a fixed completion time until representative benchmarks exist. Progress must be based on persisted job state, not a browser connection or an in-memory counter; it should survive refreshes, worker restarts and user sign-out.

### 11.2 Open registration is a preference, not permission to operate without safeguards

The user selected open registration with minimal restrictions. Preserve this as the preferred acquisition experience, but do not interpret it as removing protective controls. A free service that can send thousands of personalized attachments can be abused for spam, phishing, quota exhaustion or sender-reputation damage. Recommended compromise: low-friction public registration, but verified organizer email before sending, per-account and global sending caps, per-batch limits, domain/provider authentication, bounce/complaint suppression, abuse reporting, acceptable-use rules, anomaly detection, and a kill switch for sending. Limits can be raised over time as accounts demonstrate legitimate usage. Downloads can remain available even when email sending is limited.

At minimum, require the organizer to confirm that recipients are entitled to receive the document and that the upload is authorized. App-managed email should be transactional and clearly branded; do not expose arbitrary spoofable From headers. The sender identity, verification approach and exact limits remain open decisions.

### 11.3 Current status of all Round 4 questions

| Area | Status | Recommendation for next decision round |
|---|---|---|
| Authentication | Open | Choose the lowest-maintenance secure option: consider Google OAuth plus verified email/password only if there is a clear reason to support both. Passwordless can be convenient but makes authentication dependent on email delivery. |
| Individual recipient editing | Open | Likely allow inline correction before approval, validate changes and record a change timestamp/editor; make re-import a supported alternate path. Define a clear conflict rule if the source sheet is re-imported. |
| Multi-page PDFs | Open | Consider allowing multi-page PDFs with explicit per-page mapping in the MVP, but benchmark parsing, previews, rendering and output size before promising large page counts. |
| Text overflow | Open | Recommend per-field fit behavior: shrink to a configured minimum or wrap inside a mapped box, then flag unresolved overflow. Never silently clip text. Keep a strict option where visual fidelity matters. |
| Upload/page/row limits | Open | Set provisional limits after benchmark tests with representative simple and complex files; limits must cap bytes, pages, rows, field count, CPU time and total output size. |
| Post-expiry history | Open | Default to aggregate counts and timestamps; retain recipient-level state only as long as needed and disclosed. If email addresses or provider IDs are retained, make the retention explicit. |
| Sensitivity scope | Open | For MVP, support ordinary business/personal documents but clearly defer regulated/highly sensitive use cases until security, legal obligations and controls are assessed. |
| Operating budget | Open | Separate “free to users” from “$0 to operate.” Ask for a hard infrastructure budget, even if the initial budget is zero. |
| Email quota policy | Open | Prefer a visible queue with provider-limit-aware pacing and a clear estimated/unknown completion range; optionally cap free sending while keeping generation/downloads unrestricted. |
| Processing UX | Decided | Asynchronous processing with persistent progress; no fixed time guarantee until measured. |
| Launch posture | Selected with qualification | Open public registration is desired, but basic authentication, limits and email abuse controls are required before enabling bulk sending. |

### 11.4 Current provider constraints verified on 10 October 2026

- **Render Free:** official documentation says free services are for exploration/testing, web services sleep after 15 minutes without inbound traffic, local changes are lost because the filesystem is ephemeral, the free Key Value service is in-memory and loses data on restart, and outbound SMTP ports 25, 465 and 587 are blocked. Avoid relying on a sleeping free instance as the sole always-on worker or on local disk as durable storage. API-based email providers use HTTPS and are a more suitable connection pattern on this host, but worker reliability remains a separate concern. Source: https://render.com/docs/free
- **Resend Free:** pricing currently lists 3,000 emails/month with a 100-email/day limit. A 5,000-recipient batch would need at least 50 sending days if the account is subject to this daily limit, ignoring other quota and deliverability considerations. Source: https://resend.com/pricing
- **Amazon SES sandbox:** new accounts are restricted to verified recipients, up to 200 messages per 24 hours and a sending rate of one message per second. Production access and larger quotas are not automatic assumptions; sandbox constraints are per AWS Region. Source: https://docs.aws.amazon.com/ses/latest/dg/manage-sending-quotas.html
- **Amazon SES message size:** SES v2 documents a maximum 40 MB total message size including attachments after Base64 encoding; the SES v1 API maximum is 10 MB including attachments after encoding. Email attachments expand during Base64 encoding, so PDF file size alone is not the correct envelope size. Source: https://docs.aws.amazon.com/ses/latest/dg/quotas.html
- **Cloudflare R2:** standard storage pricing currently includes 10 GB-month storage, 1 million Class A operations, 10 million Class B operations and free internet egress. This is a plausible object-storage candidate, not yet a provider decision; confirm S3-compatible SDK behavior, access-control model, account terms and lifecycle deletion in a prototype. Source: https://developers.cloudflare.com/r2/pricing/
- **MongoDB TTL:** TTL indexes delete eligible documents asynchronously and do not guarantee immediate deletion at the expiry instant. They are useful as a safety net, but not sufficient to promise an exact deletion time. Source: https://www.mongodb.com/docs/manual/core/index-ttl/
- **BullMQ:** retries support fixed or exponential backoff and jitter; rate limiting is global for a queue, which is useful for provider quotas. Retryable jobs must be designed to be idempotent. These queue features do not make external email delivery exactly-once. Sources: https://docs.bullmq.io/guide/retrying-failing-jobs, https://docs.bullmq.io/guide/rate-limiting, https://docs.bullmq.io/patterns/idempotent-jobs
- **PDF.js:** current API documentation exposes page/text-content APIs useful for extraction and locating candidate token ranges, but extraction is not a guarantee that arbitrary PDF text can be replaced safely. Source: https://mozilla.github.io/pdf.js/api/
- **File upload security:** OWASP recommends allowlisting types, validating actual content rather than trusting the MIME header, setting size limits, storing files away from the web root, applying authorization and considering malware scanning/sandboxing. PDFs and XLSX files must be handled as untrusted input. Source: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

These limits were checked on 10 October 2026. Pricing, free tiers, quotas and provider terms can change; reconfirm before implementation and before public launch.

### 11.5 Implementation implications arising from Round 4

1. **Persist progress:** a `BatchJob` should store stage, counts, timestamps, pause/cancel flags, and last progress update. Derive progress from durable recipient/document states. The UI should poll or use SSE/WebSockets only as a delivery mechanism for persisted state, not as the state source of truth.
2. **Separate batch-wide and per-recipient status:** some rows may be invalid while valid rows proceed. The batch is not necessarily failed if several rows fail. Generation and delivery status are independent dimensions.
3. **Pause/cancel are cooperative:** workers check state at safe boundaries. Cancellation prevents unsent/unstarted work, not already accepted provider sends. Workers need leases/heartbeats or stale-job recovery so interrupted work can resume safely.
4. **Prevent duplicated side effects:** give each logical recipient-send operation a stable idempotency key where supported, persist an attempt/intent before making the provider call, store provider message IDs, process webhooks idempotently, and surface ambiguous send outcomes for reconciliation rather than blindly retrying.
5. **Temporary storage needs its own lifecycle:** source job data and output objects should have explicit expiry timestamps and a cleanup state machine. Reusable template PDFs are exempt until the template is deleted. Use database TTL as a fallback, not the sole deletion mechanism. Prefer a cleanup worker that retries storage deletion and records confirmed completion; document any provider backup/log retention outside the app's control.
6. **Public signup needs abuse controls:** require a verified account before sending; limit documents and emails per account; apply global quotas; watch bounce/complaint signals; suppress invalid/complaining addresses; ensure the platform owns and authenticates the sender identity; provide reporting/administrative kill switches. Establish these before public bulk-email launch.
7. **Free-tier design must degrade gracefully:** always keep completed generation results available for ZIP/download until expiry even if email sending is throttled or paused. Never tie generation availability to successful email delivery.
8. **Performance is a benchmark objective, not an SLA:** test representative one-page and multi-page PDFs across recipient counts of 500, 1,000 and 5,000, including long fields, embedded fonts, large output sizes and worker restarts. Record throughput, peak memory, preview latency, storage use and failure/recovery behavior.

## 12. Round 5 interview: decisions that shape implementation

Round 5 has now been answered; the confirmed choices and implications are recorded in Section 13. The remaining implementation-provider choices are still open.

The next interview should use recommendations instead of forcing premature provider choices. Priority order: public-signup/authentication and anti-abuse policy; supported document geometry and editing workflow; explicit file/data-retention boundaries; performance/load constraints; and cost tolerance. Current recommended defaults are collected in Section 11.3, while final choices remain open until the user confirms them.


## 13. Round 5 decisions and implementation implications

**Status:** User-selected decisions are distinguished below from recommendations that have not yet been approved. Date of update: 10 October 2026.

### 13.1 Confirmed user choices

| Area | User-selected choice | Status / implication |
|---|---|---|
| Authentication method | Google-only sign-in | Confirmed product choice. The implementation provider is not chosen. Need verify Google identity tokens on the backend, create/link an internal user record, protect every resource by owner, and support account deletion. Google sign-in itself does not manage the website's application session. |
| Recipient corrections | Both inline edits and spreadsheet re-import | Confirmed. Re-import needs a clear reconciliation rule. The approved batch must use an immutable versioned snapshot so edits after approval cannot silently change already generated/sent documents. |
| Multi-page PDFs | Capped multi-page support, with limits established through benchmarking | Confirmed direction, not a numeric page limit. Field mapping must be page-aware; preview and rendering load need to be measured. |
| Overflow handling | Fit text where possible, then flag unresolved overflow | Confirmed. Need configurable font minimum/maximum and/or field geometry. Never silently clip or overlap neighboring content. Automatically adjusted fields should be clearly indicated in draft preview. |
| Resource limits | Benchmark before setting product limits | Confirmed. Enforce temporary safety limits immediately, then set public limits after load testing. Benchmarks must consider page count, embedded fonts, file size, row count, field count and output-size expansion. |
| Post-expiry history | Keep aggregate-only job history after personal data expires | Confirmed. During the configured retention period, user needs job/recipient states for recovery. After expiry, retain only aggregates/timestamps that do not identify recipients; avoid storing unsalted hashes of predictable email addresses as a false form of anonymization. |
| Data sensitivity | Ordinary personal/business documents for MVP; highly sensitive or regulated uses deferred pending assessment | Confirmed scope direction. The app still needs good security controls; “ordinary” does not mean public, unencrypted or safe to log in plaintext. |
| Operating budget | Strict $0 infrastructure budget | Confirmed. This is a hard constraint until the user changes it. It conflicts with any promise of production-grade uptime, always-on workers or fast delivery of thousands of emails. The MVP should be described as a best-effort/free beta with tested workload limits, not an SLA-backed production service. |
| Email quota policy | Free-capped sending; generation/downloads remain available | Confirmed. Email limits must be explicit and separate from document-generation capacity. Do not claim the platform can email 5,000 recipients quickly under a free provider tier. |
| Registration | Public registration with basic safeguards | Confirmed preference. Signup should remain low-friction; email sending is gated by verified account status and sending protections, not by invite-only access. |
| Processing UX | Background processing with durable, accurate progress and no fixed completion-time promise | Confirmed in Round 4. Progress derives from persisted state and survives refreshes/restarts. |

### 13.2 Important conflicts and recommendations

**Strict $0 versus 5,000-recipient processing.** A hard zero-dollar budget can support an MVP and benchmark environment, but cannot guarantee always-on workers, durable queues, broad email quotas or production service levels. Preserve batch size as a product goal, but gate supported throughput by measured limits and per-account quota. A 5,000-row upload may be accepted for generation only if tested workload/resource budgets allow it; email delivery is a separate capped pipeline. If the app's free infrastructure goes idle or a free provider quota is exhausted, the UI must show a truthful paused/queued state rather than pretend the batch is actively progressing.

**Google-only authentication is a method, not a chosen service.** Google Identity Services provides the authentication flow, but its documentation says it does not manage the website's application session. A direct integration therefore still needs secure token verification and session handling. A managed option such as Firebase Authentication can reduce custom auth/session work and offers Google sign-in, but selecting it is still an implementation recommendation, not a user decision. Keep an internal `User` model with a stable external auth subject so an auth provider can be changed later. Sources: https://developers.google.com/identity/gsi/web/guides/integrate and https://firebase.google.com/docs/auth/web/google-signin

**Inline edits plus re-import require conflict rules.** Use a versioned imported dataset. Individual edits are stored as explicit overrides associated with stable row IDs. Re-import should be a separate versioned action with a preview of changed, added, removed and duplicate rows; never overwrite prior corrections invisibly. At approval, save a snapshot of the effective dataset plus template/mapping version and content hash.

**Fit-then-flag needs careful semantics.** Automatically reducing font size can preserve layout but may make one document inconsistent with others. Define per-field constraints and show any automatic size adjustment in draft review. If the value still does not fit at the minimum font size, mark the record blocked for correction. Wrapping should only be enabled for explicitly configured multi-line fields, not silently applied to a one-line name field.

**Public registration with low-friction protection.** Keep registration open, but require Google-authenticated account creation and verify that the account email is suitable for transactional sending. Apply global and per-account rate limits, daily/monthly sending caps, consent/authorization confirmation, bounce and complaint suppression, recipient deduplication, an abuse-report channel, audit trails, and a platform-level kill switch. Keep generated downloads usable even if the sending account is paused.

### 13.3 Current implementation constraints rechecked on 10 October 2026

- **Google Identity Services:** official guidance describes Sign in with Google as an authentication flow and explicitly says it does not manage the website's session after authentication. Backend ID-token verification and an application session/token strategy remain necessary. https://developers.google.com/identity/gsi/web/guides/integrate
- **Firebase Authentication with Google:** official web docs support Google provider sign-in through the Firebase SDK, followed by using a Firebase ID token for backend identity verification. It is a candidate managed implementation, not yet selected. https://firebase.google.com/docs/auth/web/google-signin
- **Firebase pricing:** the official pricing page lists no-cost authentication allowances, but quotas differ by authentication method and service. Review the exact Google-provider/auth configuration before deployment. Do not confuse Firebase Authentication's free allowance with free hosting for a Node worker. https://firebase.google.com/pricing
- **Upstash Redis:** official pricing currently lists the free tier at 256 MB data size and 500,000 commands/month; it is explicitly positioned for prototypes/hobby use. BullMQ's command consumption, connection behavior and job volume must be load-tested before assuming it suits a 5,000-recipient batch. https://upstash.com/pricing/redis
- **BullMQ retries and rate limits:** current documentation supports fixed/exponential backoff and jitter; global queue rate limits can pace workers. These controls are useful but do not create exactly-once email delivery. Sources: https://docs.bullmq.io/guide/retrying-failing-jobs and https://docs.bullmq.io/guide/rate-limiting
- **MongoDB Atlas Free:** official docs confirm Free cluster operational constraints, and the storage limit is a hard limit; writes can fail when the limit is exceeded. Keep job and recipient records compact, paginate queries, index intentionally, and test migrations/backup expectations. Sources: https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/ and https://www.mongodb.com/docs/atlas/reference/faq/storage/
- **Resend:** its current official pricing page lists 3,000 emails/month and 100/day on the Free plan. A 5,000-recipient batch cannot be sent in one day under that limit; if the daily cap applied with no other constraints, it would require at least 50 days of daily sending capacity. This supports the chosen free-capped policy. https://resend.com/pricing
- **Render Free:** free web services sleep after 15 minutes without inbound traffic, have ephemeral filesystems, and cannot send outbound traffic on the usual SMTP ports. Do not treat a single free Render service as a durable always-on worker. Use HTTPS email APIs where compatible and validate job resumption experimentally. https://render.com/docs/free
- **PDF library boundary:** `pdf-lib`'s own README says it cannot edit/remove ordinary page text outside PDF form fields; use PDF.js for inspection and coordinate suggestions, and use overlays only when safe/confirmed. https://github.com/Hopding/pdf-lib

### 13.4 Candidate state model refinements

Keep status domains separate rather than using one flat status that mixes workflow and delivery:

- `batch.status`: `draft | validating | ready_for_review | awaiting_approval | approved | generating | packaging | email_queued | paused | cancelling | completed | completed_with_errors | cancelled | failed | expired`.
- `recipient.validationStatus`: `valid | invalid | needs_review`.
- `recipient.generationStatus`: `not_started | queued | generating | generated | failed | cancelled`.
- `recipient.deliveryStatus`: `not_requested | blocked | queued | sending | accepted_by_provider | delivered | bounced | complained | failed_transient | failed_permanent | unknown_outcome | cancelled`.
- `cleanup.status`: `not_due | due | queued | deleting | completed | retrying | failed_manual_review`.

These are proposed implementation states, not yet frozen schemas. Provider terminology varies: “accepted by provider” is not the same as “delivered to inbox.” Delivery/bounce/complaint events should be idempotently consumed, and state transition rules should reject impossible regressions (for example, a late duplicate webhook must not revert a final status to an earlier state).

### 13.5 Round 5 open decisions remaining

The following implementation choices are still open and belong in the next rounds: frontend framework; API framework; monorepo/repository organization; whether PDF rendering/previews run in the browser, server or a hybrid; queue implementation under a strict zero budget; object-storage provider and retention enforcement; hosting topology for API and workers; job progress transport (polling/SSE/WebSocket); ZIP generation and download authorization; API endpoint conventions; exact collection schemas/indexes; recovery/reconciliation strategy; testing, observability and deployment workflow.

## 14. Round 6 planning prompts

The next round should focus on architecture boundaries and implementation choices, rather than revisit product decisions already made. Recommended defaults to evaluate:

1. Frontend: React + Vite SPA, with a componentized PDF canvas/review interface.
2. API: TypeScript + Node.js + Express or Fastify (choose one after considering ecosystem familiarity and validation needs).
3. PDF handling: browser-based preview and coordinate selection; server-side generation in a worker, because 5,000 generated files and ZIP creation should not depend on a browser tab staying open.
4. Queue: compare BullMQ + Redis with a MongoDB-backed lease/claim queue under the strict $0 requirement. BullMQ is stronger as a conventional queue but adds Redis cost/command limits; a MongoDB queue reduces dependencies but shifts responsibility for leasing, retries and stale-work recovery to the app.
5. Storage: evaluate an S3-compatible object store such as R2; keep private objects, short-lived download links and a cleanup ledger. Verify free quotas, regions, lifecycle guarantees, account requirements and service terms before selection.
6. Progress: start with polling durable job summaries; add SSE only if required by the UI. Avoid WebSockets unless two-way real-time interaction is needed.
7. Deployment: choose a demonstrable free-beta topology with honest idle/cold-start limitations; do not promise production SLOs under a strict $0 cap.

The immediate interview should ask the user to select or override these defaults, and ask one or two practical questions about the development workflow and deployment preference. It should not claim any provider or stack choice is final until explicitly approved.


## 15. Round 6 decisions and user-stated architecture direction

**Updated:** 10 October 2026. **Important:** this section supersedes older “open” labels where the user has since made a choice. “User choice” means explicitly selected by the user; “proposed” or “recommendation” is not a commitment.

### 15.1 Explicit user choices from Round 6

| Area | User choice | Status and implications |
|---|---|---|
| Frontend | React + Vite + TypeScript | **User decision.** Build a browser-first SPA with an interactive PDF mapping/review interface. |
| Repositories | Separate repositories | **User decision.** Frontend and API have independent deployment/configuration. Share API schemas through a versioned package or generated contract; do not casually duplicate types. |
| Authentication flow | Google Identity Services directly | **User decision.** Backend must verify Google ID tokens and establish its own application session. Google sign-in does not by itself establish a secure application session. |
| PDF execution | Browser | **User decision.** Browser owns PDF inspection, field mapping, previews, and final PDF rendering in a Web Worker where practical. This reduces server compute but makes active batch generation dependent on a user's browser session. |
| Job queue approach | MongoDB-backed queue | **User-selected candidate.** It fits a strict zero-dollar target by avoiding a separate Redis service, but requires explicit atomic claims, leases, retry scheduling, stale-work recovery, and idempotency. Its role is unresolved because work is also intended to run from the browser. |
| Object storage | Cloudflare R2 | **User-selected candidate.** Use private objects and short-lived presigned URLs for browser upload/download. Confirm account/billing requirements and configure safeguards to avoid overage charges. |
| Hosting pattern | Serverless chunks | **User decision for direction.** Keep each Hono API invocation short and resumable. Vercel Hobby cron is not a continuous worker, so background progress must not depend on frequent scheduled invocations. |
| Progress transport | Polling | **User decision.** Poll durable progress summaries. Browser transport is not the source of truth; status is persisted in MongoDB. |
| Runtime schema validation | Zod | **User decision.** Reuse runtime schemas and inferred types in the API and frontend where practical. Treat browser validation as convenience, not as a trust boundary. |
| Backend framework/deployment | Hono on Vercel | **Explicit user-stated direction in follow-up.** Treat as the preferred architecture, conditional on checking the Vercel plan terms and whether the intended public app qualifies for Hobby/non-commercial use. |
| Processing orchestration | PDF workflow and email workflow should be coordinated by the frontend | **Explicit user-stated preference.** Interpreted as frontend-driven orchestration. The actual app-managed email provider call must still be made through the Hono backend or another trusted server component; provider credentials must never be embedded in the browser. This interpretation requires confirmation in Round 7. |

### 15.2 Decisions retained from previous rounds

The product remains general-purpose by document category but limited by a published PDF compatibility specification. The first version supports text-based PDFs with automatic field suggestions and user-confirmed visual overlays; variable fields are text, dates, and numbers. Users import CSV/XLSX, map fields, validate row data, and browse every draft before approval. Invalid rows are blocked individually while valid rows can proceed. Users can correct rows inline and re-import data. Multi-page support is intended but capped based on benchmarks. Text should fit within configured bounds and unresolved overflow must be flagged. Batches target 500–5,000 rows, but supported limits will be established through benchmark tests.

The product has individual accounts, Google-only login, reusable templates, template source PDF retention until template deletion, separately expiring job data, aggregate-only history after personal data expires, and user-configurable retention. App-managed email uses a PDF attachment per recipient, with a free-capped sending policy; organizer mailbox integration is deferred. The first reliability priority remains per-recipient delivery tracking and recoverable transient failures. Downloads include a ZIP of individual PDFs and optionally individual outputs. Public registration is preferred but must include verified accounts, quotas and abuse safeguards. The launch budget is a hard $0, and processing should expose durable progress without an unvalidated fixed completion-time guarantee. The future roadmap may add a lightweight PDF editor, unique IDs/verification, organization workspaces, image fields, and API integrations.

### 15.3 Critical architecture reconciliation

#### Browser-side PDF processing is feasible, but not automatically durable

PDF.js can render and extract text in the browser, and `pdf-lib` can draw personalized text into a document. A Web Worker can keep CPU-heavy processing away from the UI thread. However, a browser is not a durable worker: closing a tab, suspending a laptop, losing connectivity, or exhausting memory can interrupt work. Local progress only becomes recoverable when each completed unit is persisted to the backend and its artifacts are uploaded to R2. The app should process bounded chunks, checkpoint progress frequently, and allow resume when the organizer returns. It must not claim a job is running server-side when only the browser can advance it.

**Decision tension:** the user also wants a MongoDB-backed queue and a serverless-chunk deployment. If all generation runs in the browser, MongoDB is primarily a durable manifest/status store and possibly an email outbox; it is not a continuously consumed PDF work queue. A browser can trigger short Hono invocations to send the next batch of emails, but delivery will stall when the browser stops invoking the dispatcher unless a separate scheduler/worker is available. Vercel Hobby Cron is limited to once per day, which is insufficient for a continuously advancing queue. This needs an explicit product decision: accept browser-attached processing and resumable pause-on-close, or relax the $0/serverless constraints for a truly independent background worker.

#### Email authority cannot safely live only in the browser

The user wants app-managed email attachments and a frontend-driven workflow. These are compatible if the frontend starts/monitors delivery while the Hono backend securely sends each email. An email provider's API key in Vite client code is public to every browser user and must not be used. For the app-managed sender, the backend needs to authenticate the user, load the approved recipient row and PDF object by server-controlled IDs, verify quota/ownership, and call the provider using a secret environment variable. Do not accept arbitrary `from` fields or unrestricted recipient lists from the client.

Vercel Functions have a 4.5 MB request/response payload limit. PDFs should not be POSTed as base64 attachments through the Hono endpoint. Upload files directly from the browser to private R2 with narrowly scoped, short-lived presigned URLs; send only a small document/object reference to Hono. The trusted backend retrieves the authorized object and attaches it to a transactional email. Message-size limits still need to be checked against the selected provider; Base64 expands attachment size.

#### Vercel Hobby and a zero-dollar public service may conflict

Vercel's official Hobby documentation and terms restrict Hobby use to personal/non-commercial use. A publicly available general-purpose service intended for future monetization may not qualify depending on actual use and terms. Do not assume that “free to users” automatically means “non-commercial.” Before public launch, either verify that the use qualifies, keep the deployment to a legitimate personal/non-commercial prototype, or accept that a different hosting plan/provider may be needed. This is a material constraint under the hard $0 budget, not a minor deployment detail.

Vercel documents a 4.5 MB request/response payload limit for Functions. Vercel Hobby cron runs no more than once per day, with execution time within the scheduled hour; it cannot serve as the frequent queue poller/worker for a robust email pipeline. Serverless function duration depends on the currently active compute configuration. Keep Hono routes short, idempotent and chunk-oriented rather than generating thousands of PDFs or sending an entire batch within one invocation.

#### R2 is a useful candidate, not an unlimited or guaranteed free resource

Cloudflare R2 currently lists a free monthly allowance of 10 GB-month of Standard storage, 1 million Class A operations, and 10 million Class B operations, with no egress bandwidth charge. Beyond included usage, usage-based charges can apply. Keep an application-enforced storage/output quota, set retention cleanup, and track object counts/sizes. Browser uploads need explicit R2 CORS rules and server-generated presigned URLs; never expose R2 secret access keys in the Vite bundle. A presigned URL is a bearer capability and should be short-lived, limited to one object and one operation, and not logged.

### 15.4 Proposed browser-first architecture (recommendation; not yet frozen)

1. **React/Vite frontend:** Google Identity Services sign-in; API calls using a secured app-session strategy; PDF rendering/mapping/gallery; CSV/XLSX parsing; browser Web Worker for generation; progress polling.
2. **Hono API on Vercel:** verify Google ID token, establish application session, enforce owner authorization, validate requests with Zod, create/modify templates and jobs, issue R2 presigned URLs, persist progress, dispatch individual email sends, process provider webhooks, enforce quotas, and expose cleanup/admin state.
3. **MongoDB Atlas:** store users, templates, batch metadata, imported recipient rows, document metadata, email outbox/attempts, audit events, retention deadlines and cleanup tasks. Do not store large PDFs or ZIPs in ordinary MongoDB documents. Keep recipient rows in separate documents instead of embedding thousands of records into one job document.
4. **Cloudflare R2:** store template PDFs, temporary source data where recovery requires it, generated PDFs, and optionally packaged downloads. Separate key prefixes by owner/resource type; private by default. Use presigned upload/download URLs and expiry-aware object keys.
5. **Browser generation chunks:** process a bounded number of rows (initial chunk size is a benchmark variable, not a decision) at a time. Upload each generated PDF directly to R2, then report a checksum, size and completion state to Hono. Never store all output PDFs as base64 strings in React state. A deterministic artifact key per job/recipient/revision makes retries safe.
6. **Email dispatcher:** browser triggers a delivery start/next-chunk request. Hono claims a bounded set of eligible recipient deliveries through MongoDB atomic updates, checks quota and idempotency state, retrieves each authorized PDF from R2, sends via provider HTTPS API, records provider message ID and attempt state, and returns. If the browser closes, dispatch stops unless a separate worker/scheduler is later introduced. Webhooks can continue to update outcome states.
7. **ZIP delivery:** benchmark browser-side ZIP creation for the supported output limits. Avoid loading the whole 5,000-PDF batch into one in-memory array. Consider streaming/chunked ZIP generation or multiple archives if the browser cannot package the configured limit reliably. A large ZIP should not be proxied through a Vercel Function response; R2/direct download is preferable.
8. **Polling:** poll compact batch summaries (not every recipient on each request) and fetch paginated recipient states as needed. Use sensible backoff when the page is hidden, and refresh state when the user returns.

### 15.5 Candidate MongoDB data model (proposed; not yet approved)

Use separate collections and stable object IDs. Store ownership and `createdAt/updatedAt` on all user-owned resources. All API access must be scoped by `ownerId` as part of the database query, not fetched by ID alone.

- **`users`**: `_id`, `googleSub` (unique stable identity), primary email, display name, account status, quota counters/windows, created/updated timestamps, accepted policy version, deletion marker.
- **`templates`**: `_id`, `ownerId`, name, source `objectKey`, source checksum, page count, field-mapping version, field definitions (key, page, box coordinates, font settings, fit policy, overlay/mask configuration), created/updated timestamps, `deletedAt`, retention policy. The source PDF remains in R2 until explicit template deletion; a deleted template must have a cleanup task.
- **`batchJobs`**: `_id`, `ownerId`, `templateId` and frozen template version/checksum, state/version, import revision, approved dataset hash, row totals/counts, processing options, pause/cancel intent, lease/checkpoint metadata where used, created/approved/updated timestamps, `expiresAt`, and cleanup state.
- **`importRevisions`**: `_id`, `batchId`, import number, source filename metadata (not trusted), upload object key if original import is retained temporarily, row count, columns, reconciliation summary, checksum, created time and expiry.
- **`recipients`**: `_id`, `batchId`, stable `sourceRowKey`, source row number, normalized row data, manual field overrides, validation errors/warnings, independent generation and delivery status, output `documentArtifactId`, current revision, timestamps, and expiry. Do not assume the email address is a unique recipient key; one person may legitimately receive different documents in one batch.
- **`documentArtifacts`**: `_id`, `ownerId`, `batchId`, `recipientId`, artifact type (`preview|pdf|zip|source`), revision/checksum, R2 object key, byte size, content type, upload/generation status, created time, expiry and cleanup state.
- **`deliveryAttempts` / email outbox**: `_id`, owner/batch/recipient/artifact references, stable idempotency key, attempt number, provider, provider message ID, state, error classification (avoid raw sensitive response bodies), next retry time, accepted/delivery-event timestamps, created/updated times. Prevent unique duplicate outbox intents for the same recipient revision and delivery request.
- **`cleanupTasks`**: resource/object reference, due time, state (`due|deleting|completed|retrying|manual_review`), attempt count, last error category, next attempt, and completion time. This is necessary because TTL for MongoDB records does not delete objects from R2.
- **`auditEvents`**: actor, resource, action, timestamp and minimal metadata. Do not put recipient names, full addresses, PDF content, tokens, or provider secrets in logs. After expiry, retain only the aggregate records and minimal operational information the privacy policy allows.

### 15.6 Proposed Hono API boundaries (recommendation; exact route names open)

All endpoints except sign-in bootstrap and verified email webhooks require an authenticated application session. Zod validation, owner authorization, rate limiting, payload caps, and idempotency checks are enforced in Hono; the client is not trusted to set ownership, status, quotas, file object keys or delivery outcomes.

| Purpose | Candidate endpoint | Responsibility |
|---|---|---|
| Google sign-in bootstrap | `POST /v1/auth/google` | Verify Google ID token audience/issuer/expiry/signature, identify by `sub`, upsert internal user, issue secure app session. |
| Session | `GET /v1/me`, `POST /v1/auth/logout` | Return minimal user profile and revoke/clear session. |
| Direct storage upload | `POST /v1/uploads/presign` | Authorize resource, cap declared size/type, mint short-lived presigned URL for a server-derived unique object key. |
| Upload completion | `POST /v1/uploads/:uploadId/complete` | Check expected object key, content length/checksum where available, and mark upload complete. |
| Templates | `POST/GET/PATCH/DELETE /v1/templates` | CRUD mapping configuration and source object reference; user-owned source retained until template deletion. |
| Jobs | `POST /v1/jobs`, `GET /v1/jobs/:jobId` | Create batch metadata; return compact status/counts. |
| Data import | `POST /v1/jobs/:jobId/import-revisions`; `POST /v1/jobs/:jobId/rows:upsert` | Start import revision and accept bounded idempotent row chunks. Must enforce request body limit below Vercel's 4.5 MB cap. |
| Validation/review | `POST /v1/jobs/:jobId/validate`, `GET /v1/jobs/:jobId/recipients`, `PATCH /v1/jobs/:jobId/recipients/:recipientId` | Store row-level validation outcomes, paginate review, update versioned inline overrides. |
| Re-import reconciliation | `POST /v1/jobs/:jobId/reimport-preview`, `POST /v1/jobs/:jobId/reimport-commit` | Show row additions/removals/changes/duplicate candidates; commit a new revision only after explicit confirmation. |
| Approval | `POST /v1/jobs/:jobId/approve` | Freeze an immutable approved snapshot of template mapping and effective row data; idempotent approval. |
| Generation checkpoint | `POST /v1/jobs/:jobId/artifacts/presign`, `POST /v1/jobs/:jobId/recipients/:recipientId/generation-complete` | Allow browser upload of one output PDF and idempotently record its checksum/size. Route names and trust model to be finalized. |
| Pause/resume/cancel | `POST /v1/jobs/:jobId/pause`, `/resume`, `/cancel` | Update durable control flags; workers/client loops stop at safe boundaries. Cancellation affects unsent/unstarted work only. |
| Email dispatch | `POST /v1/jobs/:jobId/delivery/start`, `POST /v1/jobs/:jobId/delivery/dispatch` | Initiate/advance bounded sends from Hono; never take provider secrets or unrestricted recipient/from fields from the client. |
| Provider events | `POST /v1/webhooks/email/:provider` | Verify signature and timestamp; idempotently process accepted/delivered/bounced/complaint events. |
| Download | `POST /v1/artifacts/:artifactId/download-url` | Verify owner/retention and issue short-lived access to an existing object; do not return broad bucket credentials. |
| Deletion | `DELETE /v1/jobs/:jobId`, `DELETE /v1/templates/:templateId` | Mark deletion requested, prevent new work, enqueue cleanup, and report confirmed cleanup progress. |

### 15.7 Proposed state model and recovery contracts

State dimensions should remain independent so a generation failure does not accidentally imply an email failure, and vice versa.

- **Batch workflow:** `draft -> importing -> validating -> review_required -> awaiting_approval -> approved -> generating -> outputs_ready -> completed|completed_with_errors`. Operational controls can overlay `paused`, `cancelling`, `cancelled`, `expired` and `failed`; state transition functions must validate allowed transitions.
- **Per-row validation:** `pending|valid|invalid|needs_review`. Invalid rows stay visible and are excluded from generation unless corrected and revalidated.
- **Per-document generation:** `not_started|in_progress|generated|failed|cancelled`. A generated artifact is only complete after the R2 upload and MongoDB record both succeed. Use deterministic artifact keys based on batch/recipient/revision and a checksum to handle “upload succeeded, API response lost” safely.
- **Email state:** `not_requested|queued|claimed|sending|accepted_by_provider|delivered|bounced|complained|failed_retryable|failed_permanent|unknown_outcome|cancelled`. “Accepted by provider” is not equal to “delivered” or “inbox.” Provider webhooks can be delayed or duplicated and must never regress a terminal state.
- **Deletion state:** `not_due|due|deleting|completed|retrying|manual_review`. Cleanup is independent of job progress and must be idempotent.

**Delivery correctness boundary:** no system can guarantee that an external email was sent exactly once when the provider accepted the message but the response was lost. Use provider idempotency keys if supported, stable local outbox records, stored message IDs, webhook deduplication, and reconciliation. Where outcome remains ambiguous, mark `unknown_outcome` and avoid automatic resend until an explicit policy resolves the risk of duplicate delivery.

**Leases/recovery:** if a MongoDB-backed queue is used, each claimed work item should have a lease expiration, worker/session identifier, attempt count, `nextAttemptAt`, and heartbeat/claim version. A crashed claimant must not keep work locked forever. In a browser-driven model, leases are primarily useful for preventing overlapping browser tabs and recovering an interrupted user's chunk when they return. MongoDB `findOneAndUpdate`/transaction behavior should be prototyped before asserting the queue is complete.

### 15.8 Minimum security and abuse controls

- Verify Google ID tokens server-side (`aud`, `iss`, signature, expiry); use Google's immutable `sub` as account key. Do not trust client-supplied email/owner IDs.
- Establish a separate app session. Prefer secure, HttpOnly, appropriately `SameSite` cookies if hosting origins allow a robust cookie arrangement; explicitly design CSRF protection and CORS. A Google ID token should not be stored as a long-lived application session in localStorage by default.
- Keep R2 credentials and email provider keys only in server-side environment variables. Presigned URLs are short-lived bearer capabilities, scoped to a single resource/action, and must not appear in analytics/logs.
- Require ownership checks on every template, batch, recipient, document and download operation. Guessable IDs are not authorization.
- Apply per-account and global quotas to row counts, source bytes, total output bytes, active jobs, send rate and monthly provider quota. Public registration must not imply unrestricted sending.
- Treat PDF, CSV and XLSX files as untrusted. Check real content/format and file sizes, cap ZIP/decompression expansion for XLSX, avoid executing spreadsheet formulas, render imported values as text (XSS safety), reject corrupted/unsupported files, and place hard limits on pages/rows/fields/time/memory.
- Confirm consent/authorization to email recipients; block/suppress repeated bounced or complained addresses; provide abuse reporting and operator ability to pause all email sending.
- Minimize PII in logs, use TLS, enforce retention on both MongoDB and R2, track cleanup failures, and document that deletion is not complete until all derived objects are confirmed removed.
- Use bounded request payloads below Vercel's 4.5 MB cap; direct-upload files to R2 with presigned URLs rather than sending binaries/base64 through Hono Functions.

### 15.9 Required test strategy before a public beta

1. **Unit tests:** Zod schemas; CSV/XLSX parsing and row normalization; stable recipient IDs; field mapping; allowed state transitions; retry classification; quota logic; expiry calculation; idempotency keys.
2. **PDF fixture suite:** standard token placeholders, token split into fragments, missing fonts, long/Unicode names, rotated text, multi-page PDFs, transparent/textured background, overlapping field region, non-searchable text, corrupted/encrypted PDFs, mixed page sizes. Snapshots/visual comparisons should catch mask edges and clipped output.
3. **Browser performance tests:** run generation in a Web Worker; benchmark Chrome/Firefox and one lower-memory device for 500, 1,000 and 5,000 rows at representative page/file sizes. Measure memory, UI responsiveness, resume after refresh, and package/download size. Set official limits only from measured results.
4. **Crash/network tests:** close the tab mid-generation, refresh after an upload but before checkpoint, lose network during R2 upload, retry upload completion, pause/cancel while a chunk is running, stale lease recovery, quota exhaustion and failed cleanup.
5. **Email failure injection:** provider 429, 5xx, timeout before response, successful provider acceptance followed by backend crash, duplicate/out-of-order webhooks, invalid/bounced recipient, attachment too large, and browser closed during the send loop. Verify no worker sends arbitrary or unapproved data.
6. **Security tests:** cross-account object access/IDOR, expired/replayed presigned URLs, malicious file metadata, XLSX ZIP bombs, CSV formula injection on export, stored XSS through document names, token audience/expiry errors, CSRF/CORS behavior, secret scanning, rate-limit bypass, replayed approval and duplicate send calls.
7. **Integration/load tests:** 5,000 recipient rows, large but allowed output, MongoDB atomic claim contention, repeated polling, provider quota scheduling, R2 object count/operation budget, retention cleanup and database storage consumption. Test against realistic free-tier constraints rather than unconstrained mocks only.
8. **Launch gates:** do not open bulk-email registration until sender verification, global cap, per-account caps, suppression handling, send kill switch, provider webhook verification, retention deletion, and crash/recovery tests pass.

### 15.10 Verified provider/platform constraints as of 10 October 2026

- **Hono + Vercel:** Vercel and Hono document zero-configuration deployment, with the app running as Vercel Functions. Hono is a plausible API framework choice. References: https://vercel.com/docs/frameworks/backend/hono and https://hono.dev/docs/getting-started/vercel
- **Vercel Hobby terms:** the official plan and terms restrict Hobby to personal/non-commercial use. Whether the user's intended public service qualifies must be resolved before committing to Vercel Hobby. References: https://vercel.com/docs/plans/hobby and https://vercel.com/legal/terms
- **Vercel Functions payload:** maximum request/response payload size is 4.5 MB. Use direct object-storage uploads and small API payloads. Reference: https://vercel.com/docs/functions/limitations
- **Vercel Hobby Cron:** current documentation states Hobby cron jobs can run only once per day; invocation may occur any time within the scheduled hour. This is inadequate as the sole queue runner for continuously advancing email work. Reference: https://vercel.com/docs/cron-jobs/manage-cron-jobs
- **R2 pricing:** current standard free allowance includes 10 GB-month storage, 1 million Class A operations, 10 million Class B operations, and no egress bandwidth charge. Overages can incur charges. Reference: https://developers.cloudflare.com/r2/pricing/
- **R2 presigned URLs:** official docs allow temporary, operation/resource-scoped URLs, with expiry from 1 second to 7 days. Treat URLs as secrets. Reference: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- **Google Identity Services:** Google advises verifying ID tokens on a server and validating signature, audience, issuer and expiration; use `sub` as the unique identifier. Reference: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- **Atlas Free clusters:** Free cluster behavior and limitations are documented; it is suitable for prototyping/low-throughput metadata, not a backup/availability guarantee. Reference: https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/
- **R2 bucket CORS and presigned URL use:** configure only the required origin/method/headers for the Vite application; presigned uploads avoid sending large file bytes through Vercel Functions. Reference: https://developers.cloudflare.com/r2/api/s3/presigned-urls/

## 16. Round 7 interview: data, delivery, API contracts, and release safeguards

The following questions intentionally focus on unresolved behavior. They do not reopen the already-selected product audience, React/Vite, Google-only sign-in, browser PDF processing, R2 candidate, polling, or Zod. Recommended answers are defaults, not decisions until the user submits them.

### Round 7 priority questions

1. **What should happen if the user closes the browser during a batch?** Choose between: generation/delivery pauses and resumes when the user returns (best fit for strict $0 and browser processing); generation resumes only from previously uploaded/checkpointed artifacts and email sending pauses; or revise the architecture to require an independent server-side worker (which likely conflicts with strict $0).
2. **How should email sending be invoked?** Recommended: frontend orchestrates and polls, but Hono performs each provider API call securely. If the browser is closed, sending pauses; Hono/worker state remains recoverable. Alternative: a real server-side worker continues after browser close, which needs a different execution/scheduling arrangement.
3. **Application session:** after Google Identity Services succeeds, should Hono issue a secure HttpOnly session cookie (recommended where same-site deployment allows it), or should the frontend send short-lived bearer credentials? Avoid using the raw Google ID token as a long-lived app session.
4. **Email outcome labels:** is “sent” allowed to mean accepted by provider, or should the UI distinguish `Accepted`, `Delivered`, `Bounced`, `Failed`, and `Unknown outcome`? Recommended: distinguish them; inbox placement is not guaranteed by a provider acceptance response.
5. **Ambiguous sends:** if the provider may have accepted a message but Hono timed out before recording the response, should the app mark `Unknown outcome` and reconcile first (recommended), or retry immediately with a potential duplicate risk?
6. **Duplicate data:** if the same email appears multiple times in the spreadsheet, should the app warn and let the organizer decide, or automatically deduplicate? Recommended: warn but preserve rows by default; one person may legitimately need multiple different documents. Prevent duplicate sends for the same recipient-document revision, not necessarily all repeated email addresses.
7. **Retention controls:** what selectable file-retention options should launch with (e.g. 24 hours, 7 days, 30 days, plus a configurable choice within a fixed maximum)? Template source PDFs remain stored until template deletion. Recommended: define a hard maximum for job data and outputs, with aggregate-only history afterwards.
8. **Recovery policy:** accept a recommended maximum of 5 transient send attempts with exponential backoff/jitter, honor `Retry-After` and provider quotas, do not retry permanent 4xx recipient/content failures, and use `Unknown outcome` reconciliation instead of blind retries? This is a product/ops decision; the selected email provider may affect the policy.
9. **API boundary:** confirm that the browser never connects directly to MongoDB or holds R2/email provider secrets; it accesses MongoDB only through Hono and uploads files to R2 only with short-lived presigned URLs. Recommended: yes.
10. **Acceptance/testing gate:** should public beta require the full reliability/security test set in §15.9, or may the first private prototype proceed with a smaller subset? Recommended: small private prototype first; no public bulk-email launch until all launch gates pass.

After Round 7, convert approved choices into a detailed API contract, collection schemas/indexes, state-transition table, retry policy, deletion schedule and executable test checklist. Avoid freezing numeric performance limits before benchmarks.


## 17. Round 7 decisions and critical assessment

**Status:** User choices from Round 7 are recorded below. Recommendations remain recommendations unless explicitly selected. The architecture is still subject to a zero-cost/hosting eligibility check and practical benchmarks.

### 17.1 Explicit user choices

| Area | User decision | Implementation meaning | Constraint / risk |
|---|---|---|---|
| Closing browser mid-job | Pause and resume | Persist progress and make every unit resumable. Resume when the user returns. | No generation can continue while the browser is closed because the browser is the execution engine. |
| Email execution | Frontend orchestrates; Hono does provider calls | Frontend triggers small send batches; Hono claims eligible work and calls the provider with server-side credentials. | Email delivery pauses if no client triggers dispatch, unless a separately approved independent worker is added. |
| Session | HTTP cookie | Hono creates an application session cookie after Google token verification. | The cookie topology must be compatible with the actual frontend/API origins; CSRF and credentialed CORS must be designed. |
| Approval | Immutable snapshot | Approval freezes recipient data, edits, template/version/checksum, field mappings, and rendering rules. | Any later correction creates a new snapshot/reissue workflow; do not mutate approved inputs in place. |
| Re-import | Diff and reconcile | New imports are revisions; show added/removed/changed/duplicate records; use an explicit identifier when available. | If no stable key exists, matching is heuristic and must be disclosed; row-number matching alone is unsafe. |
| Duplicate recipient data | Warn and preserve | Do not discard repeated email addresses by default. | Prevent duplicate sends for the same logical recipient-document revision, while allowing multiple legitimate documents to one address. |
| Delivery visibility | Distinguish detailed outcomes | Track provider acceptance separately from delivery, bounce, complaint, failure, and unknown outcome where supported. | Provider events can be delayed, duplicated, or out of order; webhook processing must be idempotent. |
| Ambiguous send | Reconcile first | If the provider may have accepted the message but the app did not record the result, mark unknown and reconcile before resend. | An app cannot honestly guarantee exactly-once delivery across all provider/network failure modes. |
| Retries | Bounded, up to five attempts | Up to five total attempts for known transient failures, exponential backoff with jitter, provider `Retry-After` and quota handling. | Permanent failures are not automatically retried; an unknown outcome is reconciled rather than treated as an ordinary transient failure. |
| Retention presets | 24 hours, 7 days, 30 days | Job data/output retention is user-configurable within these presets; saved template PDF stays until template deletion. | Exact deletion-at-the-minute cannot be guaranteed by TTL or a daily free scheduler; promise a retention deadline and cleanup status, not instantaneous deletion. |
| ZIP generation | Browser-bounded | Generate ZIPs in browser with bounded memory/streaming where possible; split into multiple archives if measured output size requires. | Browser memory and library behavior must be benchmarked; do not assume `JSZip.generateAsync()` streams the final archive because its documentation says the full result is held in memory. |
| API/storage trust boundary | Strict boundary | Browser never accesses MongoDB directly or receives R2/email provider credentials; it uses short-lived scoped R2 presigned URLs. | A presigned URL is a bearer capability and can be reused until expiration; scope and expiration matter. |
| Launch gate | Private-first | Start with a small private prototype and test failure/security behaviors before public bulk email. | Public launch still requires basic abuse limits despite open-registration preference. |

### 17.2 Important reconciliation: “email from the frontend” does not mean provider credentials in the frontend

The accepted interpretation is **frontend-driven orchestration with server-authorized sending**. The browser selects or resumes a batch and requests the next small unit of work; Hono validates session, ownership, batch approval, quotas, delivery state, and recipient/document linkage; Hono then retrieves the approved PDF from private R2 and calls the email provider with a server-side secret. The provider secret must never be embedded in the Vite bundle or browser local storage.

Because the product uses individual PDF attachments, the server must account for attachment expansion (e.g. Base64 encoding), provider message-size limits, HTTP function limits, and the cost of retrieving each object. Oversized messages should be blocked before attempting send and remain downloadable.

### 17.3 Browser processing and resumability

Browser processing is now a user decision, not merely a recommendation. Use a Web Worker for CPU-heavy extraction/rendering/generation where supported, but treat the browser as an intermittently available executor. Persist the approved snapshot, per-recipient status, object keys, output checksum, and checkpoint/progress in server-side state. Upload each completed PDF to R2 as soon as its unit finishes so a later browser session can resume without redoing completed units.

When the tab closes, a `pagehide`/visibility signal may request pause but is best-effort only. Correctness must instead rely on leases expiring and uncompleted units being claimable again. The UI should describe the job as **waiting for the browser / ready to resume** when no client is actively processing, rather than falsely displaying “running.” A lease must be short enough to recover stale work but long enough for a representative PDF unit; benchmark to pick actual durations.

### 17.4 Re-import and snapshot rules

- Every import has a monotonically increasing `importRevision` and import status (`uploading`, `parsing`, `validating`, `ready`, `rejected`, `superseded`).
- Prefer a user-selected unique key (e.g. registration ID) for reconciliation. Email is not necessarily a person key: multiple valid documents may go to one address, and email can be shared or changed.
- If no reliable key exists, present the matching confidence and force a review of uncertain matches; do not silently merge by row number.
- Inline edits are persisted as draft overrides with actor and timestamp. Re-import produces a diff that shows which overrides would be preserved, invalidated, or conflict with imported changes.
- On approval, write immutable `ApprovedRecipient` rows linked to a snapshot revision, then transition the snapshot to `ready` only after expected row counts and checksums are verified. If the operation is interrupted, it remains `building` and can be resumed or discarded; it is never partially treated as approved.
- Any correction after approval is a new revision/reissue operation. Already sent messages and historical delivery states are not rewritten.

### 17.5 MongoDB-backed queue: scope and non-goal

A MongoDB-backed queue is compatible with the zero-cost constraint as a candidate only if work is **claimable in bounded chunks** and an active browser drives generation/send dispatch. It is not an autonomous worker. Use atomic conditional state changes (`findOneAndUpdate` or equivalent) with a status/lease predicate; MongoDB single-document writes are atomic, but a multi-document operation is not automatically an all-or-nothing transaction. Avoid needing a transaction across thousands of recipient documents; use a staged import/snapshot protocol and a final compare-and-set state transition instead.

The queue records work state, retry due time, lease ownership, lease expiry, attempts, and idempotency key. Its role is durable work coordination and recovery; the browser is the executor for PDF generation, and Hono performs individual provider calls when triggered.

### 17.6 Vercel Hobby / hard-$0 conflict remains a release blocker

The user selected Hono on Vercel, a hard ₹0 infrastructure budget, open registration (eventually), and a possible future monetization path. Vercel's current Hobby terms restrict use to personal or non-commercial purposes and say deployments can be disabled at Vercel's discretion. This means **do not assume a public general-purpose service or future commercial product is eligible for Vercel Hobby**. The current private prototype may fit a personal/non-commercial scope, but public beta eligibility must be confirmed against the plan terms or the hosting plan/provider must change. The user has not authorized relaxing the strict-zero budget, so a paid plan must not be silently assumed.

### 17.7 Provider idempotency is helpful but not permanent

Resend documents that idempotency keys are retained for 24 hours. Use a stable application-level delivery-operation key in MongoDB for the whole lifecycle, and use the same provider key for short-window retries. After the provider's idempotency window expires, an ambiguous outcome must be reconciled through message lookup/events or held for manual resolution; a new blind send can duplicate the message. Provider idempotency is an additional safeguard, not a substitute for our own unique indexes and delivery state machine.

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

## 21. Delivery recovery and quota behavior

1. **Preparation:** ensure approved snapshot, generated object, recipient email, authorization/consent and quotas all pass. Do not queue unknown or invalid recipients.
2. **Intent:** create a `deliveryAttempt`/logical send operation with a durable application idempotency key and unique index before sending.
3. **Claim:** one Hono dispatch claims only a bounded number of due items with lease and attempts guard.
4. **Provider call:** load PDF from R2 server-side, enforce message-size envelope, attach PDF and send using a server-only API credential. Do not allow the client to select arbitrary sender fields.
5. **Persist response:** on definite provider acceptance, store provider message ID and set `accepted`; on known transient failure, schedule retry with `availableAt`; on permanent failure, mark it terminal; on ambiguous timeout, mark unknown and reconcile before a new send.
6. **Retry:** five total attempts maximum for known transient failures; exponential backoff plus jitter, clamped to provider `Retry-After`/quota windows. Respect daily/monthly caps and do not spam retries while waiting for next allowance. Permanent failures are not retried automatically.
7. **Webhook/event:** verify signature; insert provider event using unique event ID; update delivery state idempotently. Provider acceptance is not inbox delivery.
8. **Browser closure:** current selected model pauses dispatch. The next browser session fetches persisted statuses and resumes. Any active lease expires safely; do not automatically resend an item in `unknown`.
9. **Duplicate prevention:** application operation key should include provider, batch ID, approved snapshot ID, recipient ID and message purpose/revision. Provider idempotency is supplemental; Resend documents a 24-hour retention window for its keys.
10. **Quota exhaustion:** set eligible work to `retry_wait`/`waiting_for_quota` and show clear free-tier cap; do not make the user keep the tab open pointlessly until the next provider allowance. Resume when the next dispatch window is eligible.

## 22. Retention and deletion protocol

Presets: 24 hours, 7 days, and 30 days are the selected proposed launch options. The timer's exact start event remains to be chosen (recommended: job's terminal/completed timestamp for outputs, and creation timestamp for failed abandoned drafts, with explicit display in UI). Template source PDFs and reusable mappings remain until template deletion.

Deletion should be a process, not only a TTL field:

1. Set retention deadline and expose the deadline to the user.
2. Create idempotent cleanup tasks for every R2 object that belongs to expired job state.
3. Delete objects through R2; on failure, keep task retryable with safe error code and attempt metadata.
4. Remove or redact recipient data, imported values and delivery addresses only after deciding whether active send/reconciliation work is still outstanding; do not expire data needed to reconcile an ambiguous in-flight send without first setting a documented cutoff rule.
5. Replace long-term job record with aggregate counts/status/timestamps only; never keep name/email/address data after the selected retention period.
6. Confirm cleanup state after storage deletion succeeds; retain cleanup failure flags until reconciled.
7. MongoDB TTL can be used as a fallback for eligible database records but is asynchronous and does not delete R2 files. R2 lifecycle rules may provide a backstop, but app-level object tracking and delete retries remain necessary. Cloudflare currently documents that objects are typically removed within 24 hours after their lifecycle `x-amz-expiration` value, and existing objects can take longer when lifecycle rules change; therefore an R2 lifecycle policy is not an exact-time deletion guarantee. A 24-hour user retention preset must be represented as a deletion deadline plus cleanup status/retries, not a claim that every physical copy is erased exactly at hour 24.

**Honesty constraint:** With browser-driven work and a serverless host that may not run continuously, the app can promise a configured retention deadline plus best-effort/retry deletion and expose cleanup status, but must not claim exact-to-the-minute physical erasure until the storage/scheduler arrangement is proven. Public privacy text must reflect the implementation actually deployed.

## 23. Security and abuse controls required by the chosen architecture

- Google ID tokens are verified on the server for signature, audience, issuer and expiry. Use `sub` as the unique identity; do not trust decoded client-side claims.
- Session cookies: HttpOnly, Secure in production, intentional SameSite behavior, rotation/revocation policy, CSRF defenses, exact credentialed CORS origin allowlist. Avoid wildcard origin with credentials. The frontend/API deployment must be tested in real target browsers.
- R2: private bucket, random server-generated keys, short-lived operation-scoped presigned URLs; exact allowed CORS origin/method/header set; verify final object metadata/checksum after upload. Never log or analytically collect signed URLs. Presigned URLs can be reused until expiry, so they are not one-time tokens.
- PDF/XLSX/CSV: untrusted input. Check magic bytes/content, byte size, page count, row and column counts, XLSX decompressed size, encrypted/corrupt PDFs, and unsupported features. Treat spreadsheet values as data, never as executable HTML or formulas; escape on render/export.
- Browser-produced PDFs: the server cannot independently prove that a modified client generated exactly the pixels implied by a snapshot. This is acceptable only as a stated MVP trust boundary; do not market outputs as tamper-proof or cryptographically attested. A future server-side validation or signed-verification feature would need additional design.
- Provider: email secret only in Hono environment variables; sender address constrained to verified configuration; per-account/global quotas; recipients should be authorized to receive the document; suppression lists for bounce/complaint; verified webhooks; emergency global send pause.
- Rate limits: auth, create batch, import, upload URL issuance, generation claim, delivery dispatch, and webhook replay. Quota must be enforced server-side, not solely in React.
- Authorization: every resource query includes owner ID; an ObjectId/opaque ID is not authorization. Test cross-account template, row, R2 key, output, job and download access.
- Observability: structured request ID, stable error code, stage and timings. Redact recipient data, tokens, full filenames where sensitive, message body, uploaded content, provider secrets and presigned URLs.
- Dependency/security: keep PDF parser/renderer and XLSX parser updated; establish lockfiles, automated dependency advisories, secret scanning and a process to respond to vulnerable file parsing packages.

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

## 25. Remaining decisions for Round 8

These are intentionally not silently decided by this version:

1. **Vercel Hobby conflict:** Is Vercel intended only for a private personal/non-commercial prototype? If the app is to become public/general-purpose, we must verify hosting eligibility or choose a different permitted free hosting option before open registration.
2. **Cookie topology:** Do we have a custom domain or can frontend and Hono API be served under a same-site origin? If not, cross-site cookie behavior may be unreliable in some browsers and needs a tested alternative; this is important because the session-cookie approach is already selected.
3. **Email provider selection:** choose one provider for a prototype after checking current free quotas, sender verification, webhook signature model, per-message attachment size, idempotency window, bounce/complaint events, and acceptable-use policy. Do not treat the previously discussed Resend quota as a final provider choice.
4. **Import reconciliation without a unique key:** if the spreadsheet has no stable identifier column, should uncertain matches be manual-only or should the UI offer a deterministic fallback key chosen from columns? Recommended: never auto-merge uncertain matches.
5. **Retention timer start:** specify when the 24-hour/7-day/30-day period starts for completed files versus abandoned drafts, and what happens to data involved in unresolved email outcomes.
6. **Preview/edit fidelity:** decide whether the MVP preview must be pixel-identical to final PDF or is a close preview with final review after generation. This matters because browser renderer canvas output and final PDF drawing can differ slightly in font metrics.
7. **Launch quota defaults:** row limit, concurrent batches, source-PDF bytes, total generated bytes, email messages per account/day/month and maximum attachment bytes remain to be set from benchmarks/provider terms. Enforce conservative provisional limits from the start.

## 26. Current technical references checked for v0.7 (10 October 2026)

- Google ID token verification: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token — verify signature, audience, issuer and expiry; use `sub` as the stable account identifier. (Google official docs.)
- MongoDB atomicity: https://www.mongodb.com/docs/manual/core/write-operations-atomicity/ — single-document writes are atomic; multi-document writes require careful design/transactions when cross-document atomicity is needed.
- MongoDB `findOneAndUpdate`: https://www.mongodb.com/docs/manual/reference/method/db.collection.findoneandupdate/ — suitable building block for atomic conditional claims/leases, with filter and update semantics to be tested in the actual driver.
- MongoDB Atlas Free limits: https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/ and https://www.mongodb.com/docs/atlas/reference/faq/storage/ — free cluster has a hard storage limit and tier-specific capability/connection limits; benchmark footprint and indexes.
- Vercel Hobby terms: https://vercel.com/legal/terms and https://vercel.com/docs/plans/hobby — Hobby is limited to personal or non-commercial use. This is an unresolved hosting eligibility constraint for public/general-purpose launch.
- Vercel function limits: https://vercel.com/docs/functions/limitations and https://vercel.com/docs/limits — bounded, resumable function work; verify current runtime duration/payload limits for the selected plan at deployment time.
- Cloudflare R2 presigned URLs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/ — signed URLs can grant temporary access to one operation/object and remain reusable until expiration; the docs list expiries from one second to seven days and recommend appropriate CORS.
- Cloudflare R2 CORS: https://developers.cloudflare.com/r2/buckets/cors/ — configure browser origin, method and header permissions explicitly.
- Cloudflare R2 object lifecycles: https://developers.cloudflare.com/r2/buckets/object-lifecycles/ — objects are typically removed within 24 hours after their expiration value; this supports a lifecycle backstop but not exact-time erasure guarantees.
- Resend idempotency keys: https://resend.com/changelog/idempotency-keys — documented provider-side idempotency retention is 24 hours; application-level state remains necessary.
- JSZip limitations: https://stuk.github.io/jszip/documentation/limitations.html — `generateAsync` holds the full result in memory; this supports benchmarking/splitting and investigating a streaming ZIP approach.
- PDF.js API: https://mozilla.github.io/pdf.js/api/ — text content includes fragments, transforms, dimensions and styles; extraction does not imply arbitrary PDF text can always be safely replaced.
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html — validate actual file content, allowlist types, impose size limits, authorize access, use safe storage and consider hostile files.

**Change-control rule:** v0.7 is a working specification. The user choices in Sections 15 and 17 are confirmed; all schema/route drafts, quota numbers, provider selection, numeric workload limits and exact deletion timing remain proposals until approved and tested.
