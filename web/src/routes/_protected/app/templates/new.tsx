import { createFileRoute } from '@tanstack/react-router'
import { PageShell } from '@/components/layout/PageShell'
import { PdfUploadDropzone } from '@/components/templates/PdfUploadDropzone'

export const Route = createFileRoute('/_protected/app/templates/new')({
  component: NewTemplateRoute,
})

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
  )
}
