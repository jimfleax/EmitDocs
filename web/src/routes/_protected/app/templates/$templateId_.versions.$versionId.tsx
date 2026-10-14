/**
 * @file $templateId_.versions.$versionId.tsx
 * @description Full-screen visual studio route for mapping fields on a specific template version.
 * @architecture Studio canvas route rendering PdfMappingWorkspace with templateId and versionId parameters.
 * @agent_note Full viewport mapping studio without default AppShell chrome to maximize canvas area.
 */

import { createFileRoute } from "@tanstack/react-router";
import { PdfMappingWorkspace } from "@/components/templates/mapping/PdfMappingWorkspace";

export const Route = createFileRoute(
  "/_protected/app/templates/$templateId_/versions/$versionId",
)({
  component: TemplateVersionMappingRoute,
});

/**
 * @component TemplateVersionMappingRoute
 * @description Route component mounting the interactive PdfMappingWorkspace studio.
 * @returns {JSX.Element} Full-screen visual mapping studio.
 */
function TemplateVersionMappingRoute() {
  const { templateId, versionId } = Route.useParams();
  return <PdfMappingWorkspace templateId={templateId} versionId={versionId} />;
}
