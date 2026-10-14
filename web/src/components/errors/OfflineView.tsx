/**
 * @file OfflineView.tsx
 * @description Network disconnection presentation component with auto-reconnection listeners.
 * @architecture Pre-configured wrapper around ErrorView displayed when navigator.onLine is false.
 */

import { ErrorView, type ErrorVariant } from "./ErrorView";

export interface OfflineViewProps {
  reset?: () => void;
  variant?: ErrorVariant;
  title?: string;
  message?: string;
}

/**
 * @component OfflineView
 * @description Displays an offline notice that auto-retries when the browser re-establishes internet connectivity.
 * @param {OfflineViewProps} props - Component properties.
 */
export function OfflineView({
  reset,
  variant,
  title = "No Internet Connection",
  message = "Your device is currently disconnected from the network. Check your Wi-Fi or mobile data connection.",
}: OfflineViewProps) {
  return (
    <ErrorView
      type="offline"
      variant={variant}
      title={title}
      message={message}
      reset={reset}
    />
  );
}
