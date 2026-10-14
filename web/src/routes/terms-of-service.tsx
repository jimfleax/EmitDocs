/**
 * @file terms-of-service.tsx
 * @description Alias route definition for the canonical Terms of Service document.
 * @architecture Route alias providing canonical URL mapping for /terms-of-service.
 * @agent_note Renders TermsPage component directly from ./terms.
 */

import { createFileRoute } from "@tanstack/react-router";
import { TermsPage } from "./terms";

export const Route = createFileRoute("/terms-of-service")({
  component: TermsPage,
});

