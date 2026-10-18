/**
 * @file AccessDeniedView.tsx
 * @description 403 Forbidden error presentation component.
 * @architecture Pre-configured wrapper around ErrorView for permission denial and expired auth sessions.
 * @agent_note Specializes ErrorView for 403 authorization failures with switch-account guidance.
 */

import { ErrorView, type ErrorVariant } from "./ErrorView";

export interface AccessDeniedViewProps {
  variant?: ErrorVariant;
  title?: string;
  message?: string;
}

/**
 * @component AccessDeniedView
 * @description Displays a 403 Access Restricted view with instructions to switch accounts or check permissions.
 * @param {AccessDeniedViewProps} props - Component properties.
 */
export function AccessDeniedView({
  variant,
  title = "Access Restricted",
  message = "You do not have sufficient permissions to view this resource, or your session has timed out.",
}: AccessDeniedViewProps) {
  return (
    <ErrorView type="403" variant={variant} title={title} message={message} />
  );
}
