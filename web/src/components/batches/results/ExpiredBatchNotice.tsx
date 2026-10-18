/**
 * @file ExpiredBatchNotice.tsx
 * @description Notice banner displayed when batch retention deadline has passed and recipient PII has been pruned (PRD-CORE-09).
 * @architecture Warning alert rendered within ResultsWorkspace when retention schedule has expired and recipient details are pruned.
 * @agent_note Informs users that recipient records and PII were deleted according to data minimization policy, preserving only aggregate counts.
 */

import { WarningCircle, ShieldCheck, Clock } from "@phosphor-icons/react";
import { Alert } from "@/components/ui/Alert";

export interface ExpiredBatchNoticeProps {
  expiresAt?: string | Date | null;
  totalRecipients?: number;
}

/**
 * @component ExpiredBatchNotice
 * @description Renders a warning alert notifying users that a batch's retention period has lapsed and PII was purged.
 * @param {ExpiredBatchNoticeProps} props - Component properties.
 * @param {string | Date | null} [props.expiresAt] - Retention expiration timestamp.
 * @param {number} [props.totalRecipients] - Total number of processed recipients preserved in aggregate metadata.
 * @returns {JSX.Element} Alert banner with retention details and zero-PII assurance.
 */
export function ExpiredBatchNotice({
  expiresAt,
  totalRecipients,
}: ExpiredBatchNoticeProps) {
  const formattedExpiry = expiresAt
    ? new Date(expiresAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "recently";

  return (
    <Alert
      variant="warning"
      title="Batch Retention Period Expired"
      icon={<WarningCircle size={22} weight="fill" className="text-amber-600 shrink-0 mt-0.5" />}
      className="border-amber-200 bg-amber-50/90 text-amber-900"
    >
      <div className="space-y-2 text-xs sm:text-sm text-amber-800">
        <p>
          This batch reached its retention window on <strong>{formattedExpiry}</strong>. In accordance with EmitDocs data minimization and privacy policies, all recipient records and PII have been permanently pruned from database storage.
        </p>
        <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-amber-900 font-medium">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={16} weight="bold" className="text-emerald-600" />
            <span>Zero PII storage footprint</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={16} weight="bold" className="text-amber-700" />
            <span>Aggregate audit counts &amp; timestamps preserved</span>
          </div>
          {typeof totalRecipients === "number" && (
            <div className="text-amber-700">
              Audit Total: <span className="font-bold">{totalRecipients.toLocaleString()}</span> processed
            </div>
          )}
        </div>
      </div>
    </Alert>
  );
}
