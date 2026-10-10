# Test strategy, acceptance gates and release plan

## Test layers

- **Unit:** CSV/XLSX normalization, token suggestions, coordinate transforms, mask checks, fit rules, Unicode glyph validation, snapshot digest, filename sanitizer, retention deadlines, status transitions and idempotency keys.
- **Component:** upload states, mapper/property panel, import mapping, row errors, draft gallery, re-import conflicts, approval summary, progress controls, downloads and expiry warnings.
- **API/contract:** Hono + Zod + OpenAPI; ownership, cookie/session, imports/chunk idempotency, claims/checkpoints, signed URL scope, lifecycle transitions and safe error envelope.
- **Integration:** Google token verification, MongoDB indexes, R2 upload/download/delete, row imports, generation checkpoint, cleanup sweep.
- **E2E (Playwright):** Sign-in/test fixture → template upload → mapping → CSV/XLSX import → review/edit/re-import → approve → generate → download/ZIP → expiry/cleanup simulation.
- **Performance/resource:** PDF fixtures, multipage/font cases, browser worker memory, repeated chunks, ZIP split limit, Atlas connection/index use, R2 usage caps.
- **Security:** cross-user access, expired/reused signed URL, malformed/oversized files, hostile filenames, CSRF/session revocation, content-type mismatch, key guessing, rate limits, cleanup authorization.
- **Manual:** gallery on large synthetic batches, long/Unicode strings, rotated pages, browser interruption/resume, low-memory device behavior.

## Fixture corpus

1. Single-page certificate with `{{name}}` and `{{date}}` in clean field regions.
2. Multi-page text PDF with fields on distinct pages.
3. Embedded font and supported Unicode script fixtures.
4. Long names/values causing shrink/overflow.
5. Rotated page/non-default dimensions.
6. Text region over unsafe pattern/artwork; expected warning/unsupported result.
7. Token split across PDF text fragments.
8. Scanned/image-only PDF; unsupported; no OCR claim.
9. Corrupt/encrypted/password-protected PDF.
10. CSV/XLSX with blank/duplicate headers, missing values, date/number ambiguity, formula with no cached value, duplicates and Unicode.
11. Batch sizes tested progressively at 500, 1,000 and 5,000 rows; maximum advertised capability only after measurements pass.

## Acceptance gates

### Identity/ownership
- Invalid Google ID-token claims rejected; sessions can be revoked; cookie behavior matches deployed topology.
- Cross-user template/batch/row/output requests denied.
- No DB/R2/session/email secrets in web bundle.

### Template/PDF
- Source remains private and reopens for owner only.
- Coordinates correct across scale/rotation/multipage fixture.
- Unsafe mask, missing glyph and overflow surfaced; no silent clipping or wrong output.
- Preview and final output use the same logic and pass text/raster baseline.

### Import/review/snapshot
- Header/worksheet rules applied; valid/invalid rows separated; duplicates preserved with warnings.
- Inline edits survive refresh and revalidate; re-import diff/manual match rules hold.
- Snapshot contains hashes/effective data and cannot mutate after approval.

### Generation/recovery
- Benchmarks completed before hard cap published.
- Close/reopen/refresh pauses then resumes without duplicate outputs or incorrect counters.
- Two-tab claim race permits one active lease; stale lease writes rejected.
- Pause/cancel at safe boundary; completed outputs preserved.
- Per-recipient failure does not block unrelated rows unless error is systemic.

### Downloads/retention
- ZIP entries map to outputs/recipients; no cross-owner or expired URL access.
- ZIP memory threshold respected or output split/gracefully stopped.
- Expired URL not issued; cleanup failures persisted/retried; PII removed from normal access/history.
- Account deletion revokes session immediately and schedules owned resource deletion.

### Future email gate
- Provider and sender eligibility, attachment size, quota and webhook validation verified.
- Different output attachment sent to correct recipient only.
- Send preflight respects strict expiry; ambiguous outcomes reconcile before retry; duplicate webhooks idempotent.
- Bounces/complaints suppressed and abuse/kill controls in place.

### Private pilot/public launch gate
- CI: format/lint/typecheck/unit/API contract/Playwright/build/dependency checks pass.
- Hard free-tier limits and error states tested.
- Cleanup/runbook and privacy language match behavior.
- Private prototype hosting use permitted; public launch blocked until a qualifying ₹0 host is verified or budget decision changes.
- Email remains disabled during downloads-first prototype.

## Key test matrix

| ID | Scenario | Expected result |
|---|---|---|
| OWN-01 | User guesses another user's output ID | safe denial; no signed URL |
| UP-01 | Non-PDF content named `.pdf` | reject before template activation |
| PDF-01 | Long value doesn't fit | shrink within bounds, then flag; never clip silently |
| FONT-01 | Missing glyph | visible error/blocker; no silent substitution |
| IMP-01 | Formula has no cached value | field flagged; no guessed value |
| IMP-02 | Repeated email | all rows preserved with warning |
| REV-01 | Re-import has no unique key | manual reconciliation; no positional merge |
| SNAP-01 | Template edited after approval | existing snapshot output unchanged |
| GEN-01 | Upload succeeds, checkpoint fails | resume reconciles output/checksum; no duplicate output |
| GEN-02 | Two tabs claim work | only one valid lease |
| GEN-03 | Cancel during chunk | safe-boundary cancellation; completed files remain |
| ZIP-01 | ZIP exceeds cap | split/stop gracefully with useful message |
| EXP-01 | Output expired | no new URL; future queued send becomes `expired_unsent` |
| CLN-01 | R2 delete fails | cleanup task stays pending/retryable |
| SES-01 | Revoked session reused | API denies access |

## Metrics (privacy-minimized)

Time to first preview; import validation duration; preview errors; generation throughput/memory; resume success; output mismatch (must be zero in tests); ZIP completion/split rate; R2 usage; cleanup lag/failures; API error rate and test pass rates. No recipient/document contents in analytics. Email metrics are deferred.
