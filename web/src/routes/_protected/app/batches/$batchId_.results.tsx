/**
 * @file $batchId_.results.tsx
 * @description Batch results & on-demand generation route (PRD-CORE-07).
 */

import { createFileRoute } from "@tanstack/react-router";
import { ResultsWorkspace } from "@/components/batches/results/ResultsWorkspace";

export const Route = createFileRoute(
  "/_protected/app/batches/$batchId_/results",
)({
  component: BatchResultsRoute,
});

function BatchResultsRoute() {
  const { batchId } = Route.useParams();
  return <ResultsWorkspace batchId={batchId} />;
}
