/**
 * @file toast.ts
 * @description Toast notification dispatching system and event subscriber hook.
 * @architecture Global imperative toast service paired with useToast for headless toast state management.
 * @agent_note Use toast.success(), toast.error(), etc. anywhere in the app to trigger feedback notifications.
 */

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { SwipeToastProps } from "./SwipeToast";

export interface ToastItem extends Omit<SwipeToastProps, "open" | "onClose"> {
  id: string;
}

type ToastListener = (toasts: ToastItem[]) => void;

let activeToasts: ToastItem[] = [];
const listeners = new Set<ToastListener>();

function notify() {
  listeners.forEach((listener) => listener([...activeToasts]));
}

/**
 * @function dismissToast
 * @description Dismisses an active toast notification by ID.
 * @param {string} id - Unique identifier of the toast to remove.
 */
export function dismissToast(id: string) {
  activeToasts = activeToasts.filter((t) => t.id !== id);
  notify();
}

/**
 * @function clearToasts
 * @description Clears all active toast notifications.
 */
export function clearToasts() {
  activeToasts = [];
  notify();
}

/**
 * @function subscribeToasts
 * @description Subscribes an external listener to active toast changes.
 * @param {ToastListener} listener - Callback invoked with cloned toast items.
 * @returns {() => void} Unsubscribe function.
 */
export function subscribeToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * @function getActiveToasts
 * @description Returns current snapshot of active toast notifications.
 * @returns {ToastItem[]} Copy of active toasts.
 */
export function getActiveToasts(): ToastItem[] {
  return [...activeToasts];
}

/**
 * @function toast
 * @description Triggers a toast notification with the given options or title message.
 * @param {Omit<ToastItem, "id"> | string} options - Toast message text or full configuration object.
 * @returns {string} Unique toast ID for programmatic dismissal.
 */
export const toast = (options: Omit<ToastItem, "id"> | string) => {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const toastData: ToastItem =
    typeof options === "string"
      ? { id, title: options, variant: "default" }
      : { id, variant: "default", ...options };

  activeToasts = [...activeToasts, toastData];
  notify();
  return id;
};

toast.success = (
  title: ReactNode,
  description?: ReactNode,
  options?: Partial<ToastItem>,
) => toast({ title, description, variant: "success", ...options });

toast.error = (
  title: ReactNode,
  description?: ReactNode,
  options?: Partial<ToastItem>,
) => toast({ title, description, variant: "error", ...options });

toast.warning = (
  title: ReactNode,
  description?: ReactNode,
  options?: Partial<ToastItem>,
) => toast({ title, description, variant: "warning", ...options });

toast.info = (
  title: ReactNode,
  description?: ReactNode,
  options?: Partial<ToastItem>,
) => toast({ title, description, variant: "info", ...options });

toast.loading = (
  title: ReactNode,
  description?: ReactNode,
  options?: Partial<ToastItem>,
) =>
  toast({
    title,
    description,
    variant: "loading",
    duration: 0,
    dismissible: false,
    ...options,
  });

toast.dismiss = dismissToast;
toast.clear = clearToasts;
toast.subscribe = subscribeToasts;
toast.getActive = getActiveToasts;

/**
 * @hook useToast
 * @description Subscribes to active toast notifications and provides dismiss/toast actions.
 * @returns {{ toasts: ToastItem[], dismiss: (id: string) => void, toast: typeof toast }} Toast state and control functions.
 * @sideeffects Registers and unregisters listener callback on active toasts store.
 */
export function useToast() {
  const [items, setItems] = useState<ToastItem[]>(activeToasts);

  useEffect(() => {
    return subscribeToasts(setItems);
  }, []);

  return { toasts: items, dismiss: dismissToast, toast };
}
