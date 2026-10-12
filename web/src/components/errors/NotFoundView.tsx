import { ErrorView, type ErrorVariant } from './ErrorView'

export interface NotFoundViewProps {
  variant?: ErrorVariant
  title?: string
  message?: string
}

export function NotFoundView({
  variant,
  title = 'Page Not Found',
  message = "The page or template you are looking for doesn't exist, may have been removed, or the link is expired.",
}: NotFoundViewProps) {
  return (
    <ErrorView
      type="404"
      variant={variant}
      title={title}
      message={message}
    />
  )
}
