import * as React from "react";
import {
  WarningCircle,
  Warning,
  Info,
  CheckCircle,
  X,
  ArrowClockwise,
} from "@phosphor-icons/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative rounded-2xl border p-4 text-sm flex items-start gap-3.5 transition-all shadow-xs",
  {
    variants: {
      variant: {
        error: "bg-rose-50 border-rose-200 text-rose-700",
        warning: "bg-amber-50 border-amber-200 text-amber-800",
        info: "bg-blue-50/70 border-blue-100 text-blue-900",
        success: "bg-emerald-50 border-emerald-200 text-emerald-800",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

const defaultIconMap = {
  error: (
    <WarningCircle
      size={20}
      weight="fill"
      className="text-rose-500 shrink-0 mt-0.5"
    />
  ),
  warning: (
    <Warning
      size={20}
      weight="fill"
      className="text-amber-500 shrink-0 mt-0.5"
    />
  ),
  info: (
    <Info size={20} weight="fill" className="text-blue-500 shrink-0 mt-0.5" />
  ),
  success: (
    <CheckCircle
      size={20}
      weight="fill"
      className="text-emerald-500 shrink-0 mt-0.5"
    />
  ),
};

export interface AlertProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
  icon?: React.ReactNode;
  onRetry?: () => void;
  onDismiss?: () => void;
}

function Alert({
  className,
  variant = "info",
  title,
  icon,
  onRetry,
  onDismiss,
  children,
  ...props
}: AlertProps) {
  const safeVariant = variant || "info";
  const renderedIcon = icon !== undefined ? icon : defaultIconMap[safeVariant];

  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant: safeVariant }), className)}
      {...props}
    >
      {renderedIcon}

      <div className="flex-1 min-w-0">
        {title && (
          <h4 className="font-bold text-sm tracking-tight mb-1">{title}</h4>
        )}
        <div className="text-xs sm:text-sm leading-relaxed opacity-95">
          {children}
        </div>
      </div>

      {(onRetry || onDismiss) && (
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-black/5 transition-colors cursor-pointer select-none"
            >
              <ArrowClockwise size={14} weight="bold" />
              <span>Retry</span>
            </button>
          )}

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="p-1 rounded-lg hover:bg-black/5 transition-colors cursor-pointer select-none opacity-70 hover:opacity-100"
            >
              <X size={16} weight="bold" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// oxlint-disable-next-line react/only-export-components
export { Alert, alertVariants };
