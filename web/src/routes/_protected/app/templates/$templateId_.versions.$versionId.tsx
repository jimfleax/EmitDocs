/**
 * @file $templateId_.versions.$versionId.tsx
 * @description Full-screen visual studio route for mapping fields on a specific template version.
 * @architecture Studio canvas route rendering PdfMappingWorkspace with templateId and versionId parameters.
 * @agent_note Studio canvas route rendered inside the parent AppShell layout.
 */

import { createFileRoute } from "@tanstack/react-router";
import { PdfMappingWorkspace } from "@/components/templates/mapping/PdfMappingWorkspace";

/**
 * @constant Route
 * @description Route definition for the visual field mapping studio at "/app/templates/$templateId/versions/$versionId".
 */
export const Route = createFileRoute(
  "/_protected/app/templates/$templateId_/versions/$versionId",
)({
  component: TemplateVersionMappingRoute,
});

/**
 * @component TemplateVersionMappingRoute
 * @description Route component mounting the interactive PdfMappingWorkspace studio.
 * @state Extracts route parameters `templateId` and `versionId` via Route.useParams().
 * @api Fetches template version layout and saves field mappings in PdfMappingWorkspace.
 * @returns {JSX.Element} Full-screen visual mapping studio.
 */
function TemplateVersionMappingRoute() {
  const { templateId, versionId } = Route.useParams();
  return <PdfMappingWorkspace templateId={templateId} versionId={versionId} />;
}
