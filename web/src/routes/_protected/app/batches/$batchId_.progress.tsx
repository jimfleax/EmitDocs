/**
 * @file $batchId_.progress.tsx
 * @description Alias route mounting ResultsWorkspace per PRD-CORE-07 specification.
 */

import { createFileRoute } from "@tanstack/react-router";
import { ResultsWorkspace } from "@/components/batches/results/ResultsWorkspace";

export const Route = createFileRoute(
  "/_protected/app/batches/$batchId_/progress",
)({
  component: BatchProgressRoute,
});

function BatchProgressRoute() {
  const { batchId } = Route.useParams();
  return <ResultsWorkspace batchId={batchId} />;
}
