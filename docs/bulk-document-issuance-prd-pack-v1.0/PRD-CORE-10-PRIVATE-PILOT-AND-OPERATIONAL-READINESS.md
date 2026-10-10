# PRD-CORE-10 — Private pilot, CI/CD and operational readiness

**Status:** Core release-readiness slice · P0 before private real-data pilot.

## Objective

Make the two-repository prototype reproducibly buildable, deployable and diagnosable. The slice adds tests, contract drift checks, safe logs, resource caps and an explicit release checklist rather than treating operational hardening as an undefined final task.

## User stories

- A developer can clone web and API repositories and run them using documented configuration.
- Every PR has automated checks; frontend/API contract drift is detectable.
- The maintainer can diagnose stuck jobs, lease recovery and cleanup failures without exposing recipient data.
- Users receive safe errors when free quotas/caps are reached instead of silent failure.

## Scope / exclusions

Separate repositories; Node LTS supported by actual host; npm lockfiles; TypeScript; lint/format; Vitest; Playwright; GitHub Actions; OpenAPI checks; `.env.example`; synthetic PDF/XLSX fixture set; request IDs/safe logs; application caps; private deploy smoke tests; runbooks. Excludes public launch, paid services, full on-call tooling and email activation.

## End-to-end flow

1. Developer sets up both repositories from READMEs and environment examples.
2. Local-only test auth can be used in isolated tests; production build must fail if test auth is enabled.
3. Pull request runs formatting/lint/typecheck/unit/API contract/build/dependency checks and relevant browser tests.
4. API generates/validates OpenAPI; frontend client/types are generated/versioned and CI fails on drift.
5. Preview deployment smoke-tests same-origin session cookie, API auth and scoped R2 upload.
6. Structured logs report request/operation IDs, phase, count, duration and safe error code only.
7. Private pilot gate tests cross-user access, malformed upload, tab close/resume, cleanup, resource caps and provider/hosting terms.
8. Email dispatch remains off. Public deployment is blocked until eligible zero-cost hosting is verified.

## UI/maintainer surfaces

User-facing service/error/limit/cleanup notices and safe request IDs. Maintainer surfaces are CI/deployment logs and authorized provider consoles/runbooks; no hidden unauthenticated admin route.

## API/config

Versioned OpenAPI, Zod validation, generated client/types. `.env.example` documents names only. `VITE_*` variables are public; MongoDB URI, R2 secret credentials, session secrets and email keys stay server-side. Runtime must fail closed if required production secret/config is missing.

## Failure behavior

DB/R2 outage gives safe error, no false success. Resource cap stops new work and explains next step. Stale API contract or tests block deployment. Ineligible public hosting means private prototype only. Email feature flag is off in first live prototype.

## Acceptance criteria

- AC1: Fresh clone of both repos builds/tests from README.
- AC2: PR checks format/lint/typecheck/unit/contract/build.
- AC3: CI detects stale OpenAPI/generated client.
- AC4: Smoke test validates same-origin cookie, Hono API and R2 signed upload.
- AC5: No secrets in web bundle or source repository.
- AC6: Fixture corpus includes supported and unsupported inputs.
- AC7: Safe correlation ID leads to sanitized diagnostic log.
- AC8: Free-tier caps enforced before overage.
- AC9: Prototype hosting use permitted; public host blocker remains visible.
- AC10: Email dispatch disabled by config/build for initial prototype.

## Tests

Clean clone; typecheck failure; stale contract; missing production secret; test auth accidentally enabled; R2 cap; MongoDB/R2 outage; log-redaction scan; origin mismatch; hosting terms gate; verify email flag locked off.

## Dependencies/gate

All core slices, GitHub Actions, contract tooling, R2/Atlas, fixture set. Required before private pilot.

## Open details

Exact OpenAPI/client tooling, commands, safe log solution, cleanup trigger and public hosting plan. No paid monitoring/hosting assumed.
