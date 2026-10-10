# PRD-CORE-03 — PDF inspection, field mapping, field styling and preview

**Status:** Core MVP · P0 · Highest PDF feasibility risk.

## Objective

Map data fields to a supported existing PDF with automatic placeholder suggestions and a visual fallback. Require user confirmation, basic formatting controls and an accurate preview made by the same processing pipeline as final output.

## User stories

- I can inspect page text and see suggested `{{fieldKey}}` candidates.
- I can confirm a detected token or manually draw/select the variable region.
- I can set field position/box, font, size, color, alignment and masking options.
- I see overflow, unsafe background and missing-glyph warnings before approval.
- I can save changes as a new immutable template version.

## Scope / exclusions

Scope: PDF.js render/text/geometry; double-brace token suggestion; visual field placement; capped multi-page fields; text/date/number types; basic styling; fit-then-flag; Unicode glyph validation; on-demand preview through same generator; mapping hash and version save. Excludes OCR, universal arbitrary text replacement, background reconstruction, image/signature fields and full Canva-like editing.

## End-to-end flow

1. Load a template version and render pages using PDF.js.
2. Inspect searchable text and geometry; propose detected placeholders/regions but apply none silently.
3. User confirms a suggestion or places a field region; transform viewport coordinates to canonical page coordinates accounting for scale and rotation.
4. User sets field key/type and basic controls (box, font/family, size limits, color, alignment, mask, fit behavior).
5. Preview sample/long values through same PDF generation logic then render output with PDF.js.
6. If solid masking may cover artwork or backgrounds, flag/reject unless a clean replacement area is confirmed.
7. Check selected/embedded font has required glyphs; unsupported character shaping becomes a visible blocker/warning.
8. Save confirmed mapping as a new immutable template version.

## Routes/components

`/app/templates/:templateId/versions/:versionId`. Components: `PdfDocumentViewport`, `PdfPageNavigator`, `PdfPageThumbnailStrip`, `DetectedTokenList`, `FieldOverlayLayer`, `FieldSelectionTool`, `FieldPropertiesPanel`, `FontSelector`, `FontGlyphWarning`, `MaskPreview`, `TextFitPreview`, `LayoutWarningList`, `PreviewDocumentPane`.

## API/data

Source URL API and `POST /api/templates/:id/versions`. `templateVersions.fieldMappings` records key, label/type, page index, canonical geometry, font, size bounds, fit mode, mask mode/color and format. Browser detection is a suggestion; server validates mapping structure/ownership before saving.

## States/errors

No searchable text; split token fragments; unclear detection; unsafe background; missing glyph; overflow; rotated page; preview worker error; version conflict. Manual mapping may be used for supported text PDFs but does not mean OCR is supported.

## Acceptance criteria

- AC1: Token suggestions appear where detectable and never auto-apply without confirmation.
- AC2: Visual mapping works for supported PDFs when auto detection fails.
- AC3: Coordinate mapping respects scale/rotation/multipage fixtures.
- AC4: Preview and final use identical generation code.
- AC5: Fit-then-flag prevents silent clipping.
- AC6: Missing glyph and unsafe mask are surfaced.
- AC7: Save creates new version; old mapping/hash remains unchanged.
- AC8: Fixture output passes visual/text parity test.

## Tests

Tokens intact/split; manual mapping; zoom/rotation; multi-page; long text; Unicode present/missing glyph; clean/unsafe backgrounds; embedded fonts; encrypted/corrupt PDFs; worker failure; preview/final parity.

## Dependencies/gate

CORE-02, PDF.js and a proven generation/overlay library (`pdf-lib` is a candidate), font selection/embedding/shaping tests and a fixture corpus.

## Open details

Library feasibility, coordinate convention, minimum font size, mask policy, font shaping and file/page limit must be settled by prototype, not assumed.
