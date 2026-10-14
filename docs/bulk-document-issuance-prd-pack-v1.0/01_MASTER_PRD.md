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
9. On-demand Web Worker PDF generation: generate individual recipient PDFs deterministically on-the-go directly from frozen configuration records (`ApprovedSnapshot`, `ApprovedRecipient`). Zero generated recipient PDFs are uploaded or stored in cloud storage.
10. Stream complete batch or split volumes into standard ZIP archives via `client-zip` in the browser. Split into 1,000-document volumes for safe, flat memory footprint (<150MB).
11. Retain job metadata under 24h, 7d or 30d; default 7d. Batch expiry prunes MongoDB recipient PII. Saved template source persists in Cloudinary until explicit template deletion.
12. Email is a future feature: individual attachment per recipient via Hono/server-side provider adapter with quota/expiry preflight. It is not enabled in the first live prototype.

## 6. Binding user decisions

- General-purpose audience and all document categories from launch, constrained by PDF compatibility.
- Existing-PDF-first workflow; text-based PDFs; automatic field suggestions plus confirmed visual fallback; clean placeholder regions when safe masking cannot be established.
- Text/date/number fields; double-brace placeholder convention; basic field controls; fit-then-flag; Unicode only where glyph support and shaping tests pass.
- Capped multi-page PDF support; actual caps benchmarked rather than invented.
- CSV/XLSX; worksheet choice; first non-empty row as header; invalid rows isolated; duplicates warned and preserved.
- Searchable/paginated gallery for all drafts; on-demand preview uses same pipeline as final; inline correction and re-import diff; manual reconciliation if matches are ambiguous.
- Immutable template versions and immutable approved snapshots.
- Browser Web Worker generation and streaming ZIP (`client-zip`) with 1,000-document volume splitting; zero cloud storage for recipient PDFs; on-demand preview and single downloads.
- Filename defaults to sanitized recipient name plus unique recipientKey collision suffix.
- Google Identity Services only; MongoDB-backed hashed session token and HttpOnly cookie; same-origin API arrangement.
- React/Vite/TypeScript, Hono/TypeScript, separate frontend/API repositories, MongoDB, Cloudinary (templates only), Zod, OpenAPI; GitHub Actions, npm/lockfiles, supported Node LTS, Vitest and Playwright direction.
- Strict ₹0 budget; Vercel Hobby only private non-commercial prototype candidate; public host remains a blocker.
- 24h/7d/30d retention presets, 7d default, strict deadlines, aggregate counts/timestamps only after personal-data expiry; template source retained until template delete.
- Private-first launch. Public registration is a future direction with sending safeguards.
- Nodemailer or equivalent was requested for investigation; no email provider/transport is selected.
- Public name/tagline/logo/domain remain unapproved; current title is internal only.

## 7. MVP scope

### Included
Authentication/session; template library/upload/versioning; PDF mapping and preview; spreadsheet import/mapping/validation; draft gallery and reconciliation; approval snapshot; on-demand Web Worker generation; individual/streaming ZIP downloads; retention/cleanup/account deletion; CI/security/performance release gates for the private prototype.

### Excluded/deferred
Email delivery; Gmail/Outlook mailbox connection; full Canva-like editor; OCR/scanned PDFs; universal PDF replacement; image/signature fields; credential verification/QR; correction/revocation/reissue; teams; external integrations/public API; product analytics and monetization decisions; final branding and public launch.

## 8. Architecture direction

- Frontend repository: React + Vite + TypeScript.
- API repository: Hono + TypeScript.
- Identity: Google Identity Services, verified server-side (signature, audience, issuer, expiry); key user by Google `sub`, not email.
- Session: opaque random HttpOnly cookie; store only token hash, expiry and revocation state in MongoDB.
- Database: MongoDB for metadata, row states, snapshots, audit events, and user settings.
- Object storage: Cloudinary for base template PDFs (`templates/{userId}/...`). Generated recipient PDFs are produced JIT on the client and are not stored in cloud storage.
- PDF: PDF.js for render/text/geometry inspection; `pdf-lib` + `@pdf-lib/fontkit` for client-side deterministic PDF overlay generation.
- Execution: Off-main-thread Web Worker generation and streaming ZIP (`client-zip`) with 1,000-item volume partitioning.
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
