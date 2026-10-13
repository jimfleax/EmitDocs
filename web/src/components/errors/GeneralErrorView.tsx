import { ErrorView, type ErrorVariant } from "./ErrorView";

export interface GeneralErrorViewProps {
  error?: unknown;
  reset?: () => void;
  variant?: ErrorVariant;
  title?: string;
  message?: string;
}

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
