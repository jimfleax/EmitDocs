import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from '@phosphor-icons/react'
import { PdfUploadDropzone } from '@/components/templates/PdfUploadDropzone'

export const Route = createFileRoute('/_protected/app/templates/new')({
  component: NewTemplateRoute,
})

function NewTemplateRoute() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Section */}
      <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
        <Link
          to="/app/templates"
          title="Back to Templates"
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer select-none shrink-0"
        >
          <ArrowLeft size={20} weight="bold" />
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Upload New Template
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
            Upload a single or multi-page PDF document to configure certificate and credential layouts.
          </p>
        </div>
      </div>

      {/* Main Upload Dropzone */}
      <PdfUploadDropzone />
    </div>
  )
}
