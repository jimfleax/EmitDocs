/**
 * @file $batchId_.progress.tsx
 * @description Alias route mounting ResultsWorkspace per PRD-CORE-07 specification.
 * @architecture Route wrapper extracting batchId param and mounting ResultsWorkspace inside AppShell.
 * @agent_note Requires valid batchId param; displays real-time generation progress and client-side synthesis.
 */

import { createFileRoute } from "@tanstack/react-router";
import { ResultsWorkspace } from "@/components/batches/results/ResultsWorkspace";

/**
 * @constant Route
 * @description Route definition for batch generation progress at "/app/batches/$batchId/progress".
 */
export const Route = createFileRoute(
  "/_protected/app/batches/$batchId_/progress",
)({
  component: BatchProgressRoute,
});

/**
 * @component BatchProgressRoute
 * @description Route component mounting the ResultsWorkspace for tracking batch generation progress.
 * @state Extracts route parameter `batchId` via Route.useParams().
 * @api Streams generation progress and orchestrates PDF rendering in ResultsWorkspace.
 * @returns {JSX.Element} Batch progress and results view.
 */
function BatchProgressRoute() {
  const { batchId } = Route.useParams();
  return <ResultsWorkspace batchId={batchId} />;
}
