/**
 * @file OfflineIndicator.tsx
 * @description Subtle offline status indicator showing when network connection is lost.
 * @architecture Micro-indicator badge alerting the user that the client is currently in offline mode.
 * @agent_note Tracks usePwa isOnline status and renders an amber pulsing badge when offline.
 */

import { WifiSlash } from "@phosphor-icons/react";
import { usePwa } from "../../hooks/usePwa";

interface OfflineIndicatorProps {
  className?: string;
}

/**
 * @component OfflineIndicator
 * @description Status pill displayed in headers or toolbars when browser network connectivity drops.
 * @param {OfflineIndicatorProps} props - Component properties.
 * @returns {JSX.Element | null} Offline indicator badge or null when connected.
 */
export function OfflineIndicator({ className = "" }: OfflineIndicatorProps) {
  const { isOnline } = usePwa();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30 text-[11px] font-semibold backdrop-blur-md animate-pulse ${className}`}
      title="You are currently offline. Viewing cached application data."
    >
      <WifiSlash size={13} weight="bold" className="shrink-0 text-amber-300" />
      <span className="truncate">Offline Mode</span>
    </div>
  );
}
