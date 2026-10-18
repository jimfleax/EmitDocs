/**
 * @file GeneralErrorView.tsx
 * @description 500 Internal Server Error presentation component.
 * @architecture Pre-configured wrapper around ErrorView for unexpected client/server runtime exceptions.
 * @agent_note Displays exception details and stack traces when running in development mode.
 */

import { ErrorView, type ErrorVariant } from "./ErrorView";

export interface GeneralErrorViewProps {
  error?: unknown;
  reset?: () => void;
  variant?: ErrorVariant;
  title?: string;
  message?: string;
}

/**
 * @component GeneralErrorView
 * @description Displays a 500 Something Went Wrong error screen with retry trigger and error stack trace in dev.
 * @param {GeneralErrorViewProps} props - Component properties.
 */
export function GeneralErrorView({
  error,
  reset,
  variant,
  title = "Something Went Wrong",
  message,
}: GeneralErrorViewProps) {
  return (
    <ErrorView
      type="500"
      variant={variant}
      title={title}
      message={message}
      error={error}
      reset={reset}
    />
  );
}
