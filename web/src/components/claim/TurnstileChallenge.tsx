/**
 * @file TurnstileChallenge.tsx
 * @description Cloudflare Turnstile container using window.turnstile or mock fallback for dev/test.
 */

import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "@phosphor-icons/react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement | string, options: any) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

export interface TurnstileChallengeProps {
  siteKey?: string;
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  theme?: "light" | "dark" | "auto";
}

export function TurnstileChallenge({
  siteKey,
  onSuccess,
  onError,
  onExpire,
  theme = "auto",
}: TurnstileChallengeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isSimulated, setIsSimulated] = useState(false);

  useEffect(() => {
    // Development or test environment without real sitekey
    if (!siteKey || siteKey === "mock" || siteKey === "test") {
      setIsSimulated(true);
      const timer = setTimeout(() => {
        onSuccess("mock-turnstile-token-" + Math.random().toString(36).slice(2));
      }, 500);
      return () => clearTimeout(timer);
    }

    // Load Turnstile script if not present
    if (!window.turnstile) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (containerRef.current && window.turnstile) {
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme,
            callback: onSuccess,
            "error-callback": onError,
            "expired-callback": onExpire,
          });
        }
      };
      document.head.appendChild(script);
    } else if (containerRef.current) {
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        callback: onSuccess,
        "error-callback": onError,
        "expired-callback": onExpire,
      });
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [siteKey, theme, onSuccess, onError, onExpire]);

  if (isSimulated) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span>Bot challenge verified (dev mode)</span>
      </div>
    );
  }

  return <div ref={containerRef} className="my-2" />;
}
