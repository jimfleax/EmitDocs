import { createFileRoute } from '@tanstack/react-router'
import { PdfUploadDropzone } from '@/components/templates/PdfUploadDropzone'

export const Route = createFileRoute('/_protected/app/templates/new')({
  component: NewTemplateRoute,
})

function NewTemplateRoute() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold">Upload New Template</h2>
      <p className="text-gray-600">
        Upload a PDF file to create a new template.
      </p>
      <PdfUploadDropzone />
    </div>
  )
}
