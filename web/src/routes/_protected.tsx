/**
 * @file _protected.tsx
 * @description Authentication gate layout route guarding all child routes under the /app space.
 * @architecture Layout route executing beforeLoad session verification and redirecting unauthenticated traffic to /sign-in.
 * @agent_note Checks context.auth.session; if missing, throws redirect({ to: "/sign-in" }).
 */

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected")({
  beforeLoad: ({ context }) => {
    if (!context.auth.session) {
      throw redirect({
        to: "/sign-in",
      });
    }
  },
  component: () => <Outlet />,
});
