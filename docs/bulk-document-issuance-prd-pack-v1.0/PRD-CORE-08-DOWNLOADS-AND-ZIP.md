# PRD-CORE-08 — Individual PDF downloads and bounded ZIP packaging

**Status:** Core MVP · P0; output sizes measured.

## Objective

Let users download generated PDFs individually or as ZIP archives, with correct recipient mapping, safe deterministic file names, partial-result visibility and expiry enforcement.

## User stories

- I can download each completed PDF.
- I can download a ZIP of completed outputs.
- Large results split into multiple archives or stop with a clear recoverable path if they exceed safe browser limits.
- I can see generated/failed/cancelled counts and expiration.

## Scope / exclusions

Results route, paginated output listing, short-lived scoped download URLs, filename sanitization, collision suffixes, bounded/split browser ZIP generation, optional manifest (inclusion default still proposed), checksums and expiry. Excludes email, public links, cloud drive export and long-term archive.

## End-to-end flow

1. Results route loads status, counts, file sizes, expiry and cleanup state.
2. Individual download requests a short-lived URL from Hono after owner/expiry check and downloads directly from R2.
3. ZIP action chooses completed eligible outputs and packages them in bounded/streaming chunks supported by tested browser implementation.
4. If ZIP exceeds tested memory cap, split into numbered archives or stop gracefully rather than accumulate unbounded in-memory bytes.
5. Filename default is sanitized recipient name + template/document label + stable collision suffix. Strip path separators, control/reserved characters and overlong names.
6. If outputs are partial, report which files are included; do not misrepresent failed/skipped records as generated.
7. Expired outputs cannot be issued fresh URLs.

## Routes/components

`/app/batches/:batchId/results`; `OutputTable`, `OutputDownloadAction`, `ZipArchiveList`, `ArchiveSizeEstimate`, `SplitArchiveNotice`, `ExpiryCountdown/Label`, `ExpiredOutputNotice`, `CleanupStatusNotice`.

## API/data

`GET /api/batches/:id/outputs`; `POST /api/outputs/:id/download-url` with owner and expiry check. Output records identify snapshot/recipient, object key, checksum/bytes, safe name, kind/status and expiry.

## States/errors

Generating, ready, partial, ZIP building, ZIP ready, ZIP failed, missing output, expired, download denied, cleanup pending. If signed URL expires during download, request a new one only while output is still eligible. Archive must handle missing items according to explicit consistency behavior and report it.

## Security/privacy

Private R2, short-lived scoped URLs, authorization before URL issue, no public/shared URLs, sanitize filenames/path traversal, no signed URL in logs, only include outputs from user's selected snapshot.

## Acceptance criteria

- AC1: Owner can individually download outputs before expiry.
- AC2: Non-owner/expired requests cannot get URLs.
- AC3: ZIP content maps to successful output records/recipients.
- AC4: Filename sanitization and collision suffix prevent overwrite/path traversal.
- AC5: Oversized archive splits or stops gracefully within measured limits.
- AC6: Partial result summary is accurate.
- AC7: Expiration/cleanup state shown to user.

## Tests

Normal ZIP, Unicode/collision/hostile filenames, missing output, expired object, partial generation, size boundary, split archive count, checksum, cross-user access, URL expiration mid-download.

## Dependencies/gate

CORE-07, R2 output metadata and tested ZIP strategy. This slice completes the download-first primary user journey.

## Open details

ZIP library/streaming, split threshold, manifest default/content, byte caps and low-memory browser performance.
