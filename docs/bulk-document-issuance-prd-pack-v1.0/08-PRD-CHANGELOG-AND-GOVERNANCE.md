# PRD pack change control

## v1.0 — 10 October 2026

- Converts product discovery through Round 10 into a master PRD, ten core vertical-slice PRDs, eight deferred PRDs, route/component inventory, domain/API/state contracts, cross-cutting requirements and test/release plan.
- Adds explicit distinction between user decisions, recommendations, deferred capability and blockers.
- Preserves the prior project documentation ZIP and the decision logs v0.3–v0.9 as references.
- Keeps exact routes/schema field names, library/provider choices, browser and ZIP thresholds, and public host provisional where not decided or benchmarked.

## Rules for future updates

1. Update the relevant PRD and traceability register together when a decision is made.
2. Do not convert a recommendation into a user decision without explicit approval.
3. Preserve earlier versions unchanged; publish v1.1/v2.0 for material revisions.
4. Every change records reason, impacted slices, migration/cost/security effects, acceptance changes and tests.
5. Recheck time-sensitive provider quotas, plan terms and API capabilities before implementation and launch.
6. Preserve cross-slice invariants: owner authorization, immutable templates/snapshots, output-recipient linkage, strict expiry, private R2, browser-paused processing, and no secrets in frontend.
7. If a conflict blocks a specific next step, ask a focused decision question. Otherwise document as release gate and continue.

## Recommended implementation workflow

- Product owner approves scope and acceptance criteria.
- Engineering confirms implementation feasibility and updates API/schema states.
- Security/privacy reviews resource ownership, file handling, retention and logs.
- Build one vertical slice end-to-end before advancing to dependent slices.
- Mark each acceptance criterion passed with a test/demo evidence reference; do not mark done based only on code existing.
