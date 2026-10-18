/**
 * @file _protected.tsx
 * @description Authentication gate layout route guarding all child routes under the /app space.
 * @architecture Layout route executing beforeLoad session verification and redirecting unauthenticated traffic to /sign-in.
 * @agent_note Checks context.auth.session; if missing, throws redirect({ to: "/sign-in" }).
 */

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

/**
 * @component ProtectedLayout
 * @description Layout component rendering the nested child route outlet when authenticated.
 * @state Evaluates session state passed via RouterContext during beforeLoad.
 * @api Validates authentication against Better Auth session state.
 * @returns {JSX.Element} Child route outlet.
 */
function ProtectedLayout() {
  return <Outlet />;
}

/**
 * @constant Route
 * @description Authentication gate layout route guarding all child routes under the /app space.
 */
export const Route = createFileRoute("/_protected")({
  beforeLoad: ({ context }) => {
    if (!context.auth.session) {
      throw redirect({
        to: "/sign-in",
      });
    }
  },
  component: ProtectedLayout,
});
