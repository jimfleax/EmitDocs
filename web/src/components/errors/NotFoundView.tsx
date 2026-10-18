/**
 * @file NotFoundView.tsx
 * @description 404 Not Found error presentation component.
 * @architecture Pre-configured wrapper around ErrorView for non-existent routes, deleted templates, or missing batches.
 * @agent_note Specializes ErrorView for missing route segments, batches, and templates.
 */

import { ErrorView, type ErrorVariant } from "./ErrorView";

export interface NotFoundViewProps {
  variant?: ErrorVariant;
  title?: string;
  message?: string;
}

/**
 * @component NotFoundView
 * @description Displays a 404 Page Not Found card with navigation links back to the dashboard.
 * @param {NotFoundViewProps} props - Component properties.
 */
export function NotFoundView({
  variant,
  title = "Page Not Found",
  message = "The page or template you are looking for doesn't exist, may have been removed, or the link is expired.",
}: NotFoundViewProps) {
  return (
    <ErrorView type="404" variant={variant} title={title} message={message} />
  );
}
