# PRD-CORE-02 — Template library, immutable versions and secure PDF upload

**Status:** Core MVP · P0.

## Objective

Enable a user to upload a supported PDF into private R2 storage, save/reopen it as a reusable template, create immutable template versions, and delete a template intentionally. Template source files stay until template deletion; job data has separate retention.

## User stories

- I can create, list, search and reopen my templates.
- I see upload, compatibility and failure status.
- Editing a template creates a new version and does not mutate a version used by an approved batch.
- I can delete a template after explicit confirmation and understand cleanup status.

## Scope / non-goals

Scope: template metadata; direct browser-to-R2 upload through a short-lived scoped signed URL; server-side finalization checks; version list/create; rename; source URL; delete and cleanup scheduling. Not scope: full editor, arbitrary/scanned PDF support, team sharing, public links or email.

## End-to-end flow

1. User opens `/app/templates`, selects new template and file.
2. Client checks extension/size for feedback; Hono issues upload URL for a random server-generated object key.
3. Browser uploads to private R2 directly, not through a large API payload.
4. Browser submits completion; server checks object existence, byte size, checksum where supported, signature/parseability and configured prototype caps.
5. Create template + first `templateVersions` record with checksum/size/page count/compatibility result.
6. User can reopen template; source URL is short-lived and owner-scoped.
7. Mapping/style edits later create a new immutable version.
8. Delete confirmation immediately blocks new use and enqueues cleanup of every version object. Existing batch dependencies must be handled safely, never deleted mid-generation without explicit state transition.

## Routes/components

`/app/templates`, `/app/templates/new`, `/app/templates/:templateId`. Components: `TemplateLibrary`, `TemplateSearch`, `TemplateCard/Row`, `PdfUploadDropzone`, `UploadProgress`, `PdfCompatibilityReport`, `TemplateVersionList`, `TemplateDeleteDialog`, `TemplateEmptyState`.

## API/data

`GET/POST /api/templates`; `GET /api/templates/:id`; `POST /api/templates/:id/uploads`; completion endpoint; `GET /api/templates/:id/versions`; `POST /api/templates/:id/versions`; scoped source URL; `DELETE /api/templates/:id`. Collections: `templates`, `templateVersions`, `cleanupTasks`, minimal `auditEvents`.

## States/errors

Selecting, uploading, validating, active, warning, unsupported, upload failed, authorization denied, URL expired, R2 unavailable, duplicate completion, delete pending, delete failed. Retry completion idempotently; malformed files never activate silently.

## Security/privacy

Private bucket; opaque server-generated keys; short-lived URL; owner check; byte/signature validation; rate/storage limits; never log signed URLs. Files are untrusted inputs.

## Acceptance criteria

- AC1: Owner creates/lists/opens template; non-owner cannot access metadata or source.
- AC2: Upload bytes bypass API server payload.
- AC3: Server finalization stores checksum, bytes and page count.
- AC4: Version numbers are unique and versions immutable.
- AC5: Source persists until template deletion.
- AC6: Deletion enqueues every template object and reports pending/failure truthfully.
- AC7: Corrupt/non-PDF/unsupported source isn't activated.

## Tests

Real/fake PDF signatures, truncated/encrypted PDFs, URL expiry, duplicate completion, cross-owner, guessed object key, R2 outage, concurrent version creation, template deletion with active job, cleanup failure.

## Dependencies/gate

CORE-01, MongoDB, private R2, PDF.js preflight. Use synthetic files first.

## Open details

Max bytes/pages, encrypted file policy, exact source deletion/dependency semantics, R2 verification behavior and eligible public host.
