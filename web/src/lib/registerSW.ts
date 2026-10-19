/**
 * @file registerSW.ts
 * @description Registers the Service Worker and sets up periodic update polling and update event dispatching.
 * @architecture Client runtime module interfacing with the browser Service Worker API and dispatching update events.
 * @agent_note Registers /sw.js, polls for updates every 60 minutes, and dispatches custom SW_UPDATE_EVENT window events.
 */

export interface SWUpdateEventDetail {
  registration: ServiceWorkerRegistration;
  waitingWorker: ServiceWorker;
}

export const SW_UPDATE_EVENT = "emitdocs:sw-update-available";

let swRegistration: ServiceWorkerRegistration | null = null;
let latestWaitingWorker: ServiceWorker | null = null;
let isUpdateListenerBound = false;

/**
 * Returns the currently waiting ServiceWorker instance, if one exists.
 */
export function getWaitingWorker(): ServiceWorker | null {
  return (
    latestWaitingWorker ||
    (swRegistration?.waiting && navigator.serviceWorker?.controller
      ? swRegistration.waiting
      : null)
  );
}

/**
 * Registers the Service Worker in production/supported environments.
 */
export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  // Allow registration in production or local preview/testing
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      swRegistration = registration;

      // Handle updates found during registration
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            // A new version has been installed and is waiting
            latestWaitingWorker = newWorker;
            window.dispatchEvent(
              new CustomEvent<SWUpdateEventDetail>(SW_UPDATE_EVENT, {
                detail: { registration, waitingWorker: newWorker },
              }),
            );
          }
        });
      });

      // If a worker is already in waiting state on page load
      if (registration.waiting && navigator.serviceWorker.controller) {
        latestWaitingWorker = registration.waiting;
        window.dispatchEvent(
          new CustomEvent<SWUpdateEventDetail>(SW_UPDATE_EVENT, {
            detail: {
              registration,
              waitingWorker: registration.waiting,
            },
          }),
        );
      }

      // Check for updates periodically (e.g., every 60 minutes)
      setInterval(
        () => {
          registration.update().catch((err) => {
            console.warn("SW periodic update check failed:", err);
          });
        },
        60 * 60 * 1000,
      );
    } catch (error) {
      console.warn("Service Worker registration failed:", error);
    }
  });

  // Ensure reloading once the new controller takes over after SKIP_WAITING
  if (!isUpdateListenerBound) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
    isUpdateListenerBound = true;
  }
}

/**
 * Tells the waiting Service Worker to skip waiting and activate immediately.
 */
export function applyServiceWorkerUpdate(
  waitingWorker?: ServiceWorker | null,
): void {
  const worker =
    waitingWorker || latestWaitingWorker || swRegistration?.waiting;
  if (worker) {
    worker.postMessage({ type: "SKIP_WAITING" });
  } else {
    window.location.reload();
  }
}
