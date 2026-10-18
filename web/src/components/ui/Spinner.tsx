/**
 * @file Spinner.tsx
 * @description Circular spinning indicator icon for buttons and inline asynchronous operations.
 * @architecture Micro-loading indicator primitive wrapping Phosphor CircleNotch icon.
 * @agent_note Configured with role="status" and aria-label="Loading" for assistive technologies.
 */

import * as React from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "sm" | "md" | "lg";
  variant?: "default" | "current" | "muted";
}

const sizeMap = {
  sm: 14,
  md: 18,
  lg: 24,
} as const;

const variantMap = {
  default: "text-blue-600",
  current: "text-current",
  muted: "text-slate-400",
} as const;

/**
 * @component Spinner
 * @description Displays a rotating circle notch animation for inline loading states.
 * @param {SpinnerProps} props - Component properties.
 * @param {"sm" | "md" | "lg"} [props.size="md"] - Size preset (sm: 14px, md: 18px, lg: 24px).
 * @param {"default" | "current" | "muted"} [props.variant="default"] - Color preset.
 */
function Spinner({
  size = "md",
  variant = "default",
  className,
  ...props
}: SpinnerProps) {
  const pixelSize = sizeMap[size] || 18;
  const colorClass = variantMap[variant] || "text-blue-600";

  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-flex items-center justify-center shrink-0",
        className,
      )}
      {...props}
    >
      <CircleNotch
        size={pixelSize}
        weight="bold"
        className={cn("animate-spin", colorClass)}
      />
    </span>
  );
}

export { Spinner };
