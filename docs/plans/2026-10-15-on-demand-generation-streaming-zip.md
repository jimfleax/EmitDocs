# PRD-CORE-07 & PRD-CORE-08: On-Demand Web Worker Generation & Streaming ZIP Implementation Plan

**Goal:** Implement client-side on-demand PDF generation in a dedicated Web Worker (PRD-CORE-07) and memory-bounded streaming ZIP packaging with 1,000-document volume partitioning (PRD-CORE-08), completely eliminating individual PDF cloud storage.

**Architecture:** Deep client-side modules (`filename-sanitizer`, `volume-partitioner`, `streaming-zip-packager`) running inside an off-main-thread Web Worker with `pdf-lib` and `client-zip`. Base template PDF is retrieved once from Cloudinary; recipient metadata is fetched from MongoDB; generated PDFs are streamed directly into ZIP archives in browser memory without intermediate server or cloud storage.

**Tech Stack:** TypeScript, React 19, `@tanstack/react-router`, `pdf-lib`, `@pdf-lib/fontkit`, `client-zip`, Web Workers, Hono, MongoDB.

---

## Decisions & Invariants (from /grill-me)
1. **Separate Focused PRD Stages**: PRD-CORE-07 covers the Web Worker on-demand PDF engine and instant single-recipient preview/download; PRD-CORE-08 covers streaming ZIP packaging, archive splitting, and batch export.
2. **1,000-Document Volume Splitting**: Batches exceeding 1,000 recipients are partitioned into numbered archive volumes (e.g., `batch-name_part-1.zip`, `batch-name_part-2.zip`) to keep archive sizes under ~500MB and guarantee flat memory usage (<150MB).
3. **Deterministic & Sanitized Filenames**: Filenames auto-detect primary recipient name + unique `recipientKey` collision suffix (`[Sanitized_Name]_[recipientKey].pdf`) and strip path traversal characters (`..`, `/`, `\`) to eliminate Zip Slip vulnerabilities.
4. **Non-Locking Batch Lifecycle**: The batch remains in `approved` status in MongoDB, allowing repeated on-demand exports without leaving a stuck "generating" lock in the database.
5. **Zero Cloud Storage for Recipient PDFs**: Cloudinary stores only base templates (`templates/{userId}/...`). Batch retention expiry prunes MongoDB snapshot/recipient PII; Cloudinary deletion is restricted to explicit template and account deletions.

---

## Phase 1: Core Deep Domain Modules (TDD)

### Task 1: Safe Filename Sanitizer & Collision Resolver
- **Files to Create:**
  - `web/src/lib/pdf-engine/filename-sanitizer.ts`
  - `test/filename-sanitizer.test.ts`
- **Responsibilities:**
  - Detect primary name column from recipient `effectiveData` (e.g. `name`, `full_name`, `recipient_name`, `student_name`).
  - Strip directory traversal sequences (`../`, `..\\`) and illegal filename characters (`/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`, control codes).
  - Clamp filename length to 100 characters to prevent filesystem errors on Windows/macOS.
  - Append `_{recipientKey}` to guarantee zero overwrite collisions inside ZIP archives.
  - Export: `sanitizeDocumentFilename(effectiveData: Record<string, unknown>, recipientKey: string, fallbackDocName?: string): string`.
- **Verification:**
  - Unit tests verifying malicious paths (`../../etc/passwd`), Windows reserved names (`CON.txt`, `PRN`), emojis, special characters, and duplicate name suffixes.

### Task 2: Volume Partitioner & Archive Sizing Estimator
- **Files to Create:**
  - `web/src/lib/pdf-engine/volume-partitioner.ts`
  - `test/volume-partitioner.test.ts`
- **Responsibilities:**
  - Partition $N$ approved recipients into 1,000-document volumes:
    - E.g., 2,450 recipients $\to$ Volume 1 (1–1,000), Volume 2 (1,001–2,000), Volume 3 (2,001–2,450).
  - Compute archive name: `{batchName}_part-{index}.zip` or `{batchName}.zip` if only 1 volume.
  - Calculate approximate ZIP size estimate based on base template byte size $\times$ volume item count.
  - Export: `partitionBatchVolumes(totalRecipients: number, batchName: string, baseTemplateBytes: number): BatchVolumeInfo[]`.
- **Verification:**
  - Unit tests for edge cases: 0 rows, 1 row, 999 rows, 1,000 rows, 1,001 rows, 5,000 rows.

### Task 3: Streaming ZIP Packaging Module using `client-zip`
- **Files to Create:**
  - `web/src/lib/pdf-engine/streaming-zip.ts`
  - `test/streaming-zip.test.ts`
- **Responsibilities:**
  - Integrate `client-zip` (`downloadZip`).
  - Provide an async generator wrapper that consumes an async iterator of `{ name: string, input: Uint8Array }` items and produces a standard Web `Response` with `ReadableStream<Uint8Array>`.
  - Provide stream-to-blob utility and stream-to-download helper for triggering native browser file saves.
- **Verification:**
  - Unit test packaging 10 synthetic PDF buffers into a ZIP; verify central directory headers, CRC32, and extractability via JSZip.

---

## Phase 2: Web Worker Generation Pipeline (PRD-CORE-07)

### Task 4: Dedicated Web Worker Implementation
- **Files to Create:**
  - `web/src/workers/batch-generator.worker.ts`
- **Responsibilities:**
  - Run completely off the main UI thread.
  - In-memory state:
    - Cached base PDF `ArrayBuffer`.
    - Parsed `FieldMappingConfig[]`.
    - Custom fonts (if any).
  - Message Protocol:
    - Inbound:
      - `{ type: 'INIT', payload: { basePdfBytes: ArrayBuffer, fieldMappings: FieldMappingConfig[], customFontBytes?: ArrayBuffer } }`
      - `{ type: 'GENERATE_SINGLE', payload: { recipient: ApprovedRecipientDto } }`
      - `{ type: 'START_BATCH', payload: { recipients: ApprovedRecipientDto[], volumeIndex?: number } }`
      - `{ type: 'PAUSE' }`
      - `{ type: 'RESUME' }`
      - `{ type: 'CANCEL' }`
    - Outbound:
      - `{ type: 'INIT_READY' }`
      - `{ type: 'SINGLE_COMPLETE', payload: { recipientKey: string, pdfBytes: Uint8Array, warnings: EngineWarning[] } }`
      - `{ type: 'PROGRESS', payload: { current: number, total: number, percent: number, itemsPerSec: number, activeRecipientKey: string, warningsCount: number } }`
      - `{ type: 'ZIP_CHUNK_READY', payload: { zipBlob: Blob, volumeIndex: number, totalDocuments: number, warnings: EngineWarning[] } }`
      - `{ type: 'PAUSED', payload: { current: number } }`
      - `{ type: 'CANCELLED' }`
      - `{ type: 'ERROR', payload: { message: string, fatal: boolean } }`
  - Memory Management:
    - Dereference individual `PDFDocument` and `Uint8Array` buffers immediately after yielding into the stream so the garbage collector keeps browser RAM flat (<150MB).

### Task 5: Web Worker Client Hook & State Machine
- **Files to Create:**
  - `web/src/hooks/useBatchGeneratorWorker.ts`
- **Responsibilities:**
  - Manages Web Worker lifecycle (spawning, termination, error handling).
  - State: `status: 'idle' | 'initializing' | 'ready' | 'generating' | 'paused' | 'completed' | 'cancelled' | 'error'`.
  - Real-time metrics: `current`, `total`, `percent`, `itemsPerSec`, `etaSeconds`, `elapsedSeconds`.
  - Exposes actions:
    - `initializeWorker(templateBytes, fieldMappings, fonts)`
    - `generateSingle(recipient)` $\to$ Promise<Uint8Array>
    - `startZipExport(recipients, volumeIndex)` $\to$ Promise<Blob>
    - `pause()`
    - `resume()`
    - `cancel()`

---

## Phase 3: Backend API Support (Hono & MongoDB)

### Task 6: Authorized Base Template PDF Stream Endpoint
- **Files to Modify:**
  - `api/src/services/template-lifecycle.ts`
  - `api/src/controllers/templates.controller.ts`
  - `api/src/routes/templates.route.ts`
- **Responsibilities:**
  - Ensure `GET /api/templates/:id/versions/:version/file` verifies ownership or active batch association, retrieves the PDF stream from Cloudinary, and streams back with:
    - `Content-Type: application/pdf`
    - `Cache-Control: private, max-age=3600`
- **Verification:**
  - Automated test verifying authorized download succeeds and unauthorized cross-tenant request returns 404/403.

### Task 7: Recipient Volume Pagination Support
- **Files to Modify:**
  - `api/src/controllers/batches.controller.ts`
  - `api/src/services/batch-approval.ts`
- **Responsibilities:**
  - Ensure `GET /api/batches/:id/snapshot/recipients` supports `skip` and `limit` query parameters for fetching 1,000-recipient slices efficiently.
- **Verification:**
  - Test verifying `skip=0&limit=1000` returns rows 1–1000, and `skip=1000&limit=1000` returns rows 1001–2000.

### Task 8: Optional Export Audit Log Endpoint
- **Files to Create / Modify:**
  - `api/src/controllers/batches.controller.ts`
  - `api/src/routes/batches.route.ts`
- **Responsibilities:**
  - Mount `POST /api/batches/:id/generation/audit` to record timestamp, volume downloaded, and document count in an audit trail without locking the batch state.

---

## Phase 4: Frontend UI Routes & Components (PRD-CORE-07 & PRD-CORE-08)

### Task 9: Single Recipient Actions & Fast Preview Modal
- **Files to Create:**
  - `web/src/components/batches/results/SingleRecipientAction.tsx`
  - `web/src/components/batches/results/SinglePdfPreviewModal.tsx`
- **Responsibilities:**
  - "Preview" button: triggers on-demand generation in <20ms and opens modal with high-fidelity canvas/PDF renderer.
  - "Download PDF" button: generates single PDF on-demand and triggers direct browser file download.

### Task 10: Real-Time Worker Progress & Throughput Dashboard
- **Files to Create:**
  - `web/src/components/batches/results/GenerationProgressCard.tsx`
  - `web/src/components/batches/results/GenerationThroughputMetrics.tsx`
- **Responsibilities:**
  - Progress bar with animated fill, percentage, and live processed count (`450 / 1,000 generated`).
  - Throughput meter: docs/sec rate and calculated ETA countdown.
  - Control bar: Pause, Resume, Cancel buttons with visual status indicators.

### Task 11: Streaming ZIP Packaging Controls & Volume Selector
- **Files to Create:**
  - `web/src/components/batches/results/StreamingZipControls.tsx`
  - `web/src/components/batches/results/VolumeSplitCard.tsx`
  - `web/src/components/batches/results/ArchiveSizeEstimateBadge.tsx`
- **Responsibilities:**
  - For $\le 1,000$ documents: Primary "Download All as ZIP" action.
  - For $> 1,000$ documents: Multi-part volume selector showing parts (e.g. "Part 1 (Rows 1–1,000) ~450MB", "Part 2 (Rows 1,001–2,000) ~450MB").
  - Triggers the Web Worker streaming pipeline and prompts browser download when the stream completes.

### Task 12: Mount Generation & Results Workspace Route
- **Files to Create / Modify:**
  - `web/src/routes/_protected/app/batches/$batchId_.results.tsx`
  - `web/src/components/batches/results/ResultsWorkspace.tsx`
  - `web/src/components/batches/approval/ApprovalWorkspace.tsx` (wire "Approve & Continue" to `/app/batches/$batchId/results`)
- **Responsibilities:**
  - Load batch, approved snapshot, and template info.
  - Render summary banner (Approved Template Version, Total Recipients, Retention Expiration Countdown).
  - Mount `StreamingZipControls`, `GenerationProgressCard`, and paginated `RecipientStatusTable`.

---

## Phase 5: Verification & Acceptance Matrix

### Task 13: Core-07 & Core-08 Acceptance Matrix Test Suite
- **Files to Create:**
  - `test/core-07-acceptance-matrix.test.ts`
  - `test/core-08-acceptance-matrix.test.ts`
- **Acceptance Criteria Verification:**
  - **CORE-07 AC1**: Single recipient PDF generated and downloaded in <20ms.
  - **CORE-07 AC2**: Web Worker executes off-main-thread; UI responsiveness intact.
  - **CORE-07 AC3**: Accurate progress metrics (current, total, percentage, rate).
  - **CORE-07 AC4**: Pause cleanly stops at recipient boundary; resume continues seamlessly.
  - **CORE-07 AC5**: Cancel immediately aborts worker and releases memory.
  - **CORE-07 AC6**: Refreshing tab leaves batch in `approved` state ready to regenerate.
  - **CORE-07 AC7**: Glyph/overflow warnings isolated to individual recipient without failing batch.
  - **CORE-07 AC8**: Mathematically deterministic output (SHA-256 match).
  - **CORE-08 AC1**: Browser streaming ZIP generates and downloads without server storage.
  - **CORE-08 AC2**: Batches > 1,000 items partition into discrete 1,000-item volumes.
  - **CORE-08 AC3**: Filenames sanitized against path traversal (`..`, `/`, `\`) and illegal OS characters.
  - **CORE-08 AC4**: Collision resolution prevents overwrites via `recipientKey`.
  - **CORE-08 AC5**: Client memory remains bounded (<150MB) during 1,000-document generation.
  - **CORE-08 AC6**: Generated ZIP extracts cleanly with standard OS unzip tools.
