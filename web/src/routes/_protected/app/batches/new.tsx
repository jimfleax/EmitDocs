import { createFileRoute } from '@tanstack/react-router'
import { NewBatchForm } from '@/components/batches/NewBatchForm'

export const Route = createFileRoute('/_protected/app/batches/new')({
  component: NewBatchRoute,
})

function NewBatchRoute() {
  return <NewBatchForm />
}
