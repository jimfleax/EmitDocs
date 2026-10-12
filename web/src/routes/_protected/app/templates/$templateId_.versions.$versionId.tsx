import { createFileRoute } from '@tanstack/react-router';
import { PdfMappingWorkspace } from '@/components/templates/mapping/PdfMappingWorkspace';

export const Route = createFileRoute('/_protected/app/templates/$templateId_/versions/$versionId')({
  component: TemplateVersionMappingRoute,
});

function TemplateVersionMappingRoute() {
  const { templateId, versionId } = Route.useParams();
  return <PdfMappingWorkspace templateId={templateId} versionId={versionId} />;
}
