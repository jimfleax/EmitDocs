/**
 * @file $batchId_.approve.tsx
 * @description Batch approval route for reviewing preflight metrics, choosing retention, and freezing immutable snapshots (PRD-CORE-06).
 * @architecture Route wrapper extracting batchId param and mounting ApprovalWorkspace.
 * @agent_note Requires valid batchId param; preflights batch verification before triggering immutable snapshot creation.
 */

import { createFileRoute } from "@tanstack/react-router";
import { ApprovalWorkspace } from "@/components/batches/approval/ApprovalWorkspace";

/**
 * @constant Route
 * @description Route definition for batch approval at "/app/batches/$batchId/approve".
 */
export const Route = createFileRoute(
  "/_protected/app/batches/$batchId_/approve",
)({
  component: BatchApproveRoute,
});

/**
 * @component BatchApproveRoute
 * @description Route component mounting the ApprovalWorkspace.
 * @state Extracts route parameter `batchId` via Route.useParams().
 * @api Executes batch approval and snapshot freezing mutations in ApprovalWorkspace.
 * @returns {JSX.Element} Approval workspace view.
 */
function BatchApproveRoute() {
  const { batchId } = Route.useParams();
  return <ApprovalWorkspace batchId={batchId} />;
}
