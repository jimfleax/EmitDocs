# PRD-DEFERRED-06 — Team workspaces, roles and shared templates

**Status:** Future capability; MVP is individual-account-only.

## Objective

Allow multiple people within an organization to share templates/jobs and roles while preserving strict tenant isolation.

## User stories

- Workspace owner invites/removes members.
- Members receive roles and permissions.
- Templates and jobs can be shared inside workspace.
- Revoked users immediately lose access and activity is auditable.

## Candidate scope

Workspace entity, membership/roles (owner/admin/editor/reviewer/viewer to validate), invitations, shared templates, permissions/audit events and multi-user approval where demand supports it.

## Non-goals

No team access/workspaces in MVP; do not add incomplete team fields or RBAC prematurely.

## Data/API implications

Likely future `workspaces`, `workspaceMembers`, optional `workspaceId` on resources and centralized resource-authorization policy. Current `ownerId` model should be isolated so a future migration is possible without implementing teams now.

## Acceptance criteria

Cross-workspace requests denied; member removal revokes access; shared template versioning preserves snapshots; every mutation checks role; invitation expiry/revocation works; audit data minimizes PII.

## Dependencies/open questions

Validated team demand, role definitions, approval workflows, ownership on member departure and possible billing/plan rules.
