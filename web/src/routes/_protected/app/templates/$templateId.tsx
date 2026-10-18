/**
 * @file $templateId.tsx
 * @description Template details route displaying versions, metadata, and quick action buttons for a single template.
 * @architecture Parameterized route extracting templateId and mounting TemplateDetails.
 * @agent_note Resolves route param templateId and delegates rendering to TemplateDetails.
 */

import { createFileRoute } from "@tanstack/react-router";
import { TemplateDetails } from "@/components/templates/TemplateDetails";

/**
 * @constant Route
 * @description Parameterized route definition for template details at "/app/templates/$templateId".
 */
export const Route = createFileRoute("/_protected/app/templates/$templateId")({
  component: TemplateDetailRoute,
});

/**
 * @component TemplateDetailRoute
 * @description Route component rendering TemplateDetails for the active route parameter templateId.
 * @state Extracts route parameter `templateId` via Route.useParams().
 * @api Fetches template metadata, version history, and handles deletion in TemplateDetails.
 * @returns {JSX.Element} Template details view.
 */
function TemplateDetailRoute() {
  const { templateId } = Route.useParams();
  return <TemplateDetails templateId={templateId} />;
}
