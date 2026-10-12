import { createFileRoute } from '@tanstack/react-router';
import { BatchImportWorkspace } from '@/components/batches/BatchImportWorkspace';

export const Route = createFileRoute('/_protected/app/batches/$batchId_/import')({
  component: BatchImportRoute,
});

function BatchImportRoute() {
  const { batchId } = Route.useParams();
  return <BatchImportWorkspace batchId={batchId} />;
}
