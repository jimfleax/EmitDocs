/**
 * @file new.tsx
 * @description Batch creation route for configuring new batches from templates.
 * @architecture Route wrapper parsing optional templateId query param and mounting NewBatchForm.
 * @agent_note Validates search query param `templateId` and supplies it as initialTemplateId prop.
 */

import { createFileRoute } from "@tanstack/react-router";
import { NewBatchForm } from "@/components/batches/NewBatchForm";

interface NewBatchSearch {
  templateId?: string;
}

/**
 * @constant Route
 * @description Batch creation route for configuring new batches from templates with search query validation.
 */
export const Route = createFileRoute("/_protected/app/batches/new")({
  validateSearch: (search: Record<string, unknown>): NewBatchSearch => {
    return {
      templateId:
        typeof search.templateId === "string" ? search.templateId : undefined,
    };
  },
  component: NewBatchRoute,
});

/**
 * @component NewBatchRoute
 * @description Route component rendering the NewBatchForm wizard with optional preselected template.
 * @state Extracts optional `templateId` query param via Route.useSearch().
 * @api Template selection and batch initialization mutations handled within NewBatchForm.
 * @returns {JSX.Element} Batch initiation form.
 */
function NewBatchRoute() {
  const search = Route.useSearch();
  return <NewBatchForm initialTemplateId={search.templateId} />;
}
