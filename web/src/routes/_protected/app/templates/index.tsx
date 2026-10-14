/**
 * @file index.tsx
 * @description Template library catalog route under /app/templates.
 * @architecture Route wrapper mounting the TemplateLibrary feature component.
 * @agent_note Direct entry point for viewing, searching, and managing user certificate templates.
 */

import { createFileRoute } from "@tanstack/react-router";
import { TemplateLibrary } from "@/components/templates/TemplateLibrary";

export const Route = createFileRoute("/_protected/app/templates/")({
  component: TemplatesRoute,
});

/**
 * @component TemplatesRoute
 * @description Mounts the TemplateLibrary catalog component.
 * @returns {JSX.Element} Template catalog view.
 */
function TemplatesRoute() {
  return <TemplateLibrary />;
}
