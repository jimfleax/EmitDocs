# Executive Project Dossier

## Product in one paragraph

Build a web app that takes an existing PDF design and structured records, helps the user map data fields to placeholders or visually confirmed regions, lets them review every personalized draft, freezes the approved data/template configuration, and produces individual PDFs. Users can download the results as a ZIP or individual files. App-managed email with one PDF per recipient is intended for a later milestone; it is deliberately excluded from the first live prototype. Future directions include lightweight PDF editing, corrections/reissues, credential verification, integrations and team functionality, none of which are all committed to the MVP.

## Product thesis

The problem is not just replacing names. Organizers can spend time matching data to a design, correcting spelling, preserving layout, generating hundreds/thousands of files, matching each document to the right email, handling bounced/rejected sends, recovering interrupted jobs, and explaining what was sent or deleted. The proposed value is a low-friction, dependable existing-PDF-first workflow.

This is a product hypothesis, not a validated advantage. Competitive tools already support many isolated features such as bulk generation, field placement, browser processing, ZIP download, email, and verification.

## Current product shape

- General-purpose by document category, not limited to certificates.
- Text-based PDF support with automatic field suggestions and user-confirmed visual mapping/overlays; no promise of universal PDF manipulation.
- CSV/XLSX input with field mapping; text, dates and numbers.
- Full draft browsing before approval; row-level errors; inline edits and spreadsheet re-import.
- Ambiguous re-import matching must be resolved manually; duplicates warn and are preserved.
- Approval freezes an immutable snapshot of data and template/mapping versions.
- Browser processing in bounded Web Worker chunks; closing the browser pauses work; returning allows resume.
- Persisted progress, polling, ZIP + individual downloads, configurable temporary retention.
- Template PDF remains until template deletion; job files expire separately.
- Downloads-first private prototype; app-managed email later.
- Individual accounts only; collaboration/teams deferred.

## Confirmed technology direction

| Layer | Current direction | Decision status |
|---|---|---|
| Frontend | React + Vite + TypeScript | User-selected |
| API | Hono + TypeScript | User-specified; Vercel for private prototype |
| Repositories | Separate web and API repos | User-selected |
| Authentication | Google Identity Services only | User-selected |
| App session | HttpOnly cookie; same-origin API topology | User-selected; exact security implementation still needs tests |
| Validation | Zod | User-selected |
| API contract | OpenAPI between repositories | User-selected |
| Metadata/job state | MongoDB | User-selected foundation |
| Queue direction | MongoDB-backed work records | User-selected direction; needs explicit dispatcher/claims/leases |
| Objects | Cloudflare R2 | User-selected candidate; quota caps required |
| PDF | PDF.js for inspection/rendering; pdf-lib for drawing/modification | Recommended library combination, not arbitrary text replacement |
| Execution | Browser Web Worker chunks; pause/resume | User-selected |
| Progress | Poll persisted API/database state | User-selected |
| ZIP | Browser-bounded archive creation | User-selected; needs benchmarks |
| Email | Not in first prototype; provider undecided | User-selected sequence |
| Email library | Nodemailer or equivalent to investigate | Request to investigate, not package decision |
| Testing | Node LTS, npm, Vitest, Playwright, GitHub Actions | User-selected recommended-stack default |

## Main conflicts to manage explicitly

### Strict $0 vs production-grade autonomous work
Free/serverless services have limits. Browser processing pauses after close. If the product later needs autonomous all-night jobs, a persistent worker may require revisiting hosting/budget constraints.

### Strict expiry vs free-capped email
A 5,000-email batch may take 17 days at a 300/day limit or at least 50 days at a 100/day limit (the latter also has a monthly cap), much longer than 24-hour or 7-day retention. The selected rule is strict deadline: stop unsent work when outputs expire, mark `expired_unsent`, and do not keep files alive silently.

### General-purpose categories vs constrained PDFs
All document categories from launch does not mean all PDF files/layouts are supported. Unsupported backgrounds should fail safely or require clean placeholder areas.

### Vercel Hobby vs future public app
Vercel Hobby terms are for personal/non-commercial use. It is selected for the private prototype only, not a confirmed public launch solution.

### Efficient mail code vs provider quota
Nodemailer can pool connections and reduce overhead. It does not increase free account quotas or guarantee inbox delivery.

## Open decisions

Final name/tagline/logo/domain; launch niche for user testing; public hosting under $0; exact max file/page/field/row/archive limits; final provider; exact provider account eligibility and attachment behavior; actual deployment cookie/domain configuration; measured browser memory/performance; exact OpenAPI generator; and future feature priorities.

## MVP success condition

A private tester can upload a supported PDF and CSV/XLSX, map fields, fix row errors, review every draft, approve an immutable snapshot, generate correct PDFs in the browser without freezing the interface, download outputs, resume after interruption, and see temporary deletion tracked. Real email remains disabled until the PDF/download pipeline, retention and recovery pass acceptance tests.
