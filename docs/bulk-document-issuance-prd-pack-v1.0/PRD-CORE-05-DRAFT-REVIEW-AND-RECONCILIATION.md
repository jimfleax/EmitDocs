# PRD-CORE-05 — Draft gallery, inline correction and re-import reconciliation

**Status:** Core MVP · P0.

## Objective

Let organizers browse every draft before approval, inspect on-demand previews, edit values inline, and reconcile updated spreadsheet revisions without losing or silently reassigning records.

## User stories

- I can search/filter/page through all drafts and open any individual preview.
- I can correct a value inline and see validation update.
- I can import a new spreadsheet revision, review added/removed/changed rows and resolve ambiguous matches manually.
- I can see duplicate, overflow, invalid and preview-error states clearly.

## Scope / exclusions

Searchable/paginated gallery, on-demand preview, inline overrides, revision-aware row editing, re-import diff, reliable key matching, manual reconciliation, warnings and stale revision control. Excludes collaborative review, multiple approvers, team access and silent auto-merge by position/name/email.

## End-to-end flow

1. Review page displays server-calculated counts and issue filters.
2. Gallery lists rows and allows search/filter across all records, not just loaded page.
3. Opening a row loads needed data and renders its draft on demand via the same PDF pipeline as final generation.
4. Inline edit submits an override with expected row/import revision. API recomputes effective values and errors.
5. Re-import produces a new revision and diff.
6. Match rows only by a reliable chosen unique key. No key/collision/ambiguous match goes to manual resolution; never auto-match by row position or a non-unique field.
7. User confirms matches/new/removed records and sees conflicts. Override carry-forward must follow an explicit merge rule, and conflicting overrides cannot be silently applied.
8. Any material edit/re-import invalidates stale previews and the approval summary.

## Routes/components

`/app/batches/:batchId/review`. Components: `DraftGallery`, `RecipientPreviewPanel`, `RowEditor`, `FilterByIssue`, `OverflowBadge`, `ReimportDiffReview`, `MatchResolutionTable`, `DuplicateWarning`, `ImportRevisionSelector`, `InlineFieldEditor`.

## API/data

Paged `GET /api/batches/:id/rows`; `PATCH /api/batches/:id/rows/:rowId` with expected revision; re-import reconciliation endpoint receiving explicit old/new pair decisions. Collections `draftRows` and `batchImports`; imported data and overrides remain distinct.

## States/errors

Loading/empty/all-clear; invalid rows; preview loading/error; edit conflict; re-import analyzing; unresolved matching; confirmed reconciliation; stale row revision; expired/deleted resource.

## Acceptance criteria

- AC1: Every draft is reachable through search/pagination.
- AC2: Preview uses same pipeline as final generation.
- AC3: Inline edits persist and revalidate after refresh.
- AC4: Re-import shows added/removed/changed/conflicted records.
- AC5: Ambiguous matches require manual resolution.
- AC6: Duplicate warnings do not drop records.
- AC7: Edit/re-import invalidates stale approval state.
- AC8: Cross-user rows/previews are inaccessible.

## Tests

Review row 5,000; filter consistency; edit/refresh; concurrent edit; repeated names/email; no-key re-import; changed key; override conflict; new/removed records; preview cache stale; 5k gallery performance.

## Dependencies/gate

CORE-03/04, import revision model, stable pagination and reconciliation algorithm. Approval cannot be built before matching rules are implemented.

## Open details

Matching-key UX, exact override carry-forward policy, page size and cache/memory limit are to be validated; no automatic merge semantics may be invented.
