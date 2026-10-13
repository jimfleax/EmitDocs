import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { AuthProvider, useAuth } from "./lib/auth-context";
import { InfinityTrack } from "./components/ui/InfinityTrack";
import { NotFoundView, GeneralErrorView } from "./components/errors";
import "./index.css";

const router = createRouter({
  routeTree,
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
