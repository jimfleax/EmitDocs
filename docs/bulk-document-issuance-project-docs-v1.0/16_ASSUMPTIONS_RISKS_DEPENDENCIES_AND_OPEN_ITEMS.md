# Assumptions, Risks, Dependencies and Open Items

## Assumptions currently being used for planning

1. Many intended users already have a PDF design they wish to preserve rather than recreate in a new editor.
2. For supported PDFs, text extraction and overlays can be made visually reliable enough with user confirmation.
3. Browser processing can support an agreed portion of 500–5,000-record batches with bounded chunks and careful memory management.
4. R2 can support early private prototype volumes within free quotas if caps are enforced.
5. Browser-driven generation is acceptable even though it pauses when the browser closes.
6. A paginated/on-demand gallery can let an organizer inspect every draft without opening every final PDF manually.
7. Free-capped email is useful despite potential delivery delay, but user tolerance for 17–50+ day large-batch delivery has not been validated.
8. Public registration can coexist with guardrails and verified sending entitlement.
9. General-purpose means document categories, not arbitrary file layouts or regulated use cases.

None of these assumptions should become a public claim without customer validation, source verification or benchmarks.

## High-priority risks

| Risk | Severity | Why it matters | Mitigation / evidence needed |
|---|---|---|---|
| Some PDFs cannot be safely text-replaced | High | PDF layout often lacks semantic text boxes; mask may destroy design | Compatibility boundary, clean-field requirement, preview and safe rejection |
| Browser memory exhaustion | High | Thousands of generated PDFs and ZIP bytes can accumulate | Web Worker chunks, incremental R2 uploads, bounded/split ZIP, browser benchmarks |
| Browser closes mid-job | High | Browser compute halts | Persist checkpoints; resume/reconcile on return; no autonomous-work claim |
| MongoDB queue has no independent consumer | High | Database job records do not run themselves | Explicit browser dispatcher/claim protocol; independent worker is not in current design |
| Public hosting may not fit $0 | High | Vercel Hobby is personal/non-commercial | Private prototype only; solve eligible public hosting before beta |
| Provider quota too small | High | 5,000 sends take 17–50+ days under current example free tiers | Downloads-first, delivery/retention preflight, transparent limits |
| Strict expiry occurs before send | High | A queued recipient may lose its output before send | Strict deadline and `expired_unsent`; don't silently extend retention |
| Duplicate/unknown send | High | A timeout after provider acceptance can lead to duplicate emails | Stable application send key, provider IDs/events, reconciliation before retry |
| Deletion delay | High | MongoDB TTL and R2 lifecycle are asynchronous | Daily sweep, direct deletes, ledger, retry, transparent copy |
| Exposed client secret | High | Vite `VITE_*` values are bundled publicly | Server-only secrets, CI secret scanning, no direct DB from browser |
| Abuse/sender reputation | High | Public registration with bulk email can be abused | Email-send verification gate, quotas, suppression, abuse reporting, kill switch |
| Cross-user leakage | High | PDFs contain personal data | Object-level authorization, private buckets, scoped URLs, penetration tests |
| Brand collision | Medium | No name/availability check | Name/domain/trademark screening before launch |
| Competitors already offer similar features | Medium/High | Bulk generation/browser processing/free workflows exist | Hands-on comparison and interviews; differentiate on workflow/reliability only if validated |

## Conflicts that must not be silently resolved

### Strict zero cost vs autonomous, reliable execution
A free/serverless prototype can support bounded interactive jobs, but that is not equivalent to a continuously running worker. The chosen model pauses when the browser closes. If future requirements require autonomous processing, infrastructure/budget may have to change; request an explicit decision rather than assuming paid services.

### Strict expiry vs free email quotas
The user selected strict output deadlines and retention presets of 24 hours, 7 days and 30 days. Current free provider examples are much slower for 5,000 messages. Before dispatch, estimate whether the run can finish within retention. Pending sends expire as `expired_unsent`; files are not retained silently.

### Any category vs supported PDF layouts
The category list is broad but formats/layouts are constrained. Scanned PDFs/OCR, universal in-place editing and arbitrary masking are not MVP promises.

### Unique attachment per recipient vs batch API
A batch API may accept many recipient versions but not document a distinct attachment override for each. Prove capability before use; otherwise send one message per recipient under controlled concurrency.

### Nodemailer vs quota
Nodemailer can reduce connection overhead with pooled SMTP connections. It cannot raise provider/account quota, sender trust or deliverability guarantees.

### User-configurable deletion vs exact physical removal
The product can enforce deadlines and directly request deletion, but infrastructure deletion is asynchronous. Do not promise instantaneous physical erasure at the exact deadline.

## Dependencies to clear early

- Google Identity client configuration and backend token verification.
- Same-origin deployment routing and cookie/CSRF flow.
- Private R2 bucket, CORS configuration (only as required), signed upload/download flow and direct deletion.
- MongoDB connection, indexes, atomic claims/leases and state invariants.
- PDF fixture bank representing supported and unsupported layouts.
- OpenAPI generation and frontend client generation.
- A browser chunk-dispatch protocol that prevents two tabs from producing conflicting outputs.
- An eligibility-approved public host under strict $0 before public beta.
- Provider, sender configuration, attachment proof-of-concept and webhook signature handling before live email.

## Open items by milestone

### Before the first vertical slice
- Confirm local and preview same-origin `/api` setup.
- Choose the minimal Hono/OpenAPI generation package.
- Define session lifetime/rotation, CSRF and cookie attributes.
- Configure R2 private access, short-lived signed upload/download URLs and hard storage caps.
- Create PDF fixtures and supported/unsupported rules.

### Before generation MVP
- Freeze exact MongoDB schemas/indexes and concurrency/lease behavior.
- Define row IDs, overrides, snapshots/checksums and reconciliation algorithm.
- Define cancellation behavior for already-created objects under the retention deadline.
- Benchmark multi-page previews, worker chunk sizes and ZIP strategy.

### Before email
- Compare Brevo/Resend/other current providers and account eligibility.
- Prove different PDF attachments can only be sent to the correct recipients.
- Define quotas, sender verification, acceptable use and complaint/bounce suppression.
- Verify webhook signatures, retryable vs permanent error classification and ambiguity reconciliation.
- Test strict expiry while sends are pending.

### Before public beta
- Find an eligible $0 host or explicitly revisit the zero-budget constraint.
- Pass cross-account/security, upload parsing, cleanup and recovery tests.
- Write privacy/deletion/acceptable-use disclosures consistent with behavior.
- Finalize name/domain/logo and public claims after availability checks.

## Market/product assumptions to validate

- How often initial users need 500–5,000 documents rather than tens/hundreds.
- Whether users have existing PDFs, or prefer to design within Canva/certificate apps.
- Whether users accept browser-paused work and confirm visual masks.
- Which step consumes the most time: creation, data cleanup, review, delivery, corrections or verification.
- Whether free-paced email is tolerable, or downloads satisfy most free users.
- Whether reusable templates and repeated issuance drive retention.
- Which initial segment and acquisition channel will produce active repeat usage.
