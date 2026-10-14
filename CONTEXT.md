# Domain Glossary (CONTEXT.md)

This glossary defines the ubiquitous language for EmitDocs. Use these terms consistently in code, specifications, and architecture reviews.

## Core Concepts

### Batch
The top-level issuance unit grouping a single document template, a data import revision, review drafts, and output artifacts. Moves through lifecycle states: `draft` → `importing` → `review` → `awaiting_approval` → `approved` → `generating` → `ready_for_download`.

### Template & TemplateVersion
A base document definition (e.g. certificate or invoice) with immutable field mappings. Each modification bumps the `TemplateVersion` with a canonical `mappingHash` and Compare-And-Swap (CAS) conflict detection.

### BatchImport
A single spreadsheet upload revision associated with a batch. Tracks source file metadata, worksheet selection, column mapping, chunked upload progress, and reconciliation status.

### DraftRow
A single recipient data row within a batch import revision. Maintains strict separation between:
- `importedData`: raw spreadsheet values (immutable reference)
- `overrides`: user-edited field values applied during review
- `effectiveData`: calculated merged values after normalisation and overrides
- `status`: `valid` or `invalid`, plus non-blocking `warnings` (e.g. duplicates)

### Batch Intake
The deep domain module (`BatchIntake` in `api/src/services/batch-intake.ts`) responsible for:
- Chunked row ingestion (`ingestChunk`)
- Authoritative validation & duplicate fingerprinting (`finalizeImport`)
- Manual row overrides with CAS optimistic concurrency (`patchRowOverride`)
- Re-import diff reconciliation across revisions (`reconcileImportRevision`)
- Encapsulated, authoritative summary counter rollups (`totalRows`, `validRows`, `invalidRows`, `duplicateRows`)

### Batch Intake Invariants & Seam
- **Interface**: Domain commands accepting plain validated parameters and returning domain result objects.
- **Seam**: Placed between the HTTP controller adapter (`batches.controller.ts`) and the database. The controller only unpacks HTTP transport data and maps typed domain errors to HTTP status codes.
- **Internal Units**: `row-validator`, `duplicate-detector`, `diff-calculator`, and `data-normalizer` are internal implementation units private to the module. Outside callers never import them directly.
- **Error Types**: Typed domain errors (`BatchNotFoundError`, `ConcurrencyConflictError`, `ChunkMismatchError`, `BatchIntakeValidationError`) ensure the module remains completely decoupled from HTTP transport.
- **Counter Encapsulation**: Summary counts are recomputed and persisted internally; callers never execute manual count queries.

### ApprovedSnapshot
An immutable, sealed snapshot of batch metadata, template version, mapping hash, and effective recipient rows created upon final approval before generation begins. Any row override or re-import reconciliation automatically invalidates stale approval state (`approvedSnapshotId = null`, status returns to `review`).

### Template Lifecycle
The deep domain module (`TemplateLifecycle` in `api/src/services/template-lifecycle.ts`) responsible for:
- Initial template asset registration & Cloudinary signature generation (`signUploadParams`, `createTemplate`)
- Canonical field mapping hash generation and optimistic CAS version bumps (`publishVersion`)
- Deterministic thumbnail signing, validation, and transparent background healing (`ensureThumbnailHealth`)
- Dual-format PDF asset streaming and fallback retrieval (`streamAsset`)
- Soft-deletion and listing with populated active version snapshots (`getTemplate`, `listTemplates`, `deleteTemplate`)

### Template Lifecycle Invariants & Seam
- **Interface**: Pure domain service functions accepting plain parameter payloads (`ownerId`, IDs, version numbers, field mappings) and returning domain entities without HTTP concepts.
- **Seam**: Placed between the HTTP transport adapter (`templates.controller.ts`) and database/Cloudinary. Controller maps route parameters and catches typed domain errors (`TemplateNotFoundError`, `VersionConflictError`, `TemplateValidationError`).
- **Internal Units**: SHA-256 canonical mapping hasher, Cloudinary authenticated URL builders, and dual-resource probes are sealed private implementation units.
- **Error Types**: Typed domain errors (`TemplateNotFoundError`, `VersionConflictError`, `TemplateValidationError`) decouple business failures from HTTP transport.

### Output
A generated artifact (single PDF, bulk ZIP archive, or manifest) linked to an approved snapshot and recipient.
