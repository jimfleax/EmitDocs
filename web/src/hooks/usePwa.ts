/**
 * @file usePwa.ts
 * @description Hook managing PWA installation prompts, dismiss preference persistence in localStorage, app update detection, and network connectivity state.
 * @architecture Client-side PWA integration hook facilitating offline detection, service worker lifecycle, and install triggers.
 * @agent_note Manages beforeinstallprompt events, listens to SW_UPDATE_EVENT, and exposes promptInstall, dismissInstall, and applyUpdate methods.
 */

import { useState, useEffect, useCallback } from "react";
import { SW_UPDATE_EVENT, type SWUpdateEventDetail, applyServiceWorkerUpdate } from "../lib/registerSW";

const DISMISS_STORAGE_KEY = "emitdocs_pwa_install_dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/**
 * @hook usePwa
 * @description Provides comprehensive PWA installation, update notification, and network status state and handlers.
 * @returns {Object} PWA state indicators and control functions.
 */
export function usePwa() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // Standalone mode detection
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const isIosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    return isStandalone || isIosStandalone;
  });

  // Persistent user dismissal state
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(DISMISS_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  // Online / Offline tracking
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return navigator.onLine;
  });

  // 1. Listen for beforeinstallprompt
  useEffect(() => {
    if (typeof window === "undefined" || isInstalled) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);

      // Only mark installable if user hasn't permanently dismissed it
      try {
        const dismissed = localStorage.getItem(DISMISS_STORAGE_KEY) === "true";
        if (!dismissed) {
          setIsInstallable(true);
        }
      } catch {
        setIsInstallable(true);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [isInstalled]);

  // 2. Listen for Service Worker update event
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleSwUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<SWUpdateEventDetail>;
      if (customEvent.detail?.waitingWorker) {
        setWaitingWorker(customEvent.detail.waitingWorker);
      }
      setUpdateAvailable(true);
    };

    window.addEventListener(SW_UPDATE_EVENT, handleSwUpdate);

    return () => {
      window.removeEventListener(SW_UPDATE_EVENT, handleSwUpdate);
    };
  }, []);

  // 3. Listen for online/offline events
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Action: Trigger browser install dialog
  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return "unavailable";

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setIsInstallable(false);

      if (choice.outcome === "accepted") {
        setIsInstalled(true);
      }
      return choice.outcome;
    } catch (err) {
      console.warn("PWA install prompt failed:", err);
      return "error";
    }
  }, [deferredPrompt]);

  // Action: Dismiss install card & save user preference to localStorage
  const dismissInstall = useCallback(() => {
    setIsDismissed(true);
    setIsInstallable(false);
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, "true");
    } catch (e) {
      console.warn("Failed to save PWA install preference to localStorage:", e);
    }
  }, []);

  // Action: Trigger SW update activation & page reload
  const applyUpdate = useCallback(() => {
    applyServiceWorkerUpdate(waitingWorker);
  }, [waitingWorker]);

  return {
    isInstallable: isInstallable && !isDismissed && !isInstalled,
    isInstalled,
    isDismissed,
    promptInstall,
    dismissInstall,
    updateAvailable,
    applyUpdate,
    isOnline,
  };
}
