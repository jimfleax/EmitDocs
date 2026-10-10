# Development stages and vertical-slice dependency map

Each stage must deliver a coherent, testable user capability across UI, API, persistence and storage. This is a recommended order; visual design remains flexible.

| Stage | PRD | User-visible outcome | Dependencies | Exit gate |
|---|---|---|---|---|
| 0 | CORE-01 | User signs in and sees a private workspace | Google Identity, Hono, MongoDB sessions, same-origin route | Valid sign-in succeeds; invalid session/cross-user access fails |
| 1 | CORE-02 | User saves and reopens PDF templates | Auth, R2, signed URLs | Private upload and versioned template reuse work |
| 2 | CORE-03 | User maps fields and previews a sample | Template version, PDF.js, overlay generator, fonts | Correct preview, safe unsupported-layout path |
| 3 | CORE-04 | User imports spreadsheet and sees validated rows | Batch, parser, validation rules, MongoDB | Row errors and duplicate warnings are accurate |
| 4 | CORE-05 | User reviews every draft, edits and reconciles re-imports | Preview pipeline, import revisions | No silent row loss/matching |
| 5 | CORE-06 | User approves immutable data/template revision | Template/import versions and row state | Snapshot digest/count stable and immutable |
| 6 | CORE-07 | User generates PDFs with progress/resume | Snapshot, R2, MongoDB lease/checkpoint | Interruption/retries don't duplicate or misassign outputs |
| 7 | CORE-08 | User downloads PDFs/ZIP archives | Output records, signed URLs, ZIP strategy | Archive integrity and limits tested |
| 8 | CORE-09 | Files expire and deletion is retried | All resources plus cleanup ledger | Logical expiry, cleanup retry and account deletion pass |
| 9 | CORE-10 | Maintainer can run private pilot safely | All prior stages, CI, runbooks | Private pilot gates pass; public blocker documented |
| Deferred | D-01 | Send one attached PDF per recipient | Provider/account eligibility, quota/expiry preflight | Correct attachments, reconciliation and abuse controls pass |
| Deferred | D-02 | Lightweight PDF editor | CORE-02/03 | Edits save as immutable template versions |
| Deferred | D-03 | Authenticity verification/QR | Identifier and revocation model | Privacy-minimized public verification |
| Deferred | D-04 | Correct/revoke/reissue document | Snapshots and output lineage | Original/replacement history auditable |
| Deferred | D-05 | Integrations/public API | API security, scopes, quotas | Versioned, rate-limited contract |
| Deferred | D-06 | Teams/workspaces | Authorization abstraction | Tenant and role tests pass |
| Deferred | D-07 | Analytics/monetization exploration | Privacy model, usage/cost data | Metrics data-minimized; pricing validated |
| Deferred | D-08 | Brand and launch readiness | Name/market research, host terms | Truthful claims and availability screening |

## Integration rules

- Auth and PDF fixture work can proceed in parallel, but no real data before ownership/security tests pass.
- Import parsing should use bounded chunks, not one large JSON request.
- Review and snapshot creation must agree on import revisions, manual overrides, validation and canonical digest.
- One browser dispatcher owns a batch lease. The MongoDB queue records work but doesn't autonomously execute.
- Browser close pauses generation; persisted checkpoints enable recovery on return.
- Outputs are durable in R2, not only in browser memory. ZIP generation has tested memory/splitting limits.
- Retention and deletion are required before real-data pilots.
- Email is not a dependency of generation/downloads and remains disabled in the first live prototype.

## Release checkpoints

1. **Local proof:** local/test auth and synthetic PDF fixture; no personal recipients.
2. **Private integration prototype:** real Google sign-in, MongoDB, R2 and one supported PDF-to-download path.
3. **Private pilot:** retention, deletion, recovery and security tests pass using a limited test group.
4. **Public eligibility gate:** find compliant hosting under hard ₹0 terms or raise the conflict for a direct user decision. Do not infer approval for paid services.
