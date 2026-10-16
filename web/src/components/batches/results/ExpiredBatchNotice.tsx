/**
 * @file ExpiredBatchNotice.tsx
 * @description Notice banner displayed when batch retention deadline has passed and recipient PII has been pruned (PRD-CORE-09).
 */

import { WarningCircle, ShieldCheck, Clock } from "@phosphor-icons/react";
import { Alert } from "@/components/ui/Alert";

export interface ExpiredBatchNoticeProps {
  expiresAt?: string | Date | null;
  totalRecipients?: number;
}

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
