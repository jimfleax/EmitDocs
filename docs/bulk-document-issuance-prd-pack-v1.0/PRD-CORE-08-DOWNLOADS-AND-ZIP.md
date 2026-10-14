# PRD-CORE-08 — Client-side streaming ZIP packaging and archive splitting

**Status:** Core MVP · P0; memory-bounded client-side streaming ZIP export.

## Objective

Package approved batch documents into streaming ZIP archives directly on the client using `client-zip` without storing intermediate files in cloud storage (Cloudinary). Provide bounded browser memory usage, automatic volume splitting at 1,000 documents per archive, and collision-safe, path-traversal-sanitized file names.

## User stories

- I can download my entire batch of generated documents as a single or split `.zip` archive directly from my browser.
- If my batch contains more than 1,000 documents, the app splits the download into organized volumes (e.g. `batch-name_part-1.zip`, `batch-name_part-2.zip`) so my browser memory remains safe.
- File names inside the archive are clean, legible, and derived from recipient names, with unique keys preventing name collisions.
- I can see an estimated total archive size and real-time streaming packaging progress.

## Scope / exclusions

### In Scope
- Client-side streaming ZIP assembly using `client-zip` (`ReadableStream<Uint8Array>`).
- Generator-based Web Worker pipeline yielding `{ name: string, input: Uint8Array }` chunks.
- Automatic archive volume splitting at 1,000 documents per ZIP archive.
- Filename builder:
  - Detects primary recipient identifier (e.g. `name`, `full_name`, `recipient_name`).
  - Strips directory traversal sequences (`../`, `..\\`) and illegal characters (`/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`, control codes).
  - Appends `_{recipientKey}` to guarantee zero collision and zero overwrite inside the archive.
  - Formats as: `[Sanitized_Name]_[recipientKey].pdf`.
- Memory bounding: generated PDF buffers are piped to the stream and immediately garbage-collected.
- Standard ZIP specification compliance (CRC32, valid headers, extractable by native Windows Explorer, macOS Archive Utility, and Linux `unzip`).

### Excluded
- Server-side ZIP buffering or packaging (saving server RAM and CPU).
- Uploading ZIP files to Cloudinary or external buckets.
- Cloud storage download URLs.

## End-to-end flow

1. User navigates to the batch export screen (`/app/batches/:batchId/results`).
2. The UI queries snapshot metadata (`GET /api/batches/:id/snapshot`) to retrieve `totalRecipients`.
3. If `totalRecipients <= 1000`:
   - Single download button: **"Download Complete ZIP (X documents)"**.
4. If `totalRecipients > 1000`:
   - Volume list: Shows numbered parts (e.g. **"Download Part 1 (Rows 1–1,000)"**, **"Download Part 2 (Rows 1,001–2,000)"**).
5. User initiates download:
   - Worker fetches approved recipients for the chosen volume from `GET /api/batches/:id/snapshot/recipients?skip=...&limit=1000`.
   - Worker initializes `client-zip` with an async generator.
   - For each recipient:
     - Worker generates PDF bytes using `pdf-lib`.
     - Worker sanitizes file name.
     - Worker yields file object to the ZIP stream.
     - Worker posts streaming chunk / progress to the main thread.
   - The resulting `ReadableStream` is converted to a `Blob` (or piped via FileSystem API / Blob URL) and triggers native browser download.
6. The archive downloads cleanly to the user's local disk.

## Routes & Components

- `/app/batches/:batchId/results`
- `ZipPackagingControls`: Primary action to trigger streaming archive download.
- `VolumeSplitSelector`: Segmented control or volume card list for batches exceeding 1,000 rows.
- `StreamingProgressModal`: Displays current document being zipped, transfer speed, and completion status.
- `ArchiveSizeEstimator`: Displays calculated approximate ZIP size based on base PDF size $\times$ recipient count.

## Security & Reliability

- **Zip Slip Prevention**: All filename inputs are strictly scrubbed of path traversal characters and path separators. Files are placed strictly at the root level of the ZIP archive.
- **Memory Bounding**: By utilizing generator streams rather than holding an array of 1,000 PDF Buffers in client state, memory consumption remains flat under ~100MB.
- **Fail-Safe Recovery**: If a network glitch occurs while fetching recipient metadata or a user closes the tab, no partial or corrupted files exist on the server. The user simply restarts the stream.

## Acceptance Criteria

- **AC1**: User can stream-generate and download a complete ZIP archive directly in the browser without server-side file storage.
- **AC2**: Batches with >1,000 documents are partitioned into discrete 1,000-item volumes with explicit part labels.
- **AC3**: Filenames inside the archive are sanitized against path traversal (`..`, `/`, `\`) and illegal OS characters.
- **AC4**: Duplicate recipient names are assigned unique filenames using `recipientKey` collision suffixes.
- **AC5**: Peak client memory usage during 1,000-document ZIP generation stays bounded (<150MB).
- **AC6**: Generated ZIP archives extract cleanly with native OS archive utilities without CRC or corruption errors.

## Tests

- Streaming ZIP generation unit test with `client-zip`.
- Filename sanitizer unit test (hostile filenames: `../../etc/passwd`, `CON.txt`, Unicode, emojis, 255+ char limits).
- Archive split boundary test: batch of 1,005 items produces Volume 1 (1,000 items) and Volume 2 (5 items).
- ZIP structure test: verify valid central directory headers and extractability using JSZip / standard zip readers.
