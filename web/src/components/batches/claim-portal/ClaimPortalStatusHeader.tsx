/**
 * @file ClaimPortalStatusHeader.tsx
 * @description Portal status header bar with status badge, public URL, copy button, and batch link.
 */

import { useState } from "react";
import { Copy, Check, ArrowSquareOut, Globe } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/toast";

export type ClaimPortalStatus =
  | "draft"
  | "ready"
  | "active"
  | "paused"
  | "disabled"
  | "closed"
  | "expired";

export interface ClaimPortalStatusHeaderProps {
  portal: {
    publicSlug: string;
    status: ClaimPortalStatus;
    label: string;
    expiresAt?: string | Date;
  };
  batchName: string;
}

export function ClaimPortalStatusHeader({
  portal,
  batchName,
}: ClaimPortalStatusHeaderProps) {
  const [copied, setCopied] = useState(false);

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/claim/${portal.publicSlug}`
      : `/claim/${portal.publicSlug}`;

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success("Portal link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getStatusBadgeVariant = (status: ClaimPortalStatus) => {
    switch (status) {
      case "active":
        return "success";
      case "ready":
        return "primary";
      case "paused":
        return "warning";
      case "expired":
      case "disabled":
        return "error";
      case "closed":
      case "draft":
      default:
        return "neutral";
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {portal.label || "Certificate Claim Portal"}
          </h2>
          <Badge
            variant={getStatusBadgeVariant(portal.status)}
            size="md"
            shape="pill"
            dot={portal.status === "active"}
            mono
          >
            {portal.status}
          </Badge>
          <span className="text-xs text-slate-400 font-mono">
            Batch: {batchName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/claim/${portal.publicSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer select-none"
          >
            <Globe className="w-3.5 h-3.5 text-blue-500" />
            <span>Open Portal</span>
            {portal.status !== "active" && (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                Inactive
              </span>
            )}
            <ArrowSquareOut className="w-3 h-3 text-slate-400" />
          </a>
        </div>
      </div>

      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0 px-1">
          Public URL:
        </span>
        <code className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate flex-1 select-all">
          {publicUrl}
        </code>
        <button
          type="button"
          onClick={handleCopyLink}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors shrink-0 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-600 font-semibold">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {portal.status !== "active" && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/80 text-xs text-amber-800 dark:text-amber-200">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
          <span>
            {portal.status === "ready"
              ? "Portal is configured but currently inactive. Participants opening this link will see 'Portal Not Yet Active' until you click Activate Portal."
              : `Portal is currently ${portal.status}. Participants cannot claim certificates until it is active.`}
          </span>
        </div>
      )}
    </div>
  );
}
