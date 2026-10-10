# PRD-DEFERRED-03 — Document identifiers and authenticity verification

**Status:** Future capability; not committed to MVP.

## Objective

Optionally add a unique identifier/QR code to generated documents and provide privacy-minimized public authenticity status.

## User stories

Organizer enables verification, previews QR placement, and gets unique issuance identifiers. A verifier can check status and a limited detail set. Revoked/superseded documents are not represented as currently valid.

## Candidate scope

Unique non-guessable token, QR generation/placement, verification landing page, privacy rules for visible details, rate limiting, revocation integration and status lookup.

## Exclusions

No claim of cryptographic proof of PDF integrity unless separately specified; no accreditation/legal validity; no full contact/recipient PII display; no blockchain unless evidence supports it.

## Flow/routes/data

Enable verification → configure QR/ID placement in template version → preview → freeze settings in snapshot → generate issuance-specific token → public `/verify/:token` shows minimal status. Tokens must not embed PII or expose sequential DB IDs.

## Acceptance criteria

- Tokens unique/unpredictable and tied to one issuance.
- Public output reveals minimal data and is rate-limited.
- Invalid tokens leak no internal identifiers.
- QR preview and final document point to same record.
- Revocation/reissue states integrate with future PRD-DEFERRED-04.

## Dependencies/open items

Public hosting, privacy design, document correction/reissue semantics, token lifetime and whether verification should validate artifact integrity or only issuance status.
