/**
 * @file privacy-policy.tsx
 * @description Alias redirect and route definition pointing to the canonical Privacy Policy page.
 * @architecture Route alias for backwards compatibility and standard URL conventions.
 * @agent_note Renders PrivacyPage component directly from ./privacy.
 */

import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPage } from "./privacy";

/**
 * @constant Route
 * @description Route alias configuration mapping "/privacy-policy" directly to PrivacyPage.
 */
export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPage,
});
