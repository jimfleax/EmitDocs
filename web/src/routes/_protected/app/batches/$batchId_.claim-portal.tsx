/**
 * @file $batchId_.claim-portal.tsx
 * @description Organizer claim portal workspace route for configuring public claim access, security, and credentials.
 * @architecture Route wrapper extracting batchId param and mounting ClaimPortalWorkspace inside AppShell.
 * @agent_note Requires valid batchId param; manages claim portal settings, toggle states, and public links.
 */

import { createFileRoute } from "@tanstack/react-router";
import { ClaimPortalWorkspace } from "@/components/batches/claim-portal/ClaimPortalWorkspace";

/**
 * @constant Route
 * @description Route definition for organizer claim portal management at "/app/batches/$batchId/claim-portal".
 */
export const Route = createFileRoute(
  "/_protected/app/batches/$batchId_/claim-portal",
)({
  component: BatchClaimPortalRoute,
});

/**
 * @component BatchClaimPortalRoute
 * @description Route component mounting the ClaimPortalWorkspace for a specific batch.
 * @state Extracts route parameter `batchId` via Route.useParams().
 * @api Fetches and updates claim portal configuration via ClaimPortalWorkspace.
 * @returns {JSX.Element} Claim portal workspace view.
 */
function BatchClaimPortalRoute() {
  const { batchId } = Route.useParams();
  return <ClaimPortalWorkspace batchId={batchId} />;
}
