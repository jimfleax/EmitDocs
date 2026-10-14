/**
 * @file new.tsx
 * @description Template creation route providing upload dropzone and document configuration.
 * @architecture Route page wrapping PdfUploadDropzone inside PageShell.
 * @agent_note Accessible at /app/templates/new, directs users to upload new PDF files for layout mapping.
 */

import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/PageShell";
import { PdfUploadDropzone } from "@/components/templates/PdfUploadDropzone";

export const Route = createFileRoute("/_protected/app/templates/new")({
  component: NewTemplateRoute,
});

/**
 * @component NewTemplateRoute
 * @description Template ingestion view for uploading new PDF documents.
 * @returns {JSX.Element} PageShell enclosing PdfUploadDropzone.
 */
function NewTemplateRoute() {
  return (
    <PageShell
      title="Upload New Template"
      subtitle="Upload a single or multi-page PDF document to configure certificate and credential layouts."
      backTo="/app/templates"
      backLabel="Back to Templates"
      maxWidth="3xl"
    >
      <PdfUploadDropzone />
    </PageShell>
  );
}
