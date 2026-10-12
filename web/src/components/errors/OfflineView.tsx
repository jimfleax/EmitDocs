import { ErrorView, type ErrorVariant } from './ErrorView'

export interface OfflineViewProps {
  reset?: () => void
  variant?: ErrorVariant
  title?: string
  message?: string
}

export function OfflineView({
  reset,
  variant,
  title = 'No Internet Connection',
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
  )
}
