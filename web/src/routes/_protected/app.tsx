import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AppShell } from '../../components/layout/AppShell'

export const Route = createFileRoute('/_protected/app')({
  component: AppLayout,
})

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
