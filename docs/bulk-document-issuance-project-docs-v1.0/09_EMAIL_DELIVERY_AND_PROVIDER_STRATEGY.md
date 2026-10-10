# Email Delivery and Provider Strategy

## 21. Delivery recovery and quota behavior

1. **Preparation:** ensure approved snapshot, generated object, recipient email, authorization/consent and quotas all pass. Do not queue unknown or invalid recipients.
2. **Intent:** create a `deliveryAttempt`/logical send operation with a durable application idempotency key and unique index before sending.
3. **Claim:** one Hono dispatch claims only a bounded number of due items with lease and attempts guard.
4. **Provider call:** load PDF from R2 server-side, enforce message-size envelope, attach PDF and send using a server-only API credential. Do not allow the client to select arbitrary sender fields.
5. **Persist response:** on definite provider acceptance, store provider message ID and set `accepted`; on known transient failure, schedule retry with `availableAt`; on permanent failure, mark it terminal; on ambiguous timeout, mark unknown and reconcile before a new send.
6. **Retry:** five total attempts maximum for known transient failures; exponential backoff plus jitter, clamped to provider `Retry-After`/quota windows. Respect daily/monthly caps and do not spam retries while waiting for next allowance. Permanent failures are not retried automatically.
7. **Webhook/event:** verify signature; insert provider event using unique event ID; update delivery state idempotently. Provider acceptance is not inbox delivery.
8. **Browser closure:** current selected model pauses dispatch. The next browser session fetches persisted statuses and resumes. Any active lease expires safely; do not automatically resend an item in `unknown`.
9. **Duplicate prevention:** application operation key should include provider, batch ID, approved snapshot ID, recipient ID and message purpose/revision. Provider idempotency is supplemental; Resend documents a 24-hour retention window for its keys.
10. **Quota exhaustion:** set eligible work to `retry_wait`/`waiting_for_quota` and show clear free-tier cap; do not make the user keep the tab open pointlessly until the next provider allowance. Resume when the next dispatch window is eligible.

## 37. Nodemailer, batch sending, and the actual throughput limit

### 37.1 Important correction: Nodemailer is not an email service

Nodemailer is a Node.js library for composing and transporting mail. Its standard SMTP transport sends through an SMTP relay; it also documents a dedicated Amazon SES API transport. Nodemailer can manage connections/pooling and can be used to implement controlled concurrent dispatch, but it cannot raise the provider's daily/monthly quota, bypass sending policies, establish sender reputation, or make a free email provider unlimited. Official references: https://nodemailer.com/transports and https://nodemailer.com/smtp.

The product must distinguish three different limits:

1. **Application/API throughput:** how many dispatch requests the frontend and Hono can process per second.
2. **Provider API request batching/rate limits:** how many messages can be described in one API call and how many API calls are allowed.
3. **Provider account sending quota:** how many actual emails the account is permitted to send per day/month or at its approved sending rate.

Reducing the number of API requests can improve efficiency for the first two limits. It does not increase the account-level allowance in the third category.

### 37.2 Provider facts checked on 10 October 2026

- **Brevo Free:** its official plan page currently lists 300 email sends per day, transactional email, and up to 100,000 contacts. The daily send cap resets daily and unused quota does not roll over. Its help page says transactional messages beyond the cap may be held in a retry queue up to a stated limit, but that queue must not be relied on as the application's own authoritative delivery/recovery system. Sources: https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans and https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan.
- **Brevo batch transactional API:** official documentation allows up to 1,000 personalized message versions in one API request and describes a 100-requests-per-minute endpoint rate limit, with other request recipient/version limits. This is an API efficiency feature, not a promise of 1,000 free sends/day. Source: https://developers.brevo.com/docs/batch-send-transactional-emails.
- **Important fit gap for our attachment requirement:** the documented `messageVersions` override fields include recipient, subject, reply-to, content and parameters, but do not document per-version unique attachment overrides. The standard transactional endpoint has an attachment field, but it is not safe to assume that a different PDF can be attached to each message version within one batch request. A proof-of-concept must verify this. If per-recipient attachment cannot be done safely with the batch endpoint, use one API call per recipient (concurrency-limited) or reconsider secure expiring PDF links in a future product decision. Do not send the same shared attachment to all recipients by accident. Source: https://developers.brevo.com/docs/batch-send-transactional-emails and https://developers.brevo.com/reference/send-transac-email.
- **Brevo SMTP relay:** the official documentation explicitly says SMTP relay does not support batch sending; use the batch API for batch operations. Nodemailer connected to Brevo SMTP would still be an individual-message SMTP path and would remain subject to Brevo account quotas. Source: https://developers.brevo.com/docs/smtp-integration.
- **Resend Free:** currently lists 3,000 emails/month and 100 emails/day. Source: https://resend.com/pricing.

These provider limits and plans are changeable and must be reconfirmed at the time of account creation and before public launch.

### 37.3 Recommended email implementation, when the project reaches that milestone

1. Keep the user-selected first prototype **downloads-first**. Add no real recipient email sends to the first production-like test.
2. Define a provider-agnostic interface, for example:
   - `sendOne(message)` for one recipient and that recipient's own attachment;
   - optional `sendBatch(messages)` only when provider capability tests demonstrate that per-message personalized attachments are supported safely;
   - `getCapabilities()` for daily quotas, supported attachment mode/size, API batching, webhook events and idempotency properties;
   - `normalizeWebhookEvent(event)` and `classifyError(error)`.
3. Compare Brevo and Resend under the zero-cost constraint. Brevo is a useful first candidate because of its higher published daily cap, but it is not yet selected. Check sending-domain/sender verification, exact free transactional eligibility, PDF attachment behavior, response identifiers, webhook signatures, bounce/complaint events and provider terms.
4. Prefer the provider's HTTPS API from Hono for the first integration if it meets the feature needs. Nodemailer is optional when its transport abstraction offers a practical benefit. If used, keep it on the server and rate-limit it; do not import it in the Vite frontend.
5. Hono claims one recipient-send intent at a time using a persistent idempotency/operation key. Use bounded concurrency and provider limits, classify errors, preserve provider IDs, and use webhooks/events to update later delivery results. An ambiguous network timeout becomes `unknown` and is reconciled; it is not blindly retried.
6. Do not put recipients with different documents in `To`/`CC`/`BCC` as a shortcut. Each message must go only to its intended recipient, with the attachment hash and recipient/snapshot key cross-checked before dispatch.
7. Under the strict output deadline, the app must estimate whether a batch can finish sending within the selected retention period. If not, clearly warn/block before delivery starts; if files expire with pending recipients, mark `expired_unsent` and stop those sends. Do not keep expired copies to finish the queue without explicit user approval and a future policy change.
