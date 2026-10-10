# Hosting, Storage and Zero-Cost Constraints

## Explicit constraints and choices

- A strict $0 infrastructure budget was explicitly selected.
- Hono on Vercel is the intended private prototype arrangement, not a confirmed public launch host.
- React/Vite and API source code are in separate repositories, with same-origin browser/API access desired.
- MongoDB is the source of truth for app metadata, job state and queue records.
- Cloudflare R2 is the selected object-storage candidate.
- PDF generation is browser-side and pauses on browser close.
- Live email is after the downloads-first prototype.

## Vercel/Hono

Hono is technically supported on Vercel. However, Vercel Hobby terms restrict use to personal/non-commercial purposes. It is selected only for a private prototype. Public release needs a hosting option whose current terms fit the intended use and the hard $0 constraint; do not silently move to a paid plan.

Vercel Functions have a documented 4.5 MB request/response body limit. Upload PDFs/ZIPs directly to private R2 using short-lived, object-scoped signed URLs rather than routing large file bodies or base64 attachments through Hono.

Same-origin access can be achieved only if deployment routing/domain configuration supports it. Confirm the real cookie/API topology in preview deployments. The source repos can remain separate while being exposed under one origin.

## Cloudflare R2

The published R2 standard free allowance observed on 10 October 2026 was 10 GB-month storage, 1 million Class A operations/month, 10 million Class B operations/month and no internet egress fee. Overages can be billed. R2 lifecycle expiration is asynchronous; objects are typically removed within 24 hours of the expiration field, and existing objects after rule changes may take longer. Application-side caps and a direct cleanup sweep are required.

Use separate private object namespaces for:
- Saved template source PDFs (retained until template deleted).
- Temporary input files.
- On-demand preview artifacts.
- Per-recipient generated PDFs.
- ZIP archives.

All keys should be server-derived/validated; never let a user choose arbitrary bucket keys. Presigned URLs should be short-lived and scoped to a single object and operation.

## MongoDB Atlas and state size

A free Atlas cluster has constrained storage/resources; historical discovery described the M0 quota as 512 MB, but the plan details must be rechecked immediately before use. Keep PDFs/ZIPs in R2, not MongoDB. Recipient states, indexes, provider events, import snapshots and audit rows also consume storage. Aggregate history after expiry and avoid indefinite retention of recipient PII/provider details.

MongoDB TTL deletion is asynchronous and not a precise deletion clock. Use explicit expiration timestamps, a cleanup ledger and cleanup retries. TTL may be a backstop only.

## MongoDB-backed queue under browser orchestration

A queue record does not run by itself. The user selected a MongoDB queue direction, but the process that claims/drives work must be explicit. The initial execution trigger is browser-driven chunks and the selected behavior is pause/resume on return. A future autonomous worker/scheduler would change the operational model and may require revisiting hosting and budget.

## Email under strict $0

Provider quotas, not Nodemailer or HTTP batch size, determine how many messages may be sent per day/month. Brevo Free was observed at 300/day, while Resend Free was observed at 100/day and 3,000/month. 5,000 recipients need at least 17 days at 300/day or 50 days at 100/day, ignoring other limits. This interacts badly with 24-hour/7-day output expiry. The selected rule is strict expiry and `expired_unsent`, not silent retention extension.

## Render, Redis and SES notes from discovery

- Render Free has sleep/ephemeral filesystem/in-memory free Key Value constraints and blocks outbound SMTP ports 25/465/587; it should not be presumed suitable as the durable worker/storage layer.
- Upstash Redis + BullMQ was considered but is not the selected queue direction. It would still require a durable consumer and consume a free command budget.
- Amazon SES sandbox restrictions and 2026 pricing changes mean it should not be treated as permanently free without verification of the account/plan.

## Cost and eligibility policy

- Do not add paid hosting or queue services by assumption.
- Add application usage caps, storage quotas, upload/row/page limits, send caps and a kill switch.
- If a reliable, eligible public solution cannot fit $0, record the infeasibility and ask for a changed constraint instead of weakening correctness, privacy or the strict deadline silently.
- Do not claim always-on background work when the design depends on the browser being open.

## Official references

- Vercel terms: https://vercel.com/legal/terms
- Hono on Vercel: https://vercel.com/docs/frameworks/backend/hono
- Vercel function limits: https://vercel.com/docs/functions/limitations
- R2 pricing: https://developers.cloudflare.com/r2/pricing/
- R2 lifecycle: https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- Atlas pricing: https://www.mongodb.com/pricing
- MongoDB TTL: https://www.mongodb.com/docs/v8.0/core/index-ttl/
- Render free: https://render.com/docs/free
