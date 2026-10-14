/**
 * @file __root.tsx
 * @description Top-level root layout route configuring providers, global error/not-found boundaries, and dev tools.
 * @architecture Root route component providing ToastProvider, TooltipProvider, and root context for TanStack Router.
 * @agent_note Encloses RouterContext for auth state, renders embedded vs standalone error views based on /app path prefix.
 */

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
import { UpdateBanner } from "@/components/pwa";

export interface RouterContext {
  auth: {
    session: any | null;
    user: any | null;
    isPending: boolean;
  };
}

/**
 * @component RootComponent
 * @description Root application shell providing global providers and mounting active child routes.
 * @returns {JSX.Element} Configured root layout with dev tools in development.
 */
function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <ToastProvider>
      <TooltipProvider delayDuration={150}>
        <Outlet />
        <UpdateBanner />
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
