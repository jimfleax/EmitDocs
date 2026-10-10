# PRD-DEFERRED-05 — Integrations and public API

**Status:** Future capability; no integration was selected for MVP.

## Objective

Allow trusted external tools to provide data/create jobs using the same validation, approval and retention rules as the UI.

## Candidate capabilities

Google Sheets import; scoped API credentials/OAuth; idempotent job creation; rate limits/quotas; signed webhooks; event replay protection; API versioning/deprecation; usage reporting.

## Non-goals

No public API key management, webhook subscriptions or Google Sheets OAuth in the initial prototype. No integration may bypass approval, owner authorization or quota caps.

## Workflow

An owner authorizes integration → app records bounded permissions → external caller submits import/job idempotently → same validation and snapshot pipeline runs → caller polls job or receives signed events → credentials can be revoked/rotated.

## UI/data/API

Future integration settings, API credential create/revoke and webhook management. Store only hash of API secrets; show secret once; scope permissions. Use OpenAPI contract; webhooks signed and deduplicated.

## Acceptance criteria

- External jobs follow same row validation/snapshot rules.
- Revoked/under-scoped key denied.
- Request/event replay doesn't duplicate work.
- Secrets not logged and only hash retained.
- Rate/quota enforcement works.
- Public API only published after public hosting/security gate.

## Dependencies/open questions

Public host, scopes, OAuth model, Google Sheets permissions, quota model and stable versioned contract.
