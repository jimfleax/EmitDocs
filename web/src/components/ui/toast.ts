import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { SwipeToastProps } from './SwipeToast';

export interface ToastItem extends Omit<SwipeToastProps, 'open' | 'onClose'> {
  id: string;
}

type ToastListener = (toasts: ToastItem[]) => void;

let activeToasts: ToastItem[] = [];
const listeners = new Set<ToastListener>();

function notify() {
  listeners.forEach((listener) => listener([...activeToasts]));
}

export function dismissToast(id: string) {
  activeToasts = activeToasts.filter((t) => t.id !== id);
  notify();
}

export const toast = (options: Omit<ToastItem, 'id'> | string) => {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const toastData: ToastItem =
    typeof options === 'string'
      ? { id, title: options, variant: 'default' }
      : { id, variant: 'default', ...options };

  activeToasts = [...activeToasts, toastData];
  notify();
  return id;
};

toast.success = (title: ReactNode, description?: ReactNode, options?: Partial<ToastItem>) =>
  toast({ title, description, variant: 'success', ...options });

toast.error = (title: ReactNode, description?: ReactNode, options?: Partial<ToastItem>) =>
  toast({ title, description, variant: 'error', ...options });

toast.warning = (title: ReactNode, description?: ReactNode, options?: Partial<ToastItem>) =>
  toast({ title, description, variant: 'warning', ...options });

toast.info = (title: ReactNode, description?: ReactNode, options?: Partial<ToastItem>) =>
  toast({ title, description, variant: 'info', ...options });

toast.loading = (title: ReactNode, description?: ReactNode, options?: Partial<ToastItem>) =>
  toast({ title, description, variant: 'loading', duration: 0, dismissible: false, ...options });

toast.dismiss = dismissToast;

export function useToast() {
  const [items, setItems] = useState<ToastItem[]>(activeToasts);

  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  return { toasts: items, dismiss: dismissToast, toast };
}
