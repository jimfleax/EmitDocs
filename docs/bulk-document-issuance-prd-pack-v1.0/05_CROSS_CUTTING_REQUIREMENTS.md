# Cross-cutting functional, security, privacy and operational requirements

## Security and authorization

- Verify Google ID tokens server-side: signature, issuer, audience, expiry. Key identity by `sub`, not email.
- Use a cryptographically random opaque application session in Secure/HttpOnly cookie; store hash, expiry and revocation in MongoDB. Cookie domain/SameSite, rotation, CSRF and Origin checks must be verified against actual same-origin deployment.
- Every API route authorizes owner for every template/version/batch/import/row/snapshot/output/cleanup operation. Ignore client-supplied `ownerId`.
- Browser never connects to MongoDB or receives R2 secret credentials/email provider secret. Use short-lived scoped signed URLs and server-generated opaque object keys.
- Treat PDF/CSV/XLSX and metadata as untrusted. Validate signature and parseability, enforce configurable byte/page/row/CPU/memory limits, and handle malformed inputs safely.
- Rate-limit auth, uploads, URL issuance, row chunks, claims/checkpoints, deletion and abuse-sensitive endpoints. Enforce app-level storage/operation caps under hard ₹0 budget.
- Keep secrets server-only. Every `VITE_*` variable is public. No MongoDB/R2/session/email secret in frontend bundle.

## PDF correctness

- PDF.js for render/inspection/coordinate extraction; `pdf-lib` is a candidate for supported form fields/text drawing/overlays. Arbitrary existing PDF text cannot be universally edited in place.
- Standard token syntax: `{{name}}`, `{{date}}`, `{{organization}}`. Detection suggests; user confirms or visually maps.
- Require clean placeholder region when safe masking cannot be inferred. Flag/reject layouts where a mask may damage artwork; do not promise background reconstruction.
- Field types text/date/number. Basic controls include position/box, font, size range, color, alignment, mask and fit mode.
- Fit-then-flag: shrink only within configured bounds; flag unresolved overflow. Never silently clip.
- Unicode only when selected/embedded font covers glyphs and shaping tests pass. Missing glyphs block/flag; no silent substitution.
- Multi-page support is capped by benchmark. Scanned/image-only PDFs and OCR are not MVP promises.
- Preview and final generation use the same processing path.

## Import/review

- CSV/XLSX; XLSX worksheet selected by user; first non-empty row is header. Blank/duplicate headers must be explicitly reported.
- Dates/numbers use documented explicit parsing; ambiguous locale values are flagged. Formula cells with unreliable/missing cached values are not guessed.
- Server revalidates rows; don't trust client validity flags.
- Invalid rows isolated and correctable. Duplicate records/emails warned and preserved. No default merge by email.
- Inline edits are overrides; re-import creates a new revision/diff. Match reliable unique keys only; ambiguous matching must be manual. Never silently match by row order or non-unique name/email.

## Snapshot/generation

- Snapshot contains template version/source checksum, mapping/style hash, import revision, effective data, overrides and canonical digest.
- Staged snapshot is approved only after count/digest reconciliation.
- Generated PDFs are computed on-the-go in a Web Worker; zero individual recipient PDFs are uploaded or stored in Cloudinary/cloud storage.
- UI provides instant (<20ms) single-recipient preview and download.
- ZIP packaging streams directly in the browser via `client-zip` with 1,000-document volume splitting and bounded memory (<150MB).
- Cancel at safe boundary. Closing browser leaves batch in `approved` state ready to regenerate/download on return.

## Retention/deletion

- Allowed presets: 24 hours, 7 days, 30 days; 7-day default, 30-day max.
- Saved template PDF retained in Cloudinary until explicit template deletion. Job imports, row PII, and snapshot recipient data follow batch retention.
- Batch expiry strictly prunes MongoDB recipient PII and snapshot records (via TTL/pruner). Zero Cloudinary deletion calls needed for batch expiry.
- Cloudinary deletion API calls occur strictly upon explicit template deletion or complete user account deletion.
- Enforce logical expiry immediately, deny recipient access and remove regular UI access. Disclose possible physical deletion delay.
- Account deletion requires confirmation, immediate session revocation, stop new work and schedule owned-resource deletion. Retain only non-identifying cleanup evidence.

## Logging, errors and accessibility

- Structured logs: request ID, operation/resource IDs that are non-sensitive, phase, duration, counts and safe error codes.
- Never log full rows, names/emails, PDF content/text, cookie/token, signed URL, stack trace to user, or secrets.
- Persist progress; polling reflects server-confirmed state. Distinguish validation, unsupported file, permissions, quota, transient service error, lease loss, expiry and cleanup failure.
- Keyboard-accessible controls, semantic form labels and error associations, clear focus behavior, and a field/value/errors alternative to canvas-only PDF display.
- Search/pagination/filtering on draft gallery. Every page needs loading, empty, error, permission, expired/deleted and stale-revision states as relevant.

## Cost and hosting constraints

- Hard zero-cost budget is binding. Any plan that can create overage must be capped in application logic or omitted.
- Vercel Hobby is a private personal/non-commercial prototype candidate only under current terms; public service is blocked until eligible no-cost hosting is verified.
- MongoDB work records are not an autonomous queue; the active browser advances prototype work. Do not imply continuous background execution.
- Email is deferred. Nodemailer does not bypass provider quota; provider and transport are unselected.
