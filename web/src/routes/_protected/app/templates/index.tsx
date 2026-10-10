import { createFileRoute, Link } from '@tanstack/react-router'
import { TemplateLibrary } from '@/components/templates/TemplateLibrary'

export const Route = createFileRoute('/_protected/app/templates/')({
  component: TemplatesRoute,
})

function TemplatesRoute() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Template Library</h2>
        <Link
          to="/app/templates/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          New Template
        </Link>
      </div>
      <TemplateLibrary />
    </div>
  )
}
