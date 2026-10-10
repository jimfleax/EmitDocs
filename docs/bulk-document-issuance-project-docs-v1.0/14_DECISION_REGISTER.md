# Authoritative Decision Register

**As of:** 10 October 2026. This register is authoritative for current status. Older source logs remain available for history.

## Status labels

- **USER-DECIDED:** Explicit choice by the user.
- **USER-PREFERENCE/TARGET:** Stated direction, with measurable details still open.
- **RECOMMENDATION:** Assistant proposal, not accepted unless the user explicitly accepted it.
- **TECHNICAL FACT (DATED):** Source-specific finding; re-check time-sensitive facts.
- **OPEN:** Not selected.
- **DEFERRED:** Intentionally not in current milestone.
- **CONFLICT/RISK:** Requirements interact in a way that requires explicit handling.

## Product scope and UX

| Item | Current status | Evidence/implication |
|---|---|---|
| General-purpose audience | USER-DECIDED | R1; long-term launch-niche recruitment remains open. |
| All document categories from launch | USER-DECIDED | R2; use-case breadth does not promise arbitrary PDF support. |
| Existing PDF is the starting point | USER-DECIDED | Initial brief; don't require recreating the design in app. |
| Automatic placeholder suggestions + visual fallback | USER-DECIDED | R1/R2; suggestion needs user confirmation. |
| First PDF compatibility | USER-DECIDED | Text-based PDFs with auto field suggestions; token detection + confirmed overlays; clean placeholder areas for unsupported background layouts. |
| OCR/image-only PDFs | DEFERRED/NOT COMMITTED | No universal arbitrary PDF or OCR promise. |
| Variable fields | USER-DECIDED | Text, dates, numbers. Image fields/signatures/photos are future possibilities only. |
| Data import | USER-DECIDED | CSV/XLSX with column mapping. Pasting and Google Sheets integration not selected. |
| Batch target | USER-PREFERENCE/TARGET | 500–5,000 records. Advertised maximum waits for benchmarks. |
| Review all drafts | USER-DECIDED | All individual drafts must be browseable before approval, preferably via searchable/paginated gallery and on-demand preview. |
| Invalid records | USER-DECIDED | Isolate affected rows; allow valid rows to continue. |
| Inline edits + re-import | USER-DECIDED | Both must work. Re-import creates a diff/reconciliation step. |
| Ambiguous row matching | USER-DECIDED | Manual reconciliation if no reliable unique key; don't silently match by row order/name/email. |
| Duplicates | USER-DECIDED | Warn and preserve; don't silently drop legitimate records. Prevent duplicate operation sends for same recipient-document revision. |
| Multi-page PDFs | USER-DECIDED | Capped multi-page support; cap comes from benchmarks. |
| Text overflow | USER-DECIDED | Fit-then-flag; no silent clipping. Exact font-size floor and wrap policy are implementation details/open. |
| Preview parity | USER-DECIDED | Same processing pipeline for preview and final output. |
| Approval data | USER-DECIDED | Immutable snapshot of effective records, overrides and template/mapping version. |
| Downloads | USER-DECIDED | ZIP of individual PDFs plus optional individual downloads; browser bounded, split if needed. |
| Template reuse | USER-DECIDED | Accounts, reusable templates and temporary job history. Source template PDF retained until template deletion. |
| Accounts | USER-DECIDED | Individual accounts only for MVP; team workspaces deferred. |
| Job control | USER-DECIDED | Pause/resume/cancel unsent work; completed generation/sends stay recorded. |
| Browser close | USER-DECIDED | Processing pauses and resumes when user returns. No autonomous work claim while browser is closed. |
| Progress | USER-DECIDED | Persisted accurate progress; no fixed completion-time promise before benchmarking. |
| Future editor | USER-PREFERENCE/DEFERRED | Lightweight Canva-like PDF editor is future direction, not first prototype. |
| Future extensions | USER-DECIDED PRIORITY | Delivery tracking and retries are first extension priority; email itself comes after downloads-first proof. |

## Architecture and tooling

| Item | Current status | Evidence/implication |
|---|---|---|
| Frontend | USER-DECIDED | React + Vite + TypeScript. |
| Backend | USER-DECIDED DIRECTION | Hono + TypeScript; selected by user's additional Round 6 note. |
| Repositories | USER-DECIDED | Separate web and API repos. Suggested repo labels are not approved names. |
| Hosting | USER-DECIDED FOR PRIVATE PROTOTYPE | Vercel Hobby for private non-commercial prototype only; public host remains open under strict $0. |
| Authentication | USER-DECIDED | Google Identity Services only. Backend token verification required. |
| App session | USER-DECIDED | HttpOnly cookie. |
| Browser/API topology | USER-DECIDED | Same-origin request arrangement despite separate source repos. Exact domain/proxy must be tested. |
| MongoDB | USER-DECIDED FOUNDATION | Durable metadata/state. Exact cluster/free eligibility and schema still need validation. |
| Queue | USER-DECIDED DIRECTION | MongoDB-backed queue. Queue needs explicit work dispatcher/claims/leases and cannot run itself. |
| Object store | USER-DECIDED CANDIDATE | Cloudflare R2, with hard usage caps. |
| PDF execution | USER-DECIDED | Browser/Web Worker chunks. |
| Progress transport | USER-DECIDED | Polling persistent state. |
| Validation | USER-DECIDED | Zod. |
| API contract | USER-DECIDED | OpenAPI between repos. Generator and client implementation still open. |
| Dev defaults | USER-DECIDED DEFAULT | Supported Node LTS, npm/lockfiles, Vitest, Playwright and GitHub Actions. |
| PDF libraries | RECOMMENDATION | PDF.js for inspection/rendering, pdf-lib for drawing/modification; test compatibility. |
| Provider/queue/object libs | OPEN/PROPOSED | Don't assume Resend, Brevo, Nodemailer, BullMQ/Redis or a ZIP library is final. |

## Privacy, retention, operational rules

| Item | Current status | Evidence/implication |
|---|---|---|
| Temporary job data | USER-DECIDED | User-configurable automatic deletion. |
| Presets | USER-DECIDED | 24 hours, 7 days, 30 days; 30-day maximum in MVP. |
| Template source retention | USER-DECIDED | Keep source until template is deleted; expire job files separately. |
| Post-expiry history | USER-DECIDED | Aggregate counts and timestamps only as the long-lived summary. |
| Timer semantics | USER-DECIDED | Completion-deadline (Round 8). Exact edge rules for abandoned drafts should be documented during implementation. |
| Expiry vs pending email | USER-DECIDED | Strict deadline: unsent files/rows expire; do not silently extend retention. Mark unsent work `expired_unsent`. |
| Physical deletion | USER-DECIDED OPERATION | Daily sweep under $0, direct deletions, cleanup ledger/retries, lifecycle backstop. Disclose actual physical deletion may lag. |
| Sensitivity | USER-DECIDED | Ordinary personal/business documents for MVP; no unsupported regulated-data compliance claims. |
| Operating budget | USER-DECIDED | Hard zero cost. If no compliant public deployment can work at $0, raise as a blocking conflict rather than silently adding paid services. |

## Email and launch

| Item | Current status | Evidence/implication |
|---|---|---|
| App-managed email | USER-DECIDED FUTURE FEATURE | One PDF attachment per recipient. |
| First prototype | USER-DECIDED | Downloads-first; no live email sending before core PDF/download flow passes. |
| Organizer mailbox integration | DEFERRED | Gmail/Outlook connection later. |
| Email quotas | USER-DECIDED | Free-capped. Queueing does not remove quota. |
| Throttle/retry behavior | USER-DECIDED | Auto-throttle, retry transient errors, expose permanent failures. |
| Delivery statuses | USER-DECIDED | Distinguish queued/sending/provider accepted/delivered/bounced/complained/failed/unknown as provider events support. |
| Ambiguous outcome | USER-DECIDED | Reconcile before retry; never blindly retry. |
| Retry attempts/backoff | RECOMMENDATION | Up to 5 attempts with exponential backoff/jitter was proposed; provider-specific error taxonomy still required. |
| Nodemailer | USER REQUEST TO INVESTIGATE | “Nodemailer or something” to improve sends. Not a selected dependency, service or quota bypass. |
| Email provider | OPEN | Compare providers later; Brevo is a research candidate, not selected. Resend is also not selected. |
| Registration | USER PREFERENCE | Open registration with minimal restrictions, guarded for sending. |
| Launch gate | USER-DECIDED | Private-first; security/recovery and quota tests before public bulk email. |

## Current recommendations, not accepted choices

- Focus user interviews on one launch segment while keeping the product architecture general-purpose.
- Use a paginated/searchable draft gallery and on-demand previews.
- Use an OpenAPI-generated frontend client, enforce CI drift checks.
- Direct upload/download with short-lived R2 signed URLs.
- Use a provider adapter and enable batch send only after unique attachment behavior is proven.
- Keep all live email disabled in the first prototype.
- Benchmark on representative browser/device/PDF fixtures; set published hard limits from measurements.
- Before public launch, add sending-specific verification, global/account/batch caps, bounce/complaint suppression, abuse reporting and a kill switch.

## Open questions

1. Final app name, tagline, logo, color palette, domain, tone, trademarks.
2. First audience segment to recruit for research.
3. Public host that is both eligible under terms and $0.
4. Max upload size, page count, rows, fields, concurrent jobs and archive size.
5. Provider, sender identity/domain, message attachments, quotas, webhook events and account eligibility.
6. Actual browser/device benchmark and ZIP library/strategy.
7. Cookie lifetime/rotation/CSRF specifics and exact DNS/proxy deployment.
8. OpenAPI generator/client tooling.
9. Exact cleanup failure UX and abandoned-draft timer details.
10. Future public verification/QR IDs, corrections/reissue, editor, teams, Google Sheets/API integrations.
11. Acquisition channels, success metrics, product analytics and future monetization.

## Contradictions / feasibility risks

- Strict deadline + retention presets vs free provider quota: 5,000 messages can take 17–50+ days under current example free quotas, longer than retention; preflight feasibility check and `expired_unsent` are required.
- Browser processing + “background”: work pauses when browser closes; don't market it as autonomous.
- Vercel Hobby + public/monetized product: public hosting eligibility is unresolved.
- Any document category vs PDF compatibility: scope is broad by category, constrained by file/layout.
- Nodemailer concurrency vs provider quota: cannot create additional allowance.
- Hard $0 vs reliable autonomous queue: if constraints conflict, explicitly ask to revisit instead of silently violating them.
