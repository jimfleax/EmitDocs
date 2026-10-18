/**
 * @file $batchId_.results.tsx
 * @description Batch results & on-demand generation route (PRD-CORE-07).
 * @architecture Route wrapper extracting batchId param and mounting ResultsWorkspace inside AppShell.
 * @agent_note Requires valid batchId param; manages generated certificate downloads and ZIP packaging.
 */

import { createFileRoute } from "@tanstack/react-router";
import { ResultsWorkspace } from "@/components/batches/results/ResultsWorkspace";

/**
 * @constant Route
 * @description Route definition for batch results and downloads at "/app/batches/$batchId/results".
 */
export const Route = createFileRoute(
  "/_protected/app/batches/$batchId_/results",
)({
  component: BatchResultsRoute,
});

/**
 * @component BatchResultsRoute
 * @description Route component mounting the ResultsWorkspace for batch certificate delivery.
 * @state Extracts route parameter `batchId` via Route.useParams().
 * @api Fetches batch artifacts and triggers client-side ZIP packaging via ResultsWorkspace.
 * @returns {JSX.Element} Batch results view.
 */
function BatchResultsRoute() {
  const { batchId } = Route.useParams();
  return <ResultsWorkspace batchId={batchId} />;
}
