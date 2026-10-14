/**
 * @file Badge.tsx
 * @description Compact status indicator badge with color variants, pill/rounded shapes, and dot markers.
 * @architecture Base design system badge component configured with class-variance-authority tokens.
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 font-semibold border transition-colors select-none",
  {
    variants: {
      variant: {
        neutral: "bg-slate-100 text-slate-600 border-slate-200",
        primary: "bg-blue-50 text-blue-700 border-blue-200/60",
        success: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
        error: "bg-rose-50 text-rose-700 border-rose-200",
        warning: "bg-amber-50 text-amber-700 border-amber-200",
        glass:
          "bg-white/90 backdrop-blur-xs text-slate-700 border-slate-200/60 shadow-xs",
      },
      shape: {
        pill: "rounded-full",
        rounded: "rounded-md",
      },
      size: {
        sm: "text-[10px] px-2 py-0.5 leading-normal",
        md: "text-xs px-2.5 py-0.5 leading-normal",
      },
    },
    defaultVariants: {
      variant: "neutral",
      shape: "rounded",
      size: "sm",
    },
  },
);

const dotColorMap = {
  neutral: "bg-slate-400",
  primary: "bg-blue-500",
  success: "bg-emerald-500",
  error: "bg-rose-500",
  warning: "bg-amber-500",
  glass: "bg-slate-500",
} as const;

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  mono?: boolean;
}

/**
 * @component Badge
 * @description Displays a compact status tag or count indicator with optional leading dot.
 * @param {BadgeProps} props - Component properties.
 * @param {"neutral" | "primary" | "success" | "error" | "warning" | "glass"} [props.variant="neutral"] - Color theme.
 * @param {"pill" | "rounded"} [props.shape="rounded"] - Border radius shape.
 * @param {"sm" | "md"} [props.size="sm"] - Text and padding size.
 * @param {boolean} [props.dot=false] - Whether to render a colored dot indicator.
 * @param {boolean} [props.mono=false] - Whether to format text with monospaced font.
 */
function Badge({
  className,
  variant = "neutral",
  shape = "rounded",
  size = "sm",
  dot = false,
  mono = false,
  children,
  ...props
}: BadgeProps) {
  const safeVariant = variant || "neutral";

  return (
    <span
      className={cn(
        badgeVariants({ variant: safeVariant, shape, size }),
        mono && "font-mono uppercase",
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            dotColorMap[safeVariant],
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

// oxlint-disable-next-line react/only-export-components
export { Badge, badgeVariants };
