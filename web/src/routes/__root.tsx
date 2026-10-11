import { createRootRouteWithContext, Outlet, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { ToastProvider } from '@/components/ui/ToastProvider'

export interface RouterContext {
  auth: {
    session: any | null
    user: any | null
    isPending: boolean
  }
}

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <ToastProvider>
      <Outlet />
      <SpeedInsights route={pathname} />
      <TanStackRouterDevtools />
    </ToastProvider>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})
