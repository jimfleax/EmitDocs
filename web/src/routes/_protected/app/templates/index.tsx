/**
 * @file index.tsx
 * @description Template library catalog route under /app/templates.
 * @architecture Route wrapper mounting the TemplateLibrary feature component.
 * @agent_note Direct entry point for viewing, searching, and managing user certificate templates.
 */

import { createFileRoute } from "@tanstack/react-router";
import { TemplateLibrary } from "@/components/templates/TemplateLibrary";

/**
 * @constant Route
 * @description Route definition for the template library catalog at "/app/templates/".
 */
export const Route = createFileRoute("/_protected/app/templates/")({
  component: TemplatesRoute,
});

/**
 * @component TemplatesRoute
 * @description Mounts the TemplateLibrary catalog component.
 * @state Delegates library filtering, search, and pagination state to TemplateLibrary.
 * @api Fetches template list and handles template deletion in TemplateLibrary.
 * @returns {JSX.Element} Template catalog view.
 */
function TemplatesRoute() {
  return <TemplateLibrary />;
}
