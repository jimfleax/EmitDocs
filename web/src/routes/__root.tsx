import {
  createRootRouteWithContext,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/AppShell";
import { NotFoundView, GeneralErrorView } from "@/components/errors";

export interface RouterContext {
  auth: {
    session: any | null;
    user: any | null;
    isPending: boolean;
  };
}

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <ToastProvider>
      <TooltipProvider delayDuration={150}>
        <Outlet />
        <SpeedInsights route={pathname} />
        {import.meta.env.DEV && <TanStackRouterDevtools />}
      </TooltipProvider>
    </ToastProvider>
  );
}

function RootNotFound() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.startsWith("/app")) {
    return (
      <AppShell>
        <NotFoundView variant="embedded" />
      </AppShell>
    );
  }
  return <NotFoundView variant="standalone" />;
}

function RootError({ error, reset }: { error: unknown; reset: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.startsWith("/app")) {
    return (
      <AppShell>
        <GeneralErrorView error={error} reset={reset} variant="embedded" />
      </AppShell>
    );
  }
  return <GeneralErrorView error={error} reset={reset} variant="standalone" />;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: RootNotFound,
  errorComponent: RootError,
});
