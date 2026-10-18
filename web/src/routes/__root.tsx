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
 * @state Subscribes to router pathname via useRouterState for analytics and devtools.
 * @api Mounts application-wide UI providers and devtools; no direct API requests.
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

/**
 * @component RootNotFound
 * @description Global 404 Not Found fallback view switching between standalone and embedded AppShell variants.
 * @state Inspects current pathname via useRouterState to determine whether to embed within AppShell.
 * @api Pure client-side UI error boundary fallback.
 */
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

/**
 * @component RootError
 * @description Global error boundary handler displaying general error view in standalone or embedded variant.
 * @state Inspects pathname via useRouterState and receives caught error object with reset retry callback.
 * @api Pure client-side error boundary handler.
 */
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

/**
 * @constant Route
 * @description Root route declaration with TanStack Router context, mounting global error, not found, and provider shell.
 */
export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: RootNotFound,
  errorComponent: RootError,
});
