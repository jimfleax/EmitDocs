/**
 * @file EmptyState.tsx
 * @description Zero-data placeholder container with centered icon, message, and call-to-action button slot.
 * @architecture Reusable presentation component displayed when collections (templates, batches, drafts) are empty.
 * @agent_note Supports dashed and solid border styling with customizable icon and call-to-action slots.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "dashed" | "solid";
  size?: "default" | "compact";
}

/**
 * @component EmptyState
 * @description Renders a placeholder card with an illustrative icon, title, description, and action button.
 * @param {EmptyStateProps} props - Component properties.
 * @param {React.ReactNode} props.icon - Primary illustration or icon element.
 * @param {string} props.title - Primary empty state title.
 * @param {string} [props.description] - Explanatory helper text.
 * @param {React.ReactNode} [props.action] - Optional CTA button or action element.
 * @param {"dashed" | "solid"} [props.variant="dashed"] - Border styling.
 * @param {"default" | "compact"} [props.size="default"] - Card padding size.
 */
function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "dashed",
  size = "default",
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-2xl flex flex-col items-center justify-center text-center select-none transition-all",
        variant === "dashed" &&
          "border border-dashed border-slate-200 bg-slate-50/50",
        variant === "solid" && "border border-slate-200 bg-slate-50/80",
        size === "default" && "p-10 sm:p-12 space-y-3.5",
        size === "compact" && "p-6 sm:p-8 space-y-2.5",
        className,
      )}
      {...props}
    >
      <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mb-0.5">
        {icon}
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-bold text-slate-900 tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {action && (
        <div className="pt-1.5 flex items-center justify-center">{action}</div>
      )}
    </div>
  );
}

export { EmptyState };
