/**
 * @file ExpiryCountdownBadge.tsx
 * @description Real-time countdown badge indicating batch data retention deadline (PRD-CORE-09).
 * @architecture Live status badge embedded into ResultsWorkspace header and volume cards to track data retention time remaining.
 * @agent_note Updates every 30 seconds via setInterval, displaying days/hours remaining or expired status.
 */

import { useState, useEffect, useMemo } from "react";
import { ClockCountdown, WarningCircle } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export interface ExpiryCountdownBadgeProps {
  expiresAt: string | Date | null | undefined;
  className?: string;
  showIcon?: boolean;
}

/**
 * @component ExpiryCountdownBadge
 * @description Badge showing time remaining until batch document and recipient data is permanently pruned.
 * @param {ExpiryCountdownBadgeProps} props - Component properties.
 * @param {string | Date | null | undefined} props.expiresAt - Retention expiry ISO date string or Date object.
 * @param {string} [props.className] - Additional CSS class names.
 * @param {boolean} [props.showIcon=true] - Whether to display clock or alert icons inside the badge.
 * @state {number} now - Timestamp state updated periodically to compute relative time diff.
 * @returns {JSX.Element} Badge displaying time remaining or expired status.
 */
export function ExpiryCountdownBadge({
  expiresAt,
  className,
  showIcon = true,
}: ExpiryCountdownBadgeProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const expiryState = useMemo(() => {
    if (!expiresAt) {
      return {
        label: "Permanent",
        variant: "neutral" as const,
        isExpired: false,
      };
    }

    const expiryMs = new Date(expiresAt).getTime();
    const diffMs = expiryMs - now;

    if (diffMs <= 0) {
      return {
        label: "Expired",
        variant: "error" as const,
        isExpired: true,
      };
    }

    const hours = Math.floor(diffMs / (3600 * 1000));
    const minutes = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
    const days = Math.floor(hours / 24);

    if (hours >= 24) {
      const remainingHours = hours % 24;
      return {
        label: `${days}d ${remainingHours}h remaining`,
        variant: "neutral" as const,
        isExpired: false,
      };
    }

    if (hours > 0) {
      return {
        label: `${hours}h ${minutes}m remaining`,
        variant: "warning" as const,
        isExpired: false,
      };
    }

    return {
      label: `${Math.max(1, minutes)}m remaining`,
      variant: "warning" as const,
      isExpired: false,
    };
  }, [expiresAt, now]);

  return (
    <Badge
      variant={expiryState.variant}
      shape="pill"
      size="sm"
      className={cn(
        "inline-flex items-center gap-1 font-mono tracking-tight",
        className,
      )}
    >
      {showIcon &&
        (expiryState.isExpired ? (
          <WarningCircle size={12} weight="bold" className="shrink-0" />
        ) : expiryState.variant === "warning" ? (
          <ClockCountdown
            size={12}
            weight="bold"
            className="shrink-0 text-amber-600 animate-pulse"
          />
        ) : (
          <ClockCountdown size={12} weight="bold" className="shrink-0" />
        ))}
      <span>{expiryState.label}</span>
    </Badge>
  );
}
