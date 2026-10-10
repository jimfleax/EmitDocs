# PRD-DEFERRED-07 — Privacy-minimized analytics and monetization exploration

**Status:** Research/future PRD. No business model or pricing has been decided.

## Objective

Learn which workflows users value and whether a sustainable model can fund storage, compute and future email volume without collecting document contents unnecessarily.

## Candidate metrics/events

`template_created`, `template_upload_completed`, `template_compatibility_failed`, `import_completed`, counts-only validation summaries, `draft_review_started`, `batch_approved`, `generation_started/completed/interrupted/resumed`, `download_completed`, `cleanup_completed/failed`. Email aggregate events only after the feature is enabled.

Do not send recipient names/emails, spreadsheet cells, PDF text/content, signed URLs, credentials or raw exception payloads to analytics without explicit privacy/necessity review.

## Hypotheses to validate

Existing-PDF workflow is valuable; templates drive repeat usage; review/recovery is a differentiator; free-capped email may not satisfy large batches; usage costs may eventually exceed free allowances.

## Potential models (not selected)

Free core + paid high usage; organization subscriptions; pay-per-batch/document; open-source/community; sponsorship/education tier. Do not invent a price or paywall in the MVP.

## Acceptance criteria

Event schema reviewed for PII; analytics can be disabled/limited; no events require document content; product metrics are reliable; monetization proposal is backed by cost and willingness-to-pay evidence.

## Dependencies/open items

Pilot metrics, cost per batch, free-tier caps, customer segment, privacy disclosures and interviews.
