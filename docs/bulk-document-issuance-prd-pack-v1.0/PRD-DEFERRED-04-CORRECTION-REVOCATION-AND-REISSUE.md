# PRD-DEFERRED-04 — Corrections, revocation and reissue

**Status:** Future capability; not in initial prototype.

## Objective

Correct a generated/issued document without pretending the original never existed. Maintain an auditable relationship between original and replacement while respecting retention/privacy.

## User stories

- I can identify an output and request correction.
- I can preview the replacement before issuance.
- I can mark the original superseded/revoked and create a new issuance revision.
- I can inspect history without retaining unnecessary PII indefinitely.

## Rules and workflow

- Never overwrite original output in place.
- Reissue creates a new snapshot/output/issuance ID linked to the original with reason, actor and timestamp.
- If email is active, replacement delivery has an independent status; old ambiguous delivery history is not rewritten.
- Verification page reports revoked/superseded status only if verification capability is enabled.
- Retention applies to old and new PII; long-lived audit facts are minimal.

## UI/API/data

Potential `IssuanceHistory`, `CorrectionRequestPanel`, `ReissuePreview`, `ReasonForReissue`, `ReissueDiffView`, `RevocationStatus`. Server validates original ownership and creates new immutable revisions.

## Acceptance criteria

- New issuance has a distinct ID/snapshot/output.
- Original file/history isn't silently overwritten.
- Email and verification states remain consistent but independent.
- Owner and retention checks apply to original and replacement.
- Audit records omit unnecessary PII.

## Dependencies/open questions

Core snapshot/output model, optionally email/verification, classification of typo vs major correction, and permitted post-expiry audit data.
