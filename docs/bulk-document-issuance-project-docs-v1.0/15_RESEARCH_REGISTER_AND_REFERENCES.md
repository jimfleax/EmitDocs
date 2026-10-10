# Research Register and References

## 9. Current public technical references

Links were checked during discovery on 10 October 2026. Pricing, quotas and product terms may change; re-check before implementation.

- PDF.js project: https://github.com/mozilla/pdf.js
- `pdf-lib` features and documented limitations: https://github.com/Hopding/pdf-lib
- BullMQ idempotent jobs: https://docs.bullmq.io/patterns/idempotent-jobs
- BullMQ retries: https://docs.bullmq.io/guide/retrying-failing-jobs
- BullMQ rate limiting: https://docs.bullmq.io/guide/rate-limiting
- MongoDB TTL indexes and delayed expiration behavior: https://www.mongodb.com/docs/v8.0/core/index-ttl/
- Render free service constraints: https://render.com/docs/free
- Render FAQ on ephemeral filesystems: https://render.com/docs/faq
- MongoDB Atlas pricing/free tier: https://www.mongodb.com/pricing
- Upstash Redis pricing: https://upstash.com/pricing/redis
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Resend pricing: https://resend.com/pricing
- Amazon SES sending quotas: https://docs.aws.amazon.com/ses/latest/dg/manage-sending-quotas.html
- Amazon SES attachment limits: https://docs.aws.amazon.com/ses/latest/dg/attachments.html
- OWASP file-upload risks: https://owasp.org/www-community/attacks/Unrestricted_File_Upload

### 11.4 Current provider constraints verified on 10 October 2026

- **Render Free:** official documentation says free services are for exploration/testing, web services sleep after 15 minutes without inbound traffic, local changes are lost because the filesystem is ephemeral, the free Key Value service is in-memory and loses data on restart, and outbound SMTP ports 25, 465 and 587 are blocked. Avoid relying on a sleeping free instance as the sole always-on worker or on local disk as durable storage. API-based email providers use HTTPS and are a more suitable connection pattern on this host, but worker reliability remains a separate concern. Source: https://render.com/docs/free
- **Resend Free:** pricing currently lists 3,000 emails/month with a 100-email/day limit. A 5,000-recipient batch would need at least 50 sending days if the account is subject to this daily limit, ignoring other quota and deliverability considerations. Source: https://resend.com/pricing
- **Amazon SES sandbox:** new accounts are restricted to verified recipients, up to 200 messages per 24 hours and a sending rate of one message per second. Production access and larger quotas are not automatic assumptions; sandbox constraints are per AWS Region. Source: https://docs.aws.amazon.com/ses/latest/dg/manage-sending-quotas.html
- **Amazon SES message size:** SES v2 documents a maximum 40 MB total message size including attachments after Base64 encoding; the SES v1 API maximum is 10 MB including attachments after encoding. Email attachments expand during Base64 encoding, so PDF file size alone is not the correct envelope size. Source: https://docs.aws.amazon.com/ses/latest/dg/quotas.html
- **Cloudflare R2:** standard storage pricing currently includes 10 GB-month storage, 1 million Class A operations, 10 million Class B operations and free internet egress. This is a plausible object-storage candidate, not yet a provider decision; confirm S3-compatible SDK behavior, access-control model, account terms and lifecycle deletion in a prototype. Source: https://developers.cloudflare.com/r2/pricing/
- **MongoDB TTL:** TTL indexes delete eligible documents asynchronously and do not guarantee immediate deletion at the expiry instant. They are useful as a safety net, but not sufficient to promise an exact deletion time. Source: https://www.mongodb.com/docs/manual/core/index-ttl/
- **BullMQ:** retries support fixed or exponential backoff and jitter; rate limiting is global for a queue, which is useful for provider quotas. Retryable jobs must be designed to be idempotent. These queue features do not make external email delivery exactly-once. Sources: https://docs.bullmq.io/guide/retrying-failing-jobs, https://docs.bullmq.io/guide/rate-limiting, https://docs.bullmq.io/patterns/idempotent-jobs
- **PDF.js:** current API documentation exposes page/text-content APIs useful for extraction and locating candidate token ranges, but extraction is not a guarantee that arbitrary PDF text can be replaced safely. Source: https://mozilla.github.io/pdf.js/api/
- **File upload security:** OWASP recommends allowlisting types, validating actual content rather than trusting the MIME header, setting size limits, storing files away from the web root, applying authorization and considering malware scanning/sandboxing. PDFs and XLSX files must be handled as untrusted input. Source: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

These limits were checked on 10 October 2026. Pricing, free tiers, quotas and provider terms can change; reconfirm before implementation and before public launch.

## 26. Technical references consulted by v0.7 (10 October 2026)

- Google ID token verification: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token — verify signature, audience, issuer and expiry; use `sub` as the stable account identifier. (Google official docs.)
- MongoDB atomicity: https://www.mongodb.com/docs/manual/core/write-operations-atomicity/ — single-document writes are atomic; multi-document writes require careful design/transactions when cross-document atomicity is needed.
- MongoDB `findOneAndUpdate`: https://www.mongodb.com/docs/manual/reference/method/db.collection.findoneandupdate/ — suitable building block for atomic conditional claims/leases, with filter and update semantics to be tested in the actual driver.
- MongoDB Atlas Free limits: https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/ and https://www.mongodb.com/docs/atlas/reference/faq/storage/ — free cluster has a hard storage limit and tier-specific capability/connection limits; benchmark footprint and indexes.
- Vercel Hobby terms: https://vercel.com/legal/terms and https://vercel.com/docs/plans/hobby — Hobby is limited to personal or non-commercial use. This is an unresolved hosting eligibility constraint for public/general-purpose launch.
- Vercel function limits: https://vercel.com/docs/functions/limitations and https://vercel.com/docs/limits — bounded, resumable function work; verify current runtime duration/payload limits for the selected plan at deployment time.
- Cloudflare R2 presigned URLs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/ — signed URLs can grant temporary access to one operation/object and remain reusable until expiration; the docs list expiries from one second to seven days and recommend appropriate CORS.
- Cloudflare R2 CORS: https://developers.cloudflare.com/r2/buckets/cors/ — configure browser origin, method and header permissions explicitly.
- Cloudflare R2 object lifecycles: https://developers.cloudflare.com/r2/buckets/object-lifecycles/ — objects are typically removed within 24 hours after their expiration value; this supports a lifecycle backstop but not exact-time erasure guarantees.
- Resend idempotency keys: https://resend.com/changelog/idempotency-keys — documented provider-side idempotency retention is 24 hours; application-level state remains necessary.
- JSZip limitations: https://stuk.github.io/jszip/documentation/limitations.html — `generateAsync` holds the full result in memory; this supports benchmarking/splitting and investigating a streaming ZIP approach.
- PDF.js API: https://mozilla.github.io/pdf.js/api/ — text content includes fragments, transforms, dimensions and styles; extraction does not imply arbitrary PDF text can always be safely replaced.
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html — validate actual file content, allowlist types, impose size limits, authorize access, use safe storage and consider hostile files.

**Change-control rule:** v0.7 is a working specification. The user choices in Sections 15 and 17 are confirmed; all schema/route drafts, quota numbers, provider selection, numeric workload limits and exact deletion timing remain proposals until approved and tested.


---

# Version 0.8 — Round 8 decisions and implementation plan

> **Authority rule:** This section is the latest authoritative record for Round 8. Earlier round prompts and tables remain as historical context. Where older sections say an item is open, use the later status below. User selections are identified as **Confirmed choice**; engineering proposals are **Recommendation**; provider facts are **Verified constraint**. Do not silently upgrade a recommendation into a user decision.

**Version:** 0.8  
**Updated:** 10 October 2026  
**Discovery status:** Rounds 1–8 captured. Product architecture is sufficiently defined to start feasibility spikes and development planning. Provider selection, a retention-versus-email conflict, numeric limits, and public launch hosting remain open.

## 29. Provider and platform facts checked for v0.8 — 10 October 2026

| Provider/component | Verified current finding | Implication for this project |
|---|---|---|
| Vercel Hobby | Terms limit Hobby services to personal or non-commercial use. | Acceptable for a private prototype if that exact use qualifies; not a plan for the public general-purpose product. Public hosting remains open under the $0 budget. |
| Hono on Vercel | Hono documents zero-configuration deployment on Vercel. | Technical feasibility is not the same as plan eligibility or autonomous worker availability. |
| Vercel rewrites | Can proxy external-origin paths without changing the browser-visible URL. | Supports same-origin `/api/*` with separate repos; validate cookie/header semantics end to end. |
| Vercel Functions | Request/response payload size currently documented as 4.5 MB; durations are bounded by plan/runtime settings. | Upload files directly to R2 and dispatch bounded units; do not send whole source/output PDFs via API bodies. |
| Vercel Hobby Cron | Current Hobby scheduling is daily (within platform scheduling precision); failed cron invocations are not automatically retried. | Use as a cleanup backstop only; make the sweep idempotent and alert/record failures. A daily scheduler is not a durable high-frequency job queue. |
| Cloudflare R2 | Standard free allowance currently lists 10 GB-month storage, 1 million Class A requests, 10 million Class B requests and free internet egress; excess usage can be billed. | Use quotas and pre-upload checks. Do not treat the free allowance as unlimited. |
| MongoDB Atlas Free | Current Atlas docs identify a 512 MB hard storage ceiling for Free clusters, limited resource/capability access and no automatic storage overrun. | Keep PDFs out of MongoDB; store metadata and only the minimum row/history data required. Add quota monitoring/early rejection. |
| Resend Free | 3,000 emails/month and 100/day; provider-side idempotency-key retention is 24 hours. | Useful comparison candidate, but too slow for large batches and 24h provider idempotency does not replace long-lived app state. |
| Brevo Free | 300 emails/day on the Free plan; unused daily quota does not roll over. Transactional API accepts PDF attachments via URL or base64, and webhooks expose delivery and bounce/spam outcomes. | Stronger daily allowance among candidates found, but a 5,000-message batch still takes at least 17 days at the cap; test account policy, sender verification, attachment limits, signatures and free-tier eligibility. |
| Amazon SES | As of the 21 July 2026 SES pricing change, the older SES-specific 3,000 message-charge free tier is no longer available to new SES users; the Essentials plan prices email by volume. New accounts begin in a sandbox until production access is granted. | Not a permanent strict-zero candidate absent applicable credits or other verified terms; keep it in the comparison for technical/deliverability evaluation only. |
| Google Identity Services | Google says the ID token must be verified server-side, including signature, audience, issuer and expiry; use `sub` as the stable identity key. | Never trust a plain browser-supplied user ID/email. Create the app session only after token verification. |

Official sources: [Vercel Terms](https://vercel.com/legal/terms), [Vercel Hono](https://vercel.com/docs/frameworks/backend/hono), [Vercel rewrites](https://vercel.com/docs/routing/rewrites), [Vercel function limits](https://vercel.com/docs/functions/limitations), [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 lifecycle rules](https://developers.cloudflare.com/r2/buckets/object-lifecycles/), [Atlas Free cluster limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/), [Atlas storage FAQ](https://www.mongodb.com/docs/atlas/reference/faq/storage/), [Resend pricing](https://resend.com/pricing), [Resend idempotency](https://resend.com/changelog/idempotency-keys), [Brevo plans](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans), [Brevo transactional API](https://developers.brevo.com/docs/send-a-transactional-email), [Brevo webhooks](https://developers.brevo.com/docs/transactional-webhooks), [AWS SES pricing](https://aws.amazon.com/ses/pricing/), [AWS SES pricing-plan announcement](https://aws.amazon.com/blogs/messaging-and-targeting/introducing-amazon-simple-email-service-ses-pricing-plans/), [Google ID token verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## 39. Sources checked for Round 9

- Nodemailer transport types and SMTP: https://nodemailer.com/transports ; https://nodemailer.com/smtp
- Brevo free plan: https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans
- Brevo free quota FAQ: https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan
- Brevo batch transactional API: https://developers.brevo.com/docs/batch-send-transactional-emails
- Brevo single transactional API/attachments: https://developers.brevo.com/reference/send-transac-email
- Brevo SMTP relay: https://developers.brevo.com/docs/smtp-integration
- Resend current pricing: https://resend.com/pricing
- Vercel Terms (Hobby restrictions): https://vercel.com/legal/terms
- Google ID token verification for backend: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token

Checked: 10 October 2026. Recheck provider pricing, limits, terms and API behavior before implementation and launch.

## Market and provider pages rechecked while assembling v1.0 (10 October 2026)

- Canva Bulk Create official help (auto-match, manual mapping and current listed selection cap): https://www.canva.com/help/bulk-create/
- Certifier current feature page: https://certifier.io/features
- Certifier bulk generator page: https://certifier.io/features/generator
- Certifier plan documentation: https://support.certifier.io/en/articles/10806136-guide-to-certifier-plans
- Accredible API docs: https://docs.api.accredible.com/
- Cgenerate open-source project information: https://github.com/cgenerate/cgenerate
- MailMyCertificate site/FAQ: https://www.mailmycertificate.tech/
- Give My Certificate user reviews (anecdotal source, not representative study): https://www.g2.com/products/give-my-certificate/reviews
- Brevo batch transactional API: https://developers.brevo.com/docs/batch-send-transactional-emails
- Brevo send transactional email API reference (attachment field and messageVersions schema): https://developers.brevo.com/reference/send-transac-email
- Brevo pricing plans: https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans
- Resend current pricing: https://resend.com/pricing
- Nodemailer pooled SMTP documentation: https://nodemailer.com/smtp/pooled
- Vercel terms: https://vercel.com/legal/terms
- Vercel function payload limitations: https://vercel.com/docs/functions/limitations
- R2 object lifecycle behavior: https://developers.cloudflare.com/r2/buckets/object-lifecycles/

### Additional implications

- A dedicated browser tool such as Cgenerate already supports CSV/XLSX-based bulk certificates, validation, visual name placement and ZIP output; MailMyCertificate advertises local browser execution and Gmail sending. So browser processing and free generation are not unique differentiation on their own.
- Certifier and Accredible already cover bulk credential issuance, management and verification. The product should avoid claims that these functions do not exist elsewhere.
- Brevo batch API supports up to 1,000 personalized message versions per request, but per-version distinct PDF attachments are not documented in the override list. Must test before relying on batching for one unique PDF per recipient.
- Nodemailer pooling improves SMTP connection reuse; it does not expand the provider/account quota.
