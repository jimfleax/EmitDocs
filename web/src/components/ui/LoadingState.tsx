import * as React from "react"
import { InfinityTrack } from "@/components/ui/InfinityTrack"
import { cn } from "@/lib/utils"

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  size?: "page" | "section" | "fullscreen"
}

function LoadingState({
  title = "Loading...",
  description,
  size = "page",
  className,
  ...props
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center text-center gap-3 text-slate-400 select-none",
        size === "page" && "py-24 w-full",
        size === "section" && "py-12 w-full",
        size === "fullscreen" && "min-h-screen h-screen w-full bg-slate-50",
        className
      )}
      {...props}
    >
      <InfinityTrack className="text-blue-600" />
      {title && (
        <span className="text-sm font-medium text-slate-600">
          {title}
        </span>
      )}
      {description && (
        <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
    </div>
  )
}

export { LoadingState }
