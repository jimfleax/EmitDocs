/**
 * @file ToastProvider.tsx
 * @description Context provider and portal container displaying active floating toast notifications.
 * @architecture Subscribes to the useToast store and renders a fixed stack of SwipeToast instances.
 * @agent_note Mounts in the root application layout to capture all global toast events.
 */

import type { ReactNode } from "react";
import SwipeToast from "./SwipeToast";
import { useToast } from "./toast";

/**
 * @component ToastProvider
 * @description Renders child application elements and mounts a fixed toast container at the bottom-right.
 * @param {Object} props - Component properties.
 * @param {ReactNode} props.children - Application element subtree.
 * @state Subscribes to active toast collection from useToast hook.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { toasts, dismiss } = useToast();

  return (
    <>
      {children}
      <div
        className="fixed right-4 md:right-8 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] md:bottom-[calc(2rem+env(safe-area-inset-bottom,0px))] z-[999999999] flex flex-col items-end gap-2.5 pointer-events-none max-w-[calc(100vw-2rem)] md:max-w-[calc(100vw-4rem)]"
        aria-live="polite"
      >
        {toasts.map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <SwipeToast {...item} inline onClose={() => dismiss(item.id)} />
          </div>
        ))}
      </div>
    </>
  );
}

export default ToastProvider;
