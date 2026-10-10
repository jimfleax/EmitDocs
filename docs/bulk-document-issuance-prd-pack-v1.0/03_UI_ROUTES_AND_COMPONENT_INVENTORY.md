# UI routes, layouts and component inventory

**Purpose:** Functional information architecture only. No pixel-perfect styling, palette, font, animation or final design system is prescribed.

## Route inventory (proposed)

| Route | Access | Main purpose | Required states |
|---|---|---|---|
| `/sign-in` | Public | Google sign-in/error recovery | idle, authenticating, failed, unavailable |
| `/app` | Authenticated | Dashboard/recent work | loading, empty, populated, partial failure |
| `/app/templates` | Authenticated | Template library/search | loading, empty, populated, error |
| `/app/templates/new` | Authenticated | Upload/preflight new PDF | selecting, uploading, inspecting, supported, warning, unsupported, failed |
| `/app/templates/:templateId` | Owner | Template detail/version list | loading, active, deleted/unavailable, error |
| `/app/templates/:templateId/versions/:versionId` | Owner | Mapping and formatting editor (not full design editor) | inspecting, mapping, preview, warning, saved/conflict |
| `/app/batches/new` | Authenticated | Select template/start batch | loading, selection, error |
| `/app/batches/:batchId/import` | Owner | Import CSV/XLSX and map columns | parsing, worksheet selection, mapping, invalid rows, ready, error |
| `/app/batches/:batchId/review` | Owner | Draft gallery/inline edit/re-import diff | loading, gallery, preview, edit, conflict/reconciliation |
| `/app/batches/:batchId/approve` | Owner | Validate and approve snapshot | ready, blocked, snapshot building, conflict, approved |
| `/app/batches/:batchId/progress` | Owner | Generation status and controls | queued, active, paused, recovering, cancelling, partial, failed, completed |
| `/app/batches/:batchId/results` | Owner | Individual/ZIP downloads | generating, ready, partial, ZIP building, expired, cleanup warning |
| `/app/settings/retention` | Authenticated | Default and per-job retention | loaded, saving, error |
| `/app/settings/account` | Authenticated | Sign-out/account deletion | normal, confirmation, deletion pending, signed out |
| `/privacy` | Public | Privacy/retention disclosure | content, unavailable notice |

Exact URL syntax can be refined, but step-specific persistent routes are the selected direction so refresh/back/forward can recover the correct step from server state.

## Layouts

### Public layout
Work title (internal working name), Google sign-in, status/error region, privacy link when copy is finalized.

### Authenticated shell
Header/account menu, navigation to templates/recent batches/settings, breadcrumb/current step, accessible status/error region, main content. Exact layout and styling are open.

### Batch workflow layout
Step sequence: template → import → review → approve → progress → results. Backend lifecycle controls permitted actions; front-end state alone cannot approve/complete work. Avoid exposing full names/emails in URLs or global navigation.

## Component inventory

### Shared/auth
`AppRouter`, `AuthGuard`, `SessionBootstrap`, `RouteErrorBoundary`, `AppShell`, `PageHeader`, `Breadcrumbs`, `StatusBanner`, `LoadingState`, `EmptyState`, `InlineError`, `ConfirmDialog`, `NoticeRegion`, `AccountMenu`, `GoogleSignInButton`, `SessionExpiredDialog`, `SignOutAction`, `DeleteAccountDialog`.

### Template/upload
`TemplateLibrary`, `TemplateCard/Row`, `TemplateSearch`, `NewTemplateAction`, `PdfUploadDropzone`, `UploadProgress`, `PdfCompatibilityReport`, `TemplateVersionList`, `TemplateDeleteDialog`.

### PDF mapping/preview
`PdfDocumentViewport`, `PdfPageNavigator`, `PdfPageThumbnailStrip`, `DetectedTokenList`, `FieldOverlayLayer`, `FieldSelectionTool`, `FieldPropertiesPanel`, `FontSelector`, `FontGlyphWarning`, `MaskPreview`, `TextFitPreview`, `LayoutWarningList`, `PreviewDocumentPane`, `PreviewLoadState`.

### Import/review
`DataFilePicker`, `WorksheetSelector`, `ImportSchemaSummary`, `ColumnMappingTable`, `ImportValidationSummary`, `RowErrorTable`, `DuplicateWarning`, `RowEditor`, `ReimportDiffReview`, `MatchResolutionTable`, `DraftGallery`, `RecipientPreviewPanel`, `OverflowBadge`, `DraftNavigation`, `FilterByIssue`, `InlineFieldEditor`.

### Approval/generation
`SnapshotDiffSummary`, `ApprovalCounts`, `ApprovalConfirmation`, `GenerationProgress`, `PhaseProgressSummary`, `RecipientStatusTable`, `PauseResumeControls`, `CancelJobDialog`, `LeaseStatusIndicator`, `ResumePrompt`, `PollStatusHook`.

### Downloads/retention
`OutputTable`, `OutputDownloadAction`, `ZipArchiveList`, `ArchiveSizeEstimate`, `SplitArchiveNotice`, `ExpiryCountdown/Label`, `ExpiredOutputNotice`, `CleanupStatusNotice`, `RetentionPresetSelector`.

## Required UI states

Every route defines loading, empty, success, validation error, recoverable error, terminal error, permission denial, resource expired/deleted and stale revision states as relevant. Polling reflects persisted server state; transport failure never resets progress to zero. Gallery is searchable/paginated so users can browse every draft without opening thousands of tabs. PDF canvas is paired with accessible field/value/error information.

## Design-neutral constraints

- Do not prescribe brand colors, fonts, rounded corners, shadows, animation or density.
- Table/list/gallery are implementation choices as long as functional flows remain.
- Primary test target: latest stable Chrome/Edge desktop; current Firefox secondary; Safari/mobile support provisional until benchmarked.
