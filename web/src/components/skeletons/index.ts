/**
 * @file index.ts
 * @description Barrel exports for all loading skeleton components.
 * @architecture Central export point for loading placeholder components across templates, batches, and editors.
 * @agent_note Exposes all feature-specific skeleton components for consistent Suspense fallbacks.
 */

export { DefaultPageSkeleton } from "./DefaultPageSkeleton";
export { TemplateLibrarySkeleton } from "./TemplateLibrarySkeleton";
export { TemplateDetailsSkeleton } from "./TemplateDetailsSkeleton";
export { PdfMappingWorkspaceSkeleton } from "./PdfMappingWorkspaceSkeleton";
export { NewBatchFormSkeleton } from "./NewBatchFormSkeleton";
export { BatchImportSkeleton } from "./BatchImportSkeleton";
export { DraftReviewSkeleton } from "./DraftReviewSkeleton";
export { DraftGallerySkeleton } from "./DraftGallerySkeleton";
export { BatchListSkeleton } from "./BatchListSkeleton";
