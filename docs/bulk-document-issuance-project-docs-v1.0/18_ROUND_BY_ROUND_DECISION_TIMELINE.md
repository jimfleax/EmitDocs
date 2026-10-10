# Round-by-Round Decision Timeline

The full interview answers are in `04_DISCOVERY_HISTORY_AND_INTERVIEW_RECORD.md`; detailed authored reasoning is retained in `source-logs/`.

| Round | User-selected values | Main consequence |
|---|---|---|
| Initial brief | Existing PDF + data list; unique docs; download/email; queued errors/retries; future lightweight editor; TypeScript/Node/MongoDB | Need robust PDF compatibility, generation, delivery, lifecycle and error handling. |
| 1 | General-purpose users; auto placeholder detection + visual fallback; confirm detection; 500–5,000; email undecided; temporary storage; simplest existing-PDF workflow; free initially | Broad product vision with a constrained, benchmarked PDF core. |
| 2 | All document categories; text PDFs with suggestions; confirmed overlays; text/date/number; CSV/XLSX; browse every draft; app-managed individual attachments; configurable deletion; reusable templates/accounts; delivery retries priority | Review gallery, template reuse and separate output/delivery states. |
| 3 | Browse all drafts; isolate invalid rows; automatic throttle/retry transient; organizer mailbox later; clean placeholder fields for unsupported backgrounds; retain template PDF until deletion; ZIP+individual; individual accounts; pause/resume/cancel unsent | Row isolation, cancellation semantics, template/job retention separation. |
| 4 | Most choices undecided; asynchronous progress/no fixed completion promise; open registration with minimal restrictions | Persistent status and safeguards needed; no SLA claims. |
| 5 | Google-only; inline edits + re-import; capped multipage; fit-then-flag; benchmark limits; aggregate history; ordinary document sensitivity; strict $0; free-capped email; public-guarded registration | Zero-cost constraint affects service topology; error and safety behavior matters. |
| 6 | React/Vite; backend initially undecided; separate repos; Google Identity; browser PDF; MongoDB queue; R2; serverless chunks; polling; Zod; later clarified Hono on Vercel and frontend-orchestrated PDF/email | Browser is the compute orchestrator; server secrets stay in Hono; Vercel only private prototype. |
| 7 | Pause/resume; frontend-Hono email orchestration; HttpOnly cookie; immutable snapshot; diff/reconcile; warn/preserve duplicate; detailed email states; reconcile unknown before retry; bounded retry; 24h/7d/30d; browser-bounded ZIP; strict secret boundary; private-first | Snapshot hashes, leases/checkpoints, per-recipient state, cleanup ledger and fault testing. |
| 8 | Vercel private prototype; same-origin cookie topology; compare providers; manual matching when uncertain; completion-deadline; same-pipeline preview; benchmark-before-promise | Public host remains open; retention/quota conflict needs explicit rule. |
| 9 | Strict output deadline; downloads-first; daily cleanup sweep; OpenAPI; Node LTS/npm/Vitest/Playwright/GitHub Actions; use Nodemailer or similar to improve email sending efficiency | Live email postponed; strict expiry; provider batching/connection reuse is not quota bypass. |

## Decisions that evolved

- Email was initially undecided, then selected as an eventual app-managed attachment workflow, but the first prototype was explicitly set to downloads-first.
- Backend was initially undecided and then clarified as Hono on Vercel for the private prototype; a compliant public host remains open.
- Architecture options discussed BullMQ/Redis and server workers, but the user selected a browser execution model and MongoDB queue direction. No continuously running worker is implied.
- The user requested Nodemailer or similar; this is a preference to investigate, not a selected provider or final package.
- The product remains general-purpose in categories, but first audience/recruitment niche is undecided.
- Branding was not yet decided at the end of the interview.

## Product invariants

1. Start from the user’s existing PDF.
2. Suggest fields; the user's confirmation is authoritative.
3. Fail safely on unsupported layouts.
4. Browse every draft before approval.
5. Freeze the approved version.
6. Process valid rows even if other rows are invalid.
7. Preserve duplicate records but avoid duplicate operation sends.
8. Each recipient gets only their own document.
9. Closing the browser pauses compute.
10. Downloads work independently of email availability.
11. Provider acceptance is not the same as inbox delivery.
12. Unknown sends are reconciled before retry.
13. Strict expiry stops unsent work; retention is not silently extended.
14. Nodemailer/batching does not bypass quotas.
15. Secrets remain server-side.
16. Public launch needs eligible hosting, abuse control and test gates.
17. App name/tagline are not chosen.
