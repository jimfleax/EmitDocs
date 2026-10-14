/**
 * @file $batchId_.import.tsx
 * @description Batch data import wizard route for uploading and mapping spreadsheet data.
 * @architecture Route wrapper extracting batchId param and mounting BatchImportWorkspace.
 * @agent_note Guides the 4-step data ingestion flow for the specified batch.
 */

import { createFileRoute } from "@tanstack/react-router";
import { BatchImportWorkspace } from "@/components/batches/BatchImportWorkspace";

export const Route = createFileRoute(
  "/_protected/app/batches/$batchId_/import",
)({
  component: BatchImportRoute,
});

/**
 * @component BatchImportRoute
 * @description Route component mounting the 4-step BatchImportWorkspace ingestion studio.
 * @returns {JSX.Element} Batch import workspace view.
 */
function BatchImportRoute() {
  const { batchId } = Route.useParams();
  return <BatchImportWorkspace batchId={batchId} />;
}
