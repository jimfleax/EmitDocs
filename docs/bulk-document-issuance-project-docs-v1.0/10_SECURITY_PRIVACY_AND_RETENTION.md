# Security, Privacy and Retention

## 7. Security and privacy baseline to design

- Treat all PDFs and spreadsheets as untrusted input.
- Validate file signatures and parseability, not only filename/MIME type; enforce upload limits and row/page limits.
- Keep uploads outside any executable/public web root; use private object storage, short-lived authorization and least-privilege credentials.
- Isolate processing workers and impose CPU, memory, page-count and runtime limits to reduce denial-of-service risk from malformed or expensive PDFs.
- Use authentication, object-level ownership checks, rate limits, CSRF protections where applicable, secure session/token handling and password-reset protections.
- Do not log full recipient rows, PDF contents, email addresses or signed URLs unnecessarily. Sanitize errors and keep secrets out of client bundles.
- Prevent cross-user access to templates, ZIPs, PDFs, job details and preview endpoints.
- Track delete requests and cleanup failures. Explain to users that provider backups/logs can have separate retention terms where applicable.
- For email, include abuse prevention, sender verification, suppression/bounce handling, and acceptable-use controls before public launch.

## 22. Retention and deletion protocol

Presets: 24 hours, 7 days, and 30 days are the selected proposed launch options. The timer's exact start event remains to be chosen (recommended: job's terminal/completed timestamp for outputs, and creation timestamp for failed abandoned drafts, with explicit display in UI). Template source PDFs and reusable mappings remain until template deletion.

Deletion should be a process, not only a TTL field:

1. Set retention deadline and expose the deadline to the user.
2. Create idempotent cleanup tasks for every R2 object that belongs to expired job state.
3. Delete objects through R2; on failure, keep task retryable with safe error code and attempt metadata.
4. Remove or redact recipient data, imported values and delivery addresses only after deciding whether active send/reconciliation work is still outstanding; do not expire data needed to reconcile an ambiguous in-flight send without first setting a documented cutoff rule.
5. Replace long-term job record with aggregate counts/status/timestamps only; never keep name/email/address data after the selected retention period.
6. Confirm cleanup state after storage deletion succeeds; retain cleanup failure flags until reconciled.
7. MongoDB TTL can be used as a fallback for eligible database records but is asynchronous and does not delete R2 files. R2 lifecycle rules may provide a backstop, but app-level object tracking and delete retries remain necessary. Cloudflare currently documents that objects are typically removed within 24 hours after their lifecycle `x-amz-expiration` value, and existing objects can take longer when lifecycle rules change; therefore an R2 lifecycle policy is not an exact-time deletion guarantee. A 24-hour user retention preset must be represented as a deletion deadline plus cleanup status/retries, not a claim that every physical copy is erased exactly at hour 24.

**Honesty constraint:** With browser-driven work and a serverless host that may not run continuously, the app can promise a configured retention deadline plus best-effort/retry deletion and expose cleanup status, but must not claim exact-to-the-minute physical erasure until the storage/scheduler arrangement is proven. Public privacy text must reflect the implementation actually deployed.

## 23. Security and abuse controls required by the chosen architecture

- Google ID tokens are verified on the server for signature, audience, issuer and expiry. Use `sub` as the unique identity; do not trust decoded client-side claims.
- Session cookies: HttpOnly, Secure in production, intentional SameSite behavior, rotation/revocation policy, CSRF defenses, exact credentialed CORS origin allowlist. Avoid wildcard origin with credentials. The frontend/API deployment must be tested in real target browsers.
- R2: private bucket, random server-generated keys, short-lived operation-scoped presigned URLs; exact allowed CORS origin/method/header set; verify final object metadata/checksum after upload. Never log or analytically collect signed URLs. Presigned URLs can be reused until expiry, so they are not one-time tokens.
- PDF/XLSX/CSV: untrusted input. Check magic bytes/content, byte size, page count, row and column counts, XLSX decompressed size, encrypted/corrupt PDFs, and unsupported features. Treat spreadsheet values as data, never as executable HTML or formulas; escape on render/export.
- Browser-produced PDFs: the server cannot independently prove that a modified client generated exactly the pixels implied by a snapshot. This is acceptable only as a stated MVP trust boundary; do not market outputs as tamper-proof or cryptographically attested. A future server-side validation or signed-verification feature would need additional design.
- Provider: email secret only in Hono environment variables; sender address constrained to verified configuration; per-account/global quotas; recipients should be authorized to receive the document; suppression lists for bounce/complaint; verified webhooks; emergency global send pause.
- Rate limits: auth, create batch, import, upload URL issuance, generation claim, delivery dispatch, and webhook replay. Quota must be enforced server-side, not solely in React.
- Authorization: every resource query includes owner ID; an ObjectId/opaque ID is not authorization. Test cross-account template, row, R2 key, output, job and download access.
- Observability: structured request ID, stable error code, stage and timings. Redact recipient data, tokens, full filenames where sensitive, message body, uploaded content, provider secrets and presigned URLs.
- Dependency/security: keep PDF parser/renderer and XLSX parser updated; establish lockfiles, automated dependency advisories, secret scanning and a process to respond to vulnerable file parsing packages.
