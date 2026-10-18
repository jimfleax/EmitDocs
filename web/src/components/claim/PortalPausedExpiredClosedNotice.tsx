/**
 * @file PortalPausedExpiredClosedNotice.tsx
 * @description Full-width banner when portal is paused, disabled, closed, or expired.
 */

import { Pause, Lock, Clock, WarningOctagon } from "@phosphor-icons/react";

export interface PortalPausedExpiredClosedNoticeProps {
  status: "draft" | "ready" | "paused" | "disabled" | "closed" | "expired";
  portalLabel?: string;
  expiresAt?: string | Date;
}

export function PortalPausedExpiredClosedNotice({
  status,
  portalLabel,
  expiresAt,
}: PortalPausedExpiredClosedNoticeProps) {
  const getContent = () => {
    switch (status) {
      case "draft":
      case "ready":
        return {
          icon: <Clock className="w-8 h-8 text-blue-500" weight="fill" />,
          title: "Portal Not Yet Active",
          message:
            "This certificate claim portal has been configured but is not yet active. If you are an organizer, log into your EmitDocs dashboard and click 'Activate Portal'. If you are a participant, please check back soon.",
        };
      case "paused":
        return {
          icon: <Pause className="w-8 h-8 text-amber-500" weight="fill" />,
          title: "Portal Temporarily Paused",
          message:
            "The event organizer has paused certificate claims for maintenance or credential update. Please check back shortly.",
        };
      case "closed":
        return {
          icon: <Lock className="w-8 h-8 text-slate-500" weight="fill" />,
          title: "Portal Closed",
          message:
            "This certificate claim portal has been closed by the organizer. No further claims or downloads can be processed.",
        };
      case "expired":
        return {
          icon: <Clock className="w-8 h-8 text-rose-500" weight="fill" />,
          title: "Retention Window Expired",
          message:
            "In accordance with data retention policies, this batch has expired and its credentials and certificates have been pruned.",
        };
      case "disabled":
      default:
        return {
          icon: <WarningOctagon className="w-8 h-8 text-rose-500" weight="fill" />,
          title: "Portal Unavailable",
          message:
            "This portal is currently unavailable. Please contact the event organizer for assistance.",
        };
    }
  };

  const { icon, title, message } = getContent();

  return (
    <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-sm max-w-lg mx-auto">
      <div className="flex justify-center">{icon}</div>
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      {portalLabel && (
        <span className="text-xs font-semibold text-slate-400 block font-mono">
          {portalLabel}
        </span>
      )}
      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        {message}
      </p>
      {expiresAt && status === "expired" && (
        <div className="pt-2 text-[11px] text-slate-400 font-mono">
          Expired on: {new Date(expiresAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
