/**
 * @file $batchId_.review.tsx
 * @description Batch draft review route for reviewing recipient rows, overriding cells, and issuing certificates.
 * @architecture Route wrapper extracting batchId param and mounting DraftReviewWorkspace.
 * @agent_note Master-detail interface for quality control and batch approval.
 */

import { createFileRoute } from "@tanstack/react-router";
import { DraftReviewWorkspace } from "@/components/batches/DraftReviewWorkspace";

/**
 * @constant Route
 * @description Route definition for the batch draft review studio at "/app/batches/$batchId/review".
 */
export const Route = createFileRoute(
  "/_protected/app/batches/$batchId_/review",
)({
  component: BatchReviewRoute,
});

/**
 * @component BatchReviewRoute
 * @description Route component mounting the master-detail DraftReviewWorkspace review studio.
 * @state Extracts route parameter `batchId` via Route.useParams().
 * @api Fetches recipient records and persists row edits via DraftReviewWorkspace.
 * @returns {JSX.Element} Draft review workspace view.
 */
function BatchReviewRoute() {
  const { batchId } = Route.useParams();
  return <DraftReviewWorkspace batchId={batchId} />;
}
