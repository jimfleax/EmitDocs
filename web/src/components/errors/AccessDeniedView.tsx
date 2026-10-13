import { ErrorView, type ErrorVariant } from "./ErrorView";

export interface AccessDeniedViewProps {
  variant?: ErrorVariant;
  title?: string;
  message?: string;
}

export function AccessDeniedView({
  variant,
  title = "Access Restricted",
  message = "You do not have sufficient permissions to view this resource, or your session has timed out.",
}: AccessDeniedViewProps) {
  return (
    <ErrorView type="403" variant={variant} title={title} message={message} />
  );
}
