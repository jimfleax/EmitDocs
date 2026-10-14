/**
 * @file $batchId_.approve.tsx
 * @description Batch approval route for reviewing preflight metrics, choosing retention, and freezing immutable snapshots (PRD-CORE-06).
 * @architecture Route wrapper extracting batchId param and mounting ApprovalWorkspace.
 */

import { createFileRoute } from "@tanstack/react-router";
import { ApprovalWorkspace } from "@/components/batches/approval/ApprovalWorkspace";

export const Route = createFileRoute(
  "/_protected/app/batches/$batchId_/approve",
)({
  component: BatchApproveRoute,
});

/**
 * @component BatchApproveRoute
 * @description Route component mounting the ApprovalWorkspace.
 * @returns {JSX.Element} Approval workspace view.
 */
function BatchApproveRoute() {
  const { batchId } = Route.useParams();
  return <ApprovalWorkspace batchId={batchId} />;
}
