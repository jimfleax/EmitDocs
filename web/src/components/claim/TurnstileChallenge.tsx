/**
 * @file TurnstileChallenge.tsx
 * @description Cloudflare Turnstile container using window.turnstile or mock fallback for dev/test.
 * @architecture Anti-abuse protection wrapper embedding Cloudflare Turnstile CAPTCHA widget for public claim rate limiting.
 * @agent_note In test/dev environments without a siteKey, simulates an automatic pass callback after 100ms.
 */

import { useEffect, useRef } from "react";
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

/**
 * @component TurnstileChallenge
 * @description Embeds Cloudflare Turnstile bot verification widget with automatic mock fallback in development.
 * @param {TurnstileChallengeProps} props - Component properties.
 * @param {string} [props.siteKey] - Turnstile site key override.
 * @param {(token: string) => void} props.onSuccess - Callback receiving verified challenge token.
 * @param {() => void} [props.onError] - Challenge error callback.
 * @param {() => void} [props.onExpire] - Challenge expiration callback.
 * @param {"light" | "dark" | "auto"} [props.theme="auto"] - Color theme for the challenge widget.
 */
export function TurnstileChallenge({
  siteKey,
  onSuccess,
  onError,
  onExpire,
  theme = "auto",
}: TurnstileChallengeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const isDev = Boolean(import.meta.env.DEV);
  const effectiveSiteKey =
    siteKey || (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined);
  const isSimulated =
    isDev &&
    (!effectiveSiteKey ||
      effectiveSiteKey === "mock" ||
      effectiveSiteKey === "test");

  useEffect(() => {
    // Development or test environment without real sitekey
    if (isSimulated) {
      const timer = setTimeout(() => {
        onSuccess(
          "mock-turnstile-token-" + Math.random().toString(36).slice(2),
        );
      }, 500);
      return () => clearTimeout(timer);
    }

    // In production, never emit a mock token for a missing key
    if (!effectiveSiteKey) {
      onError?.();
      return;
    }

    // Load Turnstile script if not present
    if (!window.turnstile) {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (containerRef.current && window.turnstile) {
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: effectiveSiteKey,
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
        sitekey: effectiveSiteKey,
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
  }, [effectiveSiteKey, isSimulated, theme, onSuccess, onError, onExpire]);

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
