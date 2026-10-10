# Bulk Document Issuance — Decision Log & Preliminary Implementation Specification

**Version:** 0.3 (working draft)  
**Updated:** 10 October 2026  
**Status:** Discovery in progress; not yet an implementation freeze

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

The next interview should resolve authentication, user data expectations, maximum upload/page/row limits, behavior of individual row edits, retention choices, processing performance targets, and how to balance free hosting with a reliable worker/queue. These are not yet final decisions; avoid prematurely locking the implementation to any specific host or email provider.
