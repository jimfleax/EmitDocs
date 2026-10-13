import { createFileRoute } from "@tanstack/react-router";
import { TemplateDetails } from "@/components/templates/TemplateDetails";

export const Route = createFileRoute("/_protected/app/templates/$templateId")({
  component: TemplateDetailRoute,
});

function TemplateDetailRoute() {
  const { templateId } = Route.useParams();
  return <TemplateDetails templateId={templateId} />;
}
