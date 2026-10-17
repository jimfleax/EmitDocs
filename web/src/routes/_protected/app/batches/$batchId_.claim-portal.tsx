/**
 * @file $batchId_.claim-portal.tsx
 * @description Organizer Claim Portal Workspace route under /app/batches/$batchId/claim-portal.
 */

import { createFileRoute } from "@tanstack/react-router";
import { ClaimPortalWorkspace } from "@/components/batches/claim-portal/ClaimPortalWorkspace";

export const Route = createFileRoute(
  "/_protected/app/batches/$batchId_/claim-portal",
)({
  component: BatchClaimPortalRoute,
});

function BatchClaimPortalRoute() {
  const { batchId } = Route.useParams();
  return <ClaimPortalWorkspace batchId={batchId} />;
}
