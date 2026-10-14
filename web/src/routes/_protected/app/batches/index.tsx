/**
 * @file index.tsx
 * @description Batches catalog index route under /app/batches.
 * @architecture Route wrapper mounting the BatchList management table.
 * @agent_note Primary view for tracking, filtering, and deleting document generation batches.
 */

import { createFileRoute } from "@tanstack/react-router";
import { BatchList } from "@/components/batches/BatchList";

export const Route = createFileRoute("/_protected/app/batches/")({
  component: BatchesIndexRoute,
});

/**
 * @component BatchesIndexRoute
 * @description Route wrapper mounting the BatchList inventory table.
 * @returns {JSX.Element} Batches list component.
 */
function BatchesIndexRoute() {
  return <BatchList />;
}
