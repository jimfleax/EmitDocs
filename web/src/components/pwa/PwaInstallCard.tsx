/**
 * @file PwaInstallCard.tsx
 * @description Shortened install prompt card for the dashboard right column.
 * @architecture UI card component prompting users to install the web application as a standalone PWA.
 * @agent_note Displays install CTA when beforeinstallprompt event is caught and user hasn't dismissed it.
 */

import { useState } from "react";
import { DownloadSimple, X } from "@phosphor-icons/react";
import { usePwa } from "../../hooks/usePwa";

/**
 * @component PwaInstallCard
 * @description Compact installation promotion card offering 1-click native desktop/mobile installation.
 * @returns {JSX.Element | null} Installation card or null if not installable or previously dismissed.
 */
export function PwaInstallCard() {
  const { isInstallable, promptInstall, dismissInstall } = usePwa();
  const [isInstalling, setIsInstalling] = useState(false);

  if (!isInstallable) {
    return null;
  }

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      await promptInstall();
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="relative rounded-2xl bg-slate-50/90 border border-slate-100 p-3.5 sm:p-4 space-y-2.5 transition-all shadow-2xs animate-in fade-in duration-200">
      {/* Dismiss button with localStorage persistence */}
      <button
        type="button"
        onClick={dismissInstall}
        title="Dismiss install prompt"
        aria-label="Dismiss install prompt"
        className="absolute top-2.5 right-2.5 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer select-none"
      >
        <X size={14} weight="bold" />
      </button>

      {/* Header with icon and title */}
      <div className="flex items-center gap-2.5 pr-6">
        <div className="w-8 h-8 rounded-lg bg-blue-100/70 text-blue-600 flex items-center justify-center shrink-0">
          <DownloadSimple size={18} weight="duotone" />
        </div>
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-slate-900 leading-tight">
            Install EmitDocs App
          </h3>
          <p className="text-[11px] text-slate-500 leading-tight mt-0.5 truncate">
            Fast, offline-ready desktop & mobile app
          </p>
        </div>
      </div>

      {/* Action button */}
      <button
        type="button"
        onClick={handleInstall}
        disabled={isInstalling}
        className="w-full py-1.5 px-3 rounded-lg bg-slate-950 hover:bg-slate-900 active:scale-[0.98] text-white font-semibold text-xs tracking-wide text-center transition-all shadow-2xs cursor-pointer select-none flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        <span>{isInstalling ? "INSTALLING..." : "INSTALL APP"}</span>
      </button>
    </div>
  );
}
