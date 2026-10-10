# PRD-DEFERRED-01 — App-managed email delivery with PDF attachments

**Status:** Deferred; excluded from the first live prototype. Not an authorization to enable email before the release gates pass.

## Objective and user stories

An organizer may later deliver one unique PDF attachment per eligible recipient, see quota/expiry feasibility before sending, control/pause sending, and recover failures without confusing “provider accepted” with “delivered”.

## Scope

Provider adapter and comparison (Brevo/Resend/others), sender verification, one attachment per recipient, email preview/body, per-user/account quotas, pacing, delivery state, webhooks, event deduplication, bounded retries/backoff/jitter, unknown-send reconciliation, bounce/complaint suppression, abuse reporting and kill switch. Nodemailer is a candidate library, not a provider or quota bypass.

## End-to-end flow

1. Feature flag prevents use until provider/account and test gates are approved.
2. User selects eligible recipient rows and views a preflight: provider quota, estimated sends, attachment size, remaining retention and likely completion feasibility.
3. If sends cannot plausibly finish before strict output expiry, block the dispatch or clearly explain a valid alternative; never silently extend retention.
4. User confirms sender identity and message.
5. Frontend initiates bounded chunk; Hono validates owner/snapshot/output, uses server-only provider credentials and sends one matching PDF attachment to one address.
6. Persist a delivery attempt/application idempotency key before request. If request outcome is ambiguous, mark `unknown` and reconcile by provider message/event before retry.
7. Verify and deduplicate webhooks; handle out-of-order status events explicitly.
8. Throttle by actual provider quota. Retry known transient errors with bounded schedule; permanent invalid address/content errors are surfaced rather than retried indefinitely.
9. At strict expiry, unsent work becomes `expired_unsent`; no new download/send URL and no silent retention extension.

## Routes/components/data

Future route `/app/batches/:batchId/delivery`; components `EmailPreflightSummary`, `RecipientEligibilityTable`, `SenderIdentityNotice`, `EmailContentPreview`, `Quota/EstimatedCompletionBanner`, `DeliveryProgress`, `DeliveryStatusTable`, `UnknownOutcomeReconciliationPanel`, `ExpiredUnsentNotice`. API proposals: `/email/preflight`, `/email/dispatch`, pause/resume/cancel, provider webhook endpoint. Collections `deliveryAttempts`, `providerEvents`, future delivery work items/statuses.

Provider adapter should support `sendOne(...)`, normalized error classes, quota/capabilities and webhook validation. `sendBatch` is optional only if the provider demonstrably supports a unique attachment per message/version.

## Acceptance criteria

- Each test recipient receives only their mapped PDF.
- Provider secrets absent from frontend assets.
- Account/sender eligibility and actual quotas enforced.
- Permanent errors do not receive automatic retry loops; transient retries bounded.
- Duplicate/out-of-order webhooks cannot corrupt state.
- Ambiguous sends reconcile before retry.
- Strict expiry blocks unsent attempts as `expired_unsent`.
- Browser closure pauses browser-driven dispatch; no autonomous-work claim.
- Bounce/complaint suppression, user limits and emergency sending kill switch work before public launch.

## Blockers

Provider and sender selection, plan eligibility, attachment limits, unique-attachment support, verified webhooks, acceptable-use constraints, public hosting and ₹0 feasibility. Free caps may make 5,000-recipient sending incompatible with default/maximum retention; do not alter retention/budget silently.
