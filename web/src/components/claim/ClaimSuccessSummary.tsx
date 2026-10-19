/**
 * @file ClaimSuccessSummary.tsx
 * @description Participant confirmation card with safe event label, participant reference, and retention indicator.
 * @architecture Public claim interface status banner confirming verified credentials and stating automated retention policy.
 * @agent_note Displays verified recipient name and retention expiration deadline without exposing sensitive credential data.
 */

import { CheckCircle, Clock } from "@phosphor-icons/react";

export interface ClaimSuccessSummaryProps {
  eventLabel: string;
  recipientName: string;
  isFirstClaim?: boolean;
  expiresAt?: string | Date;
}

/**
 * @component ClaimSuccessSummary
 * @description Confirmation banner displaying verified claim details and retention timeline.
 * @param {ClaimSuccessSummaryProps} props - Component properties.
 * @param {string} props.eventLabel - Display title of the event or credential portal.
 * @param {string} props.recipientName - Verified recipient display name.
 * @param {boolean} [props.isFirstClaim] - Whether this is the participant's initial claim action.
 * @param {string | Date} [props.expiresAt] - Date when access to the claimed document will expire.
 */
export function ClaimSuccessSummary({
  eventLabel,
  recipientName,
  isFirstClaim: _isFirstClaim,
  expiresAt,
}: ClaimSuccessSummaryProps) {
  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 space-y-3">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 shrink-0 shadow-2xs">
          <CheckCircle className="w-6 h-6" weight="fill" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Certificate Verified
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Issued to{" "}
            <strong className="text-slate-800 dark:text-slate-200">
              {recipientName}
            </strong>{" "}
            for {eventLabel}
          </p>
        </div>
      </div>

      {expiresAt && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1 border-t border-emerald-200/50 dark:border-emerald-900/40">
          <Clock className="w-3.5 h-3.5" />
          <span>
            Available for authorized download until{" "}
            {new Date(expiresAt).toLocaleDateString()}
          </span>
        </div>
      )}
    </div>
  );
}
