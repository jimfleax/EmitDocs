# System Architecture

**Status:** Architecture direction selected; several production execution and hosting constraints remain unresolved. This file supersedes older architecture descriptions where they conflict with the current decision register.

## 1. User-confirmed architecture decisions

- Frontend: React + Vite + TypeScript.
- Backend direction: Hono + TypeScript on Vercel for a **private prototype**.
- Source layout: separate web and API repositories.
- Authentication: Google Identity Services only, verified server-side.
- Application session: HttpOnly cookie, with same-origin browser/API topology.
- PDF rendering, field mapping, preview and final PDF generation: browser-side, using bounded Web Worker chunks where appropriate.
- Durable application metadata/state: MongoDB.
- Queue direction: MongoDB-backed queue/claim records. This does not execute itself; the active dispatcher is browser-driven in the prototype.
- Object storage: Cloudflare R2, private by default.
- Validation: Zod.
- API contract between repositories: OpenAPI.
- Progress: polling against persisted state.
- Email: not enabled in the first prototype (downloads-first); email can later be initiated by the frontend but provider secrets and the actual authorized send call remain server-side in Hono.
- Browser closure pauses browser-run processing; users can resume when they reopen the application.
- Strict $0 infrastructure budget is an explicit user constraint.

## 2. Candidate logical architecture

```text
React/Vite application (web repository)
  ├─ Google Identity Services sign-in
  ├─ PDF.js rendering / inspection / visual field mapping
  ├─ CSV/XLSX parsing and column mapping
  ├─ searchable draft gallery
  ├─ Web Worker: bounded PDF generation chunks
  ├─ bounded ZIP generation / split archives if needed
  └─ progress polling and resume
       │ same-origin /api; secure session cookie
       ▼
Hono API on Vercel (API repository; private prototype only)
  ├─ verify Google ID token / create application session
  ├─ authorize ownership on every operation
  ├─ Zod validation
  ├─ MongoDB job/template/row/attempt state
  ├─ create scoped R2 upload/download URLs
  ├─ accept validated checkpoints
  ├─ future: email-provider adapter, webhook verification, quota enforcement
  └─ cleanup endpoint/orchestrator where compatible with the chosen free plan
       │                           │
       ▼                           ▼
MongoDB Atlas                    Cloudflare R2
users/templates/jobs             private source/template PDFs
rows/snapshots/status            per-recipient outputs / archives
attempts/cleanup ledger          expiration lifecycle + direct deletion
```

This architecture is a logical map, not a claim that every process runs continuously on free infrastructure. In the private prototype, CPU-intensive PDF work pauses when the browser closes. The MongoDB queue state must be advanced by an active dispatcher; a record alone does not execute work.

## 3. Boundaries and data movement

1. The browser authenticates with Google, obtains a Google ID token and sends it to Hono for verification.
2. Hono establishes an application session in a cookie protected for the actual same-origin deployment topology. Google token verification and app session are distinct mechanisms.
3. Hono issues short-lived, scoped R2 upload URLs. The browser uploads files directly to R2 rather than proxying large binaries/base64 through Vercel Functions.
4. Hono stores metadata and state in MongoDB. Binary PDF/ZIP data normally belongs in R2, not regular MongoDB documents.
5. PDF.js is used for render/inspection/coordinates. `pdf-lib` is used to draw/overlay personalized content and work with supported form fields; generic existing page text is not universally editable in-place.
6. The user inspects drafts using the same PDF processing pipeline used for final output; only after final approval is an immutable snapshot accepted.
7. The browser processes bounded chunks and sends completion/checkpoint metadata to Hono. Deterministic artifact keys, checksums and unique operation identifiers make repeated operations safe.
8. Download URLs are short-lived and scoped. ZIP download generation is benchmarked and bounded; large archives may require splitting.
9. Email (future phase) is initiated/orchestrated by browser chunks, but Hono makes provider calls with server-side secrets. If the browser goes away, delivery pauses unless an independent worker or scheduler is introduced later.
10. Cleanup is recorded in MongoDB and deletes R2 objects through a daily sweep; R2 lifecycle rules are a backstop, not a guarantee of instantaneous erasure.

## 4. Confirmed direction versus unapproved implementation details

### Confirmed by user

All nine architecture decisions listed in Section 1 and the follow-on Hono clarification.

### Recommended, not user-approved as exact implementation choices

- Repository names `bulk-document-web` and `bulk-document-api`.
- Exact MongoDB collections, indexes, API paths and status enum strings.
- Exact browser chunk size/concurrency, per-file/page limits, supported font policy and throughput targets.
- Exact OpenAPI generation tooling.
- Whether cleanup uses Vercel Cron, an external scheduler, or another allowed mechanism.
- Exact email provider / Nodemailer transport arrangement.
- Exact production hosting and whether a strict $0 solution exists under the provider's terms.

## 5. Hosting and zero-cost feasibility

Vercel Hobby was selected only for a private personal/non-commercial prototype because its current terms restrict Hobby use to personal/non-commercial use. Public service eligibility is unresolved and must be rechecked against current terms. The strict $0 budget is not permission to assume another provider will offer persistent, always-on workers for free.

Vercel Functions have request/response payload limits (the research snapshot recorded a 4.5 MB limit), so direct R2 upload/download is the design direction. Any future public deployment must pass a check of applicable provider terms, function duration, scheduler frequency, network constraints, storage pricing and service availability.

## 6. Queue/execution interpretation

The user's selected “MongoDB queue” is interpreted as durable queue/claim/lease records stored in MongoDB, not a queue implementation that automatically executes. The selected prototype execution model is browser-driven and resumable:

- Browser dispatcher claims a small amount of work.
- Claims use an atomic predicate/update, lease/expiry and unique operation key.
- Browser reports completion/checkpoint state through Hono.
- Stale claims are reclaimable only after their lease expires.
- On browser closure, active CPU work stops; on return, the app reloads server-persisted job state and resumes.
- Email does not begin in the first prototype.
- If later requirements demand unattended delivery after tab closure, a genuine independently scheduled worker is needed; that is a new architecture/budget decision.

## 7. Architecture risks

- Public launch host compatible with strict $0 budget: unresolved.
- Browser memory/performance for multi-page PDFs and 5,000 records: must benchmark.
- Same-origin cookie deployment across separately maintained repositories: must test.
- R2 free allowance is limited, and overage must be prevented to preserve strict zero budget.
- MongoDB Atlas Free capacity/index costs and connection/concurrency limits: test.
- R2 object deletion is asynchronous; daily sweep can fail; make deletion visible and retryable.
- A browser-held dispatcher is not an always-on background worker.
- Email provider quota remains a business/UX constraint; Node concurrency or Nodemailer pooling does not increase upstream allowances.

## 8. Reference links

- Hono on Vercel: https://vercel.com/docs/frameworks/backend/hono
- Vercel terms: https://vercel.com/legal/terms
- Vercel Function limitations: https://vercel.com/docs/functions/limitations
- Google Identity token verification: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- PDF.js: https://github.com/mozilla/pdf.js
- pdf-lib: https://github.com/Hopding/pdf-lib
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- R2 object lifecycles: https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- MongoDB TTL indexes: https://www.mongodb.com/docs/v8.0/core/index-ttl/
