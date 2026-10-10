import { createFileRoute } from '@tanstack/react-router'
import { TemplateDetails } from '@/components/templates/TemplateDetails'

export const Route = createFileRoute('/_protected/app/templates/$templateId')({
  component: TemplateDetailRoute,
})

function TemplateDetailRoute() {
  const { templateId } = Route.useParams()
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Template Details</h2>
      <TemplateDetails templateId={templateId} />
    </div>
  )
}
