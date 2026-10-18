/**
 * @file main.tsx
 * @description Client-side application entry point initializing TanStack Router, AuthProvider, and root React DOM.
 * @architecture Top-level bootstrap module wiring routing, global styles, and authentication context into the DOM.
 * @agent_note Instantiates createRouter with routeTree and router context; mounts InnerApp with loading fallbacks.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { AuthProvider, useAuth } from "./lib/auth-context";
import { InfinityTrack } from "./components/ui/InfinityTrack";
import { NotFoundView, GeneralErrorView } from "./components/errors";
import { registerServiceWorker } from "./lib/registerSW";
import "./index.css";

// Register Service Worker for PWA functionality
registerServiceWorker();

/**
 * @constant router
 * @description Root TanStack Router instance configured with the generated route tree and default error/not-found boundaries.
 */
const router = createRouter({
  routeTree,
  trailingSlash: "preserve",
  context: {
    auth: undefined!, // This will be injected by the provider
  },
  defaultNotFoundComponent: () => <NotFoundView />,
  defaultErrorComponent: ({ error, reset }) => (
    <GeneralErrorView error={error} reset={reset} />
  ),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

/**
 * @component InnerApp
 * @description Context bridge mounting RouterProvider once initial authentication hydration is resolved.
 * @state Subscribes to auth state via useAuth() to track pending session resolution.
 * @api Injects authenticated session context into TanStack Router.
 * @returns {JSX.Element} RouterProvider with active auth context, or full-screen loading spinner.
 */
// @ts-ignore
// eslint-disable-next-line react-refresh/only-export-components
function InnerApp() {
  const auth = useAuth();

  if (auth.isPending) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
        <InfinityTrack className="text-[#3b82f6]" />
        <span className="text-sm font-medium text-slate-500 animate-pulse">
          Loading...
        </span>
      </div>
    );
  }

  return <RouterProvider router={router} context={{ auth }} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <InnerApp />
    </AuthProvider>
  </StrictMode>,
);
