import { createRootRouteWithContext, Outlet, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { SpeedInsights } from '@vercel/speed-insights/react'

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
    <>
      <Outlet />
      <SpeedInsights route={pathname} />
      <TanStackRouterDevtools />
    </>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})
