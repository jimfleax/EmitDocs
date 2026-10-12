import { createFileRoute } from '@tanstack/react-router';
import { DraftReviewWorkspace } from '@/components/batches/DraftReviewWorkspace';

export const Route = createFileRoute('/_protected/app/batches/$batchId_/review')({
  component: BatchReviewRoute,
});

function BatchReviewRoute() {
  const { batchId } = Route.useParams();
  return <DraftReviewWorkspace batchId={batchId} />;
}
