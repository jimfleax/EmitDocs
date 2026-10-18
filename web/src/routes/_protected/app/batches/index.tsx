/**
 * @file index.tsx
 * @description Batches catalog index route under /app/batches.
 * @architecture Route wrapper mounting the BatchList management table.
 * @agent_note Primary view for tracking, filtering, and deleting document generation batches.
 */

import { createFileRoute } from "@tanstack/react-router";
import { BatchList } from "@/components/batches/BatchList";

/**
 * @constant Route
 * @description Batches catalog index route under "/app/batches/".
 */
export const Route = createFileRoute("/_protected/app/batches/")({
  component: BatchesIndexRoute,
});

/**
 * @component BatchesIndexRoute
 * @description Route wrapper mounting the BatchList inventory table.
 * @state Manages inventory state, search filters, and pagination via BatchList.
 * @api Fetches batch collections and issues deletion/cancellation requests via BatchList.
 * @returns {JSX.Element} Batches list component.
 */
function BatchesIndexRoute() {
  return <BatchList />;
}
