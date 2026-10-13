import { createFileRoute } from "@tanstack/react-router";
import { NewBatchForm } from "@/components/batches/NewBatchForm";

interface NewBatchSearch {
  templateId?: string;
}

export const Route = createFileRoute("/_protected/app/batches/new")({
  validateSearch: (search: Record<string, unknown>): NewBatchSearch => {
    return {
      templateId:
        typeof search.templateId === "string" ? search.templateId : undefined,
    };
  },
  component: NewBatchRoute,
});

function NewBatchRoute() {
  const search = Route.useSearch();
  return <NewBatchForm initialTemplateId={search.templateId} />;
}
