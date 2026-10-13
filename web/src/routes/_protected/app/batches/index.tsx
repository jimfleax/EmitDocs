import { createFileRoute } from "@tanstack/react-router";
import { BatchList } from "@/components/batches/BatchList";

export const Route = createFileRoute("/_protected/app/batches/")({
  component: BatchesIndexRoute,
});

function BatchesIndexRoute() {
  return <BatchList />;
}
