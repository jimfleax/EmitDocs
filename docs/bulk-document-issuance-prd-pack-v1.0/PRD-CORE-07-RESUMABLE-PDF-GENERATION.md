# PRD-CORE-07 — On-demand Web Worker PDF generation and single recipient delivery

**Status:** Core MVP · P0; on-the-go deterministic generation without cloud output storage.

## Objective

Generate individual recipient PDFs deterministically on-the-go directly from frozen configuration records (`ApprovedSnapshot`, `ApprovedRecipient`) using an off-main-thread Web Worker. Eliminate individual PDF cloud storage (Cloudinary/R2), provide instant (<20ms) single-recipient preview and download, and maintain non-blocking UI responsiveness.

## User stories

- I can preview or download any approved recipient's personalized PDF instantly without waiting for a cloud generation queue.
- I can launch generation for all recipients in a background Web Worker without freezing my browser UI.
- I can pause, resume, or cancel ongoing generation at any time.
- If I close the browser and return, my approved snapshot remains locked, predictable, and immediately available for generation.
- Font glyph warnings or text overflows for a single recipient do not fail the generation for other recipients.

## Scope / exclusions

### In Scope
- Client-side Web Worker execution using `pdf-lib` and `@pdf-lib/fontkit`.
- Single base template retrieval from Cloudinary (cached in memory for the session).
- Single recipient instant preview (PDF modal) and instant single PDF download.
- Background worker execution for multi-row batches with chunked progress reporting (`current`, `total`, `percent`, `itemsPerSec`, `activeRecipientKey`, `warnings`).
- Worker pause, resume, and cancellation mechanisms.
- Purely deterministic output: frozen `templateSourceChecksum` + `mappingHash` + `effectiveData` produces identical PDFs at any time $t$.
- Graceful fault isolation: single recipient data warnings/errors logged without crashing the worker.

### Excluded
- Uploading generated recipient PDFs to Cloudinary or any cloud object storage.
- Server-side background queue workers (Celery, BullMQ, Lambda).
- Cloud storage upload leases or upload checkpoint retries.

## End-to-end flow

1. Batch enters `approved` status with an immutable `ApprovedSnapshot` and `ApprovedRecipient` records.
2. User opens the batch generation / results view (`/app/batches/:batchId/progress` or `/app/batches/:batchId/results`).
3. Single Recipient Download/Preview:
   - User clicks "Preview" or "Download" on a recipient row.
   - Client loads the base template bytes (cached) and executes `generatePdfWithOverlay()` in <20ms.
   - Instantly renders the PDF in a modal or triggers a direct browser file download (`Blob`).
4. Multi-Row Web Worker Generation:
   - User triggers batch generation.
   - Client instantiates `batch-generator.worker.ts` with template bytes, field mappings, and recipient records.
   - Worker processes recipients sequentially in memory, emitting progress messages every $N$ rows (or every 100ms) to update the UI progress bar and throughput metrics.
   - Main thread UI provides Pause, Resume, and Cancel controls:
     - **Pause:** Worker stops pulling the next recipient from its queue; current recipient finishes.
     - **Resume:** Worker continues from the next pending recipient.
     - **Cancel:** Worker terminates and cleans up allocated memory.
5. Batch Lifecycle in MongoDB:
   - Batch remains in `approved` state in MongoDB; generation is purely client-side JIT.
   - Closing or refreshing the browser does not leave the batch in a stuck "generating" lock in the database.

## Routes & Components

- `/app/batches/:batchId/progress` and `/app/batches/:batchId/results`
- `GenerationProgress`: Real-time progress bar, percentage, elapsed time, ETA countdown, and throughput (docs/sec).
- `RecipientStatusTable`: Paginated recipient listing with per-row "Instant Preview", "Download PDF", and validation warning flags.
- `GenerationControls`: Start, Pause, Resume, and Cancel buttons.
- `SinglePdfPreviewModal`: Fast visual proof of rendered output for any chosen recipient.

## API & Data

- `GET /api/batches/:id/snapshot`: Fetches the immutable snapshot metadata, mapping configuration, and template reference.
- `GET /api/batches/:id/snapshot/recipients`: Streams approved recipient records with `effectiveData` and `overrides`.
- `GET /api/templates/:id/versions/:version/file`: Authorized stream of base PDF bytes from Cloudinary.
- `ApprovedSnapshot`: Stores `templateSourceChecksum`, `mappingHash`, `canonicalDigest`, and `totalRecipients`.
- `ApprovedRecipient`: Stores `recipientKey`, `effectiveData`, `overrides`, and `digest`.
- Note: No individual `outputs` collection or Cloudinary upload endpoints are required.

## Performance & Security

- **Memory Safety**: Worker processes recipients one-by-one or in small chunks, freeing intermediate PDF documents via explicit dereferencing and garbage collection.
- **Data Privacy**: Recipient PII remains between MongoDB and the user's browser session. No recipient documents are exposed to public cloud URLs or stored in third-party media buckets.
- **Tenant Isolation**: Snapshot and recipient endpoints enforce strict session ownership checks.

## Acceptance Criteria

- **AC1**: Single recipient PDF is rendered and downloaded in <20ms using client-side engine.
- **AC2**: Web Worker executes batch generation off the main thread; UI remains fully responsive (60fps, no frame drops).
- **AC3**: Generation progress (current, total, percentage, rate) updates accurately in real time.
- **AC4**: Pause halts generation cleanly at the current recipient boundary; resume continues without restarting from row 0.
- **AC5**: Cancellation immediately stops the Web Worker and frees memory.
- **AC6**: Refreshing or closing the tab leaves batch in `approved` state ready to re-generate on return.
- **AC7**: Row-level overflow/glyph warnings are recorded in worker progress without aborting the batch.
- **AC8**: Identical configuration inputs produce mathematically deterministic PDF outputs.

## Tests

- Web Worker message passing: start, progress, pause, resume, cancel.
- Single recipient JIT rendering benchmark (<20ms).
- Fault isolation: malformed recipient data emits warning and continues to next recipient.
- Determinism verification: two separate generation runs with same snapshot produce identical SHA-256 byte hashes.
- Concurrency test: multiple tabs or rapid resume/pause actions do not cause race conditions.
