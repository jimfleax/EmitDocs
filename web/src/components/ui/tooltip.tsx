import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const TooltipRoot = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md border border-slate-200/90 bg-white/95 px-2.5 py-1 text-xs font-medium text-slate-800 shadow-md backdrop-blur-xs select-none animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-1.5 data-[side=left]:slide-in-from-right-1.5 data-[side=right]:slide-in-from-left-1.5 data-[side=top]:slide-in-from-bottom-1.5 origin-[--radix-tooltip-content-transform-origin]",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export interface TooltipProps extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root> {
  content?: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  sideOffset?: number
  contentClassName?: string
  asChild?: boolean
}

const Tooltip = ({
  content,
  children,
  side = "top",
  align = "center",
  sideOffset = 4,
  contentClassName,
  asChild = true,
  delayDuration = 200,
  ...props
}: TooltipProps) => {
  if (!content) {
    return (
      <TooltipPrimitive.Root delayDuration={delayDuration} {...props}>
        {children}
      </TooltipPrimitive.Root>
    )
  }

  let triggerChild = children
  if (React.isValidElement(children) && (children.props as any)?.disabled) {
    triggerChild = <span className="inline-flex shrink-0">{children}</span>
  }

  return (
    <TooltipPrimitive.Root delayDuration={delayDuration} {...props}>
      <TooltipPrimitive.Trigger asChild={asChild}>
        {triggerChild}
      </TooltipPrimitive.Trigger>
      <TooltipContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={contentClassName}
      >
        {content}
      </TooltipContent>
    </TooltipPrimitive.Root>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipRoot }
