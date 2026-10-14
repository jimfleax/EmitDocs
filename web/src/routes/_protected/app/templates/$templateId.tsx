/**
 * @file $templateId.tsx
 * @description Template details route displaying versions, metadata, and quick action buttons for a single template.
 * @architecture Parameterized route extracting templateId and mounting TemplateDetails.
 * @agent_note Resolves route param templateId and delegates rendering to TemplateDetails.
 */

import { createFileRoute } from "@tanstack/react-router";
import { TemplateDetails } from "@/components/templates/TemplateDetails";

export const Route = createFileRoute("/_protected/app/templates/$templateId")({
  component: TemplateDetailRoute,
});

/**
 * @component TemplateDetailRoute
 * @description Route component rendering TemplateDetails for the active route parameter templateId.
 * @returns {JSX.Element} Template details view.
 */
function TemplateDetailRoute() {
  const { templateId } = Route.useParams();
  return <TemplateDetails templateId={templateId} />;
}
