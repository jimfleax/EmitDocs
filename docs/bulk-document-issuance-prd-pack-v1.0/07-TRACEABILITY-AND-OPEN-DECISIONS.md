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
