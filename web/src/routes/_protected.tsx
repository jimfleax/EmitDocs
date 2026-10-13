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
