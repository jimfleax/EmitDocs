/**
 * @file UpdateBanner.tsx
 * @description Floating toast notification banner alerting the user that a new version of the app is ready to activate.
 * @architecture UI notification component displayed when a new Service Worker update is detected in waiting state.
 * @agent_note Listens to usePwa updateAvailable flag and triggers postMessage SKIP_WAITING on user confirmation.
 */

import { useState } from "react";
import { ArrowClockwise, X } from "@phosphor-icons/react";
import { usePwa } from "../../hooks/usePwa";

/**
 * @component UpdateBanner
 * @description Floating bottom toast prompt notifying users of available service worker cache updates.
 * @returns {JSX.Element | null} Update banner or null when no update is waiting or dismissed.
 */
export function UpdateBanner() {
  const { updateAvailable, applyUpdate } = usePwa();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  if (!updateAvailable || isDismissed) {
    return null;
  }

  const handleUpdate = () => {
    setIsUpdating(true);
    applyUpdate();
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 py-2.5 px-4 bg-slate-900/95 text-white backdrop-blur-md rounded-2xl shadow-2xl border border-white/15 animate-in slide-in-from-bottom-5 duration-200 select-none max-w-[90vw] sm:max-w-md"
    >
      <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
        <ArrowClockwise
          size={16}
          weight="bold"
          className={isUpdating ? "animate-spin" : ""}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white leading-tight">
          New version available
        </p>
        <p className="text-[11px] text-slate-400 leading-tight truncate">
          Reload to apply the latest improvements
        </p>
      </div>

      <button
        type="button"
        onClick={handleUpdate}
        disabled={isUpdating}
        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.97] text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
      >
        {isUpdating ? "Updating..." : "Update Now"}
      </button>

      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        aria-label="Dismiss update notification"
        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  );
}
