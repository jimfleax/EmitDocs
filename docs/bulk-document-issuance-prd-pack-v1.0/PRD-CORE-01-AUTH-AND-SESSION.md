# PRD-CORE-01 — Google sign-in, application session and protected workspace

**Status:** Core MVP · P0. Exact route/schema names are implementation proposals.

## Objective

Securely authenticate individual organizers through Google Identity Services, verify identity in Hono, create a revocable MongoDB-backed application session, and ensure that each user can access only resources they own.

## User stories

- As a new organizer, I can sign in with Google and enter the workspace.
- As a returning organizer, I can refresh/reopen the app while the session remains valid.
- I can sign out and have the old session rejected.
- I cannot access another user's resources by guessing IDs or changing URLs.

## Scope

Google-only sign-in; server-side ID token verification; user upsert keyed by Google `sub`; opaque session token stored as a hash in MongoDB; HttpOnly cookie; session bootstrap/revocation; route guards; ownership middleware; minimal dashboard shell.

## Non-goals

Passwords, other identity providers, teams/RBAC, recipient portal and finalized brand styling.

## End-to-end flow

1. `/sign-in` displays GIS control and accessible progress/error state.
2. Browser posts credential to `POST /api/auth/google` via same-origin API.
3. Hono verifies signature, issuer, audience and expiration; invalid tokens fail closed.
4. Upsert user using verified `sub`; email is profile data, not key.
5. Generate high-entropy opaque session token; store hash, user, expiry and revocation state; set secure HttpOnly cookie.
6. App calls `GET /api/session` before rendering protected routes.
7. Logout calls `POST /api/auth/logout`, revokes server session and clears cookie.

## Routes and components

Routes `/sign-in`, `/app`, and settings account route. Components: `GoogleSignInButton`, `AuthErrorNotice`, `SessionBootstrap`, `AuthGuard`, `SessionExpiredDialog`, `AccountMenu`, `SignOutAction`, `RouteErrorBoundary`, `AppShell`. Visual treatment remains open.

## API/data

- `POST /api/auth/google`: accepts Google credential; returns safe profile and sets cookie. Must not echo credential.
- `GET /api/session`: returns safe user/session status.
- `POST /api/auth/logout`: revokes session and clears cookie.
- Collections: `users` (`googleSub` unique), `sessions` (`tokenHash` unique, expiry/user indexes).
- Cookie flags and session TTL/rotation must match final same-origin topology; exact settings are still implementation decisions.

## States and failures

Invalid token claims, expiry, DB outage, session persistence failure, revoked/expired session, Google config outage, CSRF/origin mismatch. Failure to verify/persist identity must fail closed. No insecure client-trusted fallback.

## Security/privacy

Token verification server-side; random session token, hash at rest; origin/CSRF protection even for same-site cookies; rate limits; never log credentials/cookie; no credentials in frontend bundle.

## Acceptance criteria

- AC1: Repeat login for same Google `sub` resolves to same account.
- AC2: Wrong signature/issuer/audience/expiry is rejected without a session.
- AC3: Session survives refresh and is revoked on logout.
- AC4: Expired/revoked sessions fail protected API calls.
- AC5: Cross-user resource access tests deny access.
- AC6: Raw cookie/session token is not stored/logged; production bundle contains no secret.

## Tests

Token-claim matrix, repeat login, expiry/revocation, CSRF/origin, DB outage, cross-tenant ID enumeration, log/bundle secret scan, Playwright login/refresh/logout.

## Dependencies/gate

Google client setup, Hono, MongoDB, same-origin deployment. No real recipient data before identity and ownership tests pass.

## Open details

Exact cookie lifetime/rotation, Google client IDs, CSRF mechanism, cookie path/attributes and local/test auth separation. Public hosting remains unresolved under ₹0.
