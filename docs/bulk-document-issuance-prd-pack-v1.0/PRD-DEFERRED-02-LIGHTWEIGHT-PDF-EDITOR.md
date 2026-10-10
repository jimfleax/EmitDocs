# PRD-DEFERRED-02 — Lightweight PDF template editor

**Status:** Future capability; not part of the initial prototype.

## Objective

Offer minimal visual editing for supported templates so users can refine field layout/content without recreating the design externally.

## User stories

Users can select, move/resize and format supported fields, preview edits, undo/redo before save, and save a new immutable template version. Unsupported PDF features are identified rather than silently flattened/corrupted.

## Scope and non-goals

Candidate scope: editor canvas/page navigation, supported text/field elements, alignment, fonts, colors, sizing, mask controls, zoom/pan, undo/redo and preview. Not a full Canva-equivalent editor, arbitrary vector/PDF reconstruction tool, OCR editor, collaboration tool or image/signature-field product.

## Flow

Open a template version → enter editing mode → change supported element(s) → validate mask/font/overflow → preview through same PDF pipeline → save new immutable version. Existing approved snapshots remain unchanged.

## Routes/components/data

Potential `/app/templates/:templateId/versions/:versionId/edit`; `EditorCanvas`, `PageLayer`, `ElementToolbar`, `PropertiesPanel`, `HistoryControls`, `ZoomControls`, `FontGlyphWarning`, `MaskSafetyWarning`, `PreviewPane`, `SaveVersionDialog`. Persist only new `templateVersions`.

## Acceptance criteria

- Supported edits are undoable until save.
- Preview and generated result match.
- Save creates new version; approved snapshot hashes unchanged.
- Unsupported elements produce actionable warning/failure.
- Keyboard alternatives work for field properties/selection.

## Dependencies/open questions

CORE-03 engine proof, template versioning, user research. Start only if feedback shows field mapping/basic formatting is insufficient.
