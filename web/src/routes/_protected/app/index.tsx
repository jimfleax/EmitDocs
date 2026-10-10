import { createFileRoute } from '@tanstack/react-router'


export const Route = createFileRoute('/_protected/app/')({
  component: AppIndexRoute,
})

function AppIndexRoute() {
  return <div><p>Dashboard content goes here.</p></div>
}
