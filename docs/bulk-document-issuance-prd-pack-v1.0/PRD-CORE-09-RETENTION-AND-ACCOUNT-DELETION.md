# PRD-CORE-09 — Retention, MongoDB PII pruning and account deletion

**Status:** Core MVP · P0 before real personal data.

## Objective

Make data expiry and deletion predictable, visible, and automated. Batch and recipient PII records adhere to strict 24-hour/7-day/30-day retention presets (7-day default). Because recipient PDFs are generated on-the-go without cloud output storage, batch expiry strictly prunes MongoDB snapshot and recipient records. Cloudinary storage deletions are restricted exclusively to explicit template deletions and full account deletions.

## User stories

- I choose a retention preset (24h, 7d, 30d) during batch approval and see the clear expiration deadline.
- After expiry, batch recipient PII is purged and no further on-demand generation or downloads are permitted.
- Saved template source files in Cloudinary remain safely intact across batches until I explicitly delete the template.
- When I delete my account, my active sessions are revoked immediately, my MongoDB records are removed, and all my template assets in Cloudinary are purged.

## Scope / exclusions

### In Scope
- Retention setting (24h, 7d, 30d presets; default 7d) locked into `ApprovedSnapshot` and `Batch`.
- Expiry timestamps calculated at approval time.
- Automated MongoDB TTL / retention pruner for expired `DraftRow`, `ApprovedRecipient`, and `ApprovedSnapshot` PII.
- Template source persistence in Cloudinary until explicit template deletion.
- Template deletion cleanup: deletes associated Cloudinary public IDs via Cloudinary API.
- Account deletion: revokes session, deletes user data, and purges user's Cloudinary folder (`templates/{userId}/`).
- Aggregate post-expiry history (preserves batch summary counts and timestamps without recipient PII).

### Excluded
- Cloud storage cleanup sweeps for generated recipient PDFs (since zero recipient PDFs are stored in Cloudinary).
- Retention extensions beyond 30 days.

## End-to-end flow

1. Batch uses selected preset (24h / 7d / 30d; default 7d / 168 hours). Expiration timestamp (`expiresAt`) is computed and saved in `ApprovedSnapshot` and `Batch`.
2. UI displays the expiration countdown and deadline label.
3. Logical Expiry:
   - When `now() >= expiresAt`, batch status becomes `expired`.
   - Any attempt to access `GET /api/batches/:id/snapshot/recipients` or trigger downloads returns `410 GONE` / `403 FORBIDDEN (BATCH_EXPIRED)`.
4. Database Cleanup:
   - MongoDB TTL indexes or a lightweight retention runner prunes expired `ApprovedRecipient` and `DraftRow` records.
   - Aggregate batch history (name, total count, approval date, expiration date) is retained for audit reporting.
   - Zero Cloudinary API calls needed for batch expiration.
5. Template Deletion:
   - User explicitly deletes a template.
   - API verifies no active, unexpired batches reference the template version.
   - System deletes template records and invokes Cloudinary API (`cleanupUnreferencedCloudinaryAssets`) to remove the source PDF.
6. Account Deletion:
   - User confirms account deletion.
   - Sessions are immediately revoked.
   - Deletes all owned batches, snapshots, and templates.
   - Purges user's Cloudinary assets under `templates/{userId}/`.

## Routes & Components

- `/app/settings/retention`, `/app/settings/account`, `/app/templates`, and `/app/batches/:batchId/results`
- `RetentionPresetSelector`, `ExpiryCountdownBadge`, `ExpiredBatchNotice`, `DeleteAccountDialog`, `DeleteTemplateDialog`.

## Acceptance Criteria

- **AC1**: Only 24h, 7d, and 30d retention presets accepted; default is 7d (168h).
- **AC2**: Exact expiration timestamp `expiresAt` is immutable once approved.
- **AC3**: Expired batches reject on-demand recipient fetches with `410 GONE` / `BATCH_EXPIRED`.
- **AC4**: Batch expiry removes recipient PII from MongoDB without requiring Cloudinary output sweeps.
- **AC5**: Template source files in Cloudinary persist across batch lifecycles until explicit template deletion.
- **AC6**: Template deletion purges the underlying Cloudinary asset.
- **AC7**: Account deletion immediately revokes session and cascades deletion across MongoDB and Cloudinary.

## Tests

- Preset calculation tests (24h, 7d, 30d).
- Expired batch access rejection (returns 410 Gone).
- PII pruning verification in MongoDB.
- Template deletion Cloudinary cleanup test.
- Account deletion cascade test.
