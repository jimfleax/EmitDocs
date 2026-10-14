/**
 * @file app.tsx
 * @description Main application shell layout route wrapping authenticated app features with navigation and error boundaries.
 * @architecture Layout route providing navigation sidebar, top header, and embedded error/not-found boundaries.
 * @agent_note Encloses nested routes inside AppShell and defines embedded notFoundComponent and errorComponent handlers.
 */

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

/**
 * @component AppLayout
 * @description App layout container wrapping active child route outlets with the responsive AppShell.
 * @returns {JSX.Element} Authenticated shell layout.
 */
function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
