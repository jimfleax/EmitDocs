/**
 * @file GenericClaimFailure.tsx
 * @description Enumeration-resistant generic error message with support Request ID.
 * @architecture Public claim interface error boundary component preventing timing and credential enumeration attacks.
 * @agent_note Displays generic error messaging and support correlation request ID without disclosing whether a token exists.
 */

import { WarningCircle, ArrowClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export interface GenericClaimFailureProps {
  requestId?: string;
  message?: string;
  onRetry?: () => void;
}

/**
 * @component GenericClaimFailure
 * @description Displays a safe, non-enumerating error message with optional retry action and support request ID.
 * @param {GenericClaimFailureProps} props - Component properties.
 * @param {string} [props.requestId] - Backend correlation request ID.
 * @param {string} [props.message] - User-facing error message override.
 * @param {() => void} [props.onRetry] - Callback invoked when retry button is clicked.
 */
export function GenericClaimFailure({
  requestId,
  message,
  onRetry,
}: GenericClaimFailureProps) {
  return (
    <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-200 space-y-3">
      <div className="flex items-start gap-2.5">
        <WarningCircle
          className="w-5 h-5 text-rose-600 shrink-0 mt-0.5"
          weight="fill"
        />
        <div className="space-y-1">
          <h4 className="font-bold text-rose-900 dark:text-rose-100">
            Claim Verification Failed
          </h4>
          <p className="leading-relaxed">
            {message ||
              "We couldn't complete this claim. Check the details and try again, or contact the event organizer."}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-rose-200/60 dark:border-rose-900/40">
        {requestId ? (
          <span className="text-[10px] font-mono text-rose-600/80">
            Ref: {requestId}
          </span>
        ) : (
          <span />
        )}

        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="h-7 text-xs gap-1 border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 hover:bg-rose-50 text-rose-700"
          >
            <ArrowClockwise className="w-3 h-3" />
            <span>Try Again</span>
          </Button>
        )}
      </div>
    </div>
  );
}
