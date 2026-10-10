# PDF Engine and Rendering Specification

## Product requirement

The user uploads an existing PDF, imports structured records, maps placeholders/regions, and generates individualized documents. Preserve the source design as far as the supported PDF model allows. The app should not require users to recreate the entire document in a proprietary editor.

## Fundamental constraint

A PDF is primarily a rendering description, not necessarily a semantic/editable document. Text can be fragmented into multiple drawing operations, use embedded/subset fonts, be outlined as vectors or be baked into images. Detecting a placeholder does not mean the old text can be safely removed. The `pdf-lib` project documentation says it can manipulate PDF form fields and draw content, but does not provide general APIs to extract ordinary page text or remove/edit page-drawn text outside a form field. PDF.js helps render and extract searchable text positions; it does not make every file an editable layout model.

## Selected MVP scope

- Text-based PDFs with automatic field suggestions.
- Standardized token recognition where possible (examples: `{{name}}`, `{{date}}`, `{{organization}}`).
- Visual field mapping and user confirmation when token detection is absent or uncertain.
- User-confirmed overlays/masking rather than a promise of in-place arbitrary text replacement.
- Clean placeholder areas required when a background cannot be safely reconstructed.
- Text, dates and numbers as initial variable types.
- Capped multi-page support; exact page cap established through benchmarks.
- Scanned/image-only PDF OCR is not committed.
- Universal arbitrary PDF compatibility is not committed.

## Candidate pipeline

1. Load/render the source PDF in the browser using PDF.js.
2. Extract searchable text and candidate token positions; detection is a suggestion, not authority.
3. Suggest mapped field boxes and allow the user to confirm/correct them.
4. Associate PDF fields with CSV/XLSX column definitions and per-field formatting.
5. If replacing visible placeholder text, let the user confirm a mask region. Do not blindly paint a white block over patterned/illustrated artwork.
6. Draw the replacement with pdf-lib, embedding fonts where permitted and applying alignment, color, size and fitting rules.
7. Create preview output through the same transformation pipeline as final output. Render the resulting PDF preview via PDF.js to minimize drift.
8. Display missing-value, unsupported layout and overflow warnings; do not silently clip or misplace content.
9. Allow the user to browse every draft from a paginated/searchable gallery. Generate/render the full output preview on demand to control memory/storage.
10. After final approval, process an immutable snapshot in bounded Web Worker chunks. Upload completed outputs and persist checkpoints; resume after the user returns.

## Fit-then-flag behavior

The user selected “fit-then-flag.” Proposed implementation:
- Compute available space from the configured field box.
- Shrink only inside explicit minimum/maximum font-size bounds.
- If a value still does not fit, flag the affected document/field and require correction or explicit override.
- Do not silently clip, overlap nearby content or shrink to unreadable size.
- Wrapping may be added as a per-field option, but the user has not independently selected a wrapping policy.

## Preview and draft gallery

The same PDF transformation pipeline should produce preview and final output to minimize differences in font metrics/masking. The gallery should support pagination, search, row-level warnings, document preview and individual inspection of all drafts before approval. Full final PDFs need not all be permanently stored before approval, but every draft must be browseable.

## Browser execution and limits

PDF work is browser-side; Web Workers should keep the UI responsive. The browser cannot continue processing after it is closed/suspended. The selected model is pause/resume on return. Browser memory is finite, so output buffers and ZIP creation must be bounded/streamed where possible, and large batches may need multiple ZIP archives.

## Required fixture tests

- Standard searchable text PDF and explicit token.
- Token split across text fragments.
- Embedded/subset fonts and Unicode names.
- Long and unusually short names.
- Rotated text or pages.
- Multi-page layout with fields on multiple pages.
- Date and numeric formatting.
- Patterned background and unsafe mask area.
- Empty/missing placeholder or missing data field.
- Malformed/corrupted PDF.
- Encrypted/password PDF (reject clearly if not supported).
- Oversized page/file or too-many-pages file.
- Font cannot be embedded or unsupported text encoding.
- Preview/final render consistency.

## Benchmark-before-promise

No final max bytes/pages/rows/fields/output size, concurrent jobs or completion time has been selected. Test 500, 1,000 and 5,000 records on representative templates and browsers/devices. Measure time to first preview, worker/UI responsiveness, peak memory, error rate, object upload rate, ZIP memory and resume behavior. Advertise only limits that pass the chosen fixture/benchmark matrix.

## References

- PDF.js: https://github.com/mozilla/pdf.js
- PDF.js API: https://mozilla.github.io/pdf.js/api/
- pdf-lib: https://github.com/Hopding/pdf-lib
- JSZip: https://stuk.github.io/jszip/documentation/api_jszip/generate_async.html
