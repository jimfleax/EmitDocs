# Bulk Document Issuance — PRD Pack v1.0

**Pack date:** 10 October 2026 · **Product name:** working title only · **Status:** Implementation-ready direction with explicit feasibility gates.

## Start here

1. `01_MASTER_PRD.md` — complete product PRD summary, scope, objectives, requirements, constraints and release gates.
2. `02_VERTICAL_SLICE_MAP.md` — implementation stages and dependencies.
3. `03_UI_ROUTES_AND_COMPONENT_INVENTORY.md` — design-neutral route/page/layout/component inventory.
4. `04_DOMAIN_MODEL_AND_API_CONTRACTS.md` — proposed MongoDB model, OpenAPI route catalogue, state machines and invariants.
5. `05_CROSS_CUTTING_REQUIREMENTS.md` — security, privacy, operational and accessibility requirements.
6. `06_TEST_AND_RELEASE_PLAN.md` — test matrix and release gates.
7. `PRD-CORE-*.md` — end-to-end PRDs for the core downloads-first product.
8. `PRD-DEFERRED-*.md` — future capability PRDs, not authorization to build them immediately.
9. `07-TRACEABILITY-AND-OPEN-DECISIONS.md` — explicit decisions vs proposals vs open blockers.
10. `08-PRD-CHANGELOG-AND-GOVERNANCE.md` — update policy.

`BULK_DOCUMENT_ISSUANCE_MASTER_PRD_V1.0.md` concatenates the master, shared specs, core PRDs, deferred PRDs and traceability docs into one searchable file. Modular files remain the editable source of truth.

## Pack contents

- Master PRD and development stage map.
- UI route, layout, page-state and component inventory without pixel-level design decisions.
- Proposed data contracts, API route catalogue, state transitions and test/release criteria.
- 10 core vertical-slice PRDs: authentication, templates/upload, PDF mapping/preview, spreadsheet import, draft review/reconciliation, approval snapshot, resumable generation, downloads/ZIP, retention/account deletion, private-pilot readiness.
- 8 deferred PRDs: email, lightweight editor, verification, correction/reissue, integrations/public API, teams, analytics/monetization, brand/launch readiness.
- Copy of project archive v1.0 and decision logs v0.3–v0.9 under `references/`.
- `FILE_MANIFEST.sha256` for integrity verification.

## Authority rules

1. Direct user decisions through Round 10 are binding.
2. **PROPOSED** items are not accepted decisions unless explicitly selected in a round.
3. Older discovery archives provide history and must not override later direct choices.
4. Provider terms, quotas, prices and capabilities are date-sensitive; verify again before deployment/launch.
5. The public brand is not finalized. “Bulk Document Issuance” is an internal working title; name, tagline, logo, palette, domain and trademark remain open.

## Release boundary

The initial live prototype is **downloads-first**; email remains deferred and disabled. Stack direction: React/Vite/TypeScript, Hono/TypeScript, Google Identity Services, MongoDB, private Cloudflare R2, Zod, OpenAPI, browser-side PDF work in bounded chunks, MongoDB-backed claim/lease records and polling. Browser closure pauses CPU work; a user can resume on return. Vercel Hobby is a private personal/non-commercial prototype candidate only. Public hosting that complies with current plan terms and the hard ₹0 constraint remains unresolved.
