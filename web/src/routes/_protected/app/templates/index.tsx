import { createFileRoute } from "@tanstack/react-router";
import { TemplateLibrary } from "@/components/templates/TemplateLibrary";

export const Route = createFileRoute("/_protected/app/templates/")({
  component: TemplatesRoute,
});

function TemplatesRoute() {
  return <TemplateLibrary />;
}
