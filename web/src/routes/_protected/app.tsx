import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "../../components/layout/AppShell";
import { NotFoundView, GeneralErrorView } from "@/components/errors";

export const Route = createFileRoute("/_protected/app")({
  component: AppLayout,
  notFoundComponent: () => (
    <AppShell>
      <NotFoundView variant="embedded" />
    </AppShell>
  ),
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <GeneralErrorView error={error} reset={reset} variant="embedded" />
    </AppShell>
  ),
});

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
