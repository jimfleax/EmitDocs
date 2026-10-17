/**
 * @file ErrorView.tsx
 * @description Configurable unified error boundary and status view with embedded and standalone layouts.
 * @architecture Handles 404, 500, 403, and offline states with retry actions, routing links, and developer diagnostics drawer.
 * @agent_note When variant is omitted, automatically resolves embedded inside /app and standalone for external routes.
 */

import { useState, useEffect } from "react";
import { Link, useRouter, useLocation } from "@tanstack/react-router";
import {
  House,
  ArrowLeft,
  ArrowClockwise,
  FileDashed,
  WarningOctagon,
  ShieldWarning,
  WifiSlash,
  Copy,
  Check,
  TerminalWindow,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export type ErrorType = "404" | "500" | "403" | "offline" | "generic";
export type ErrorVariant = "standalone" | "embedded";

export interface ErrorViewProps {
  type?: ErrorType;
  variant?: ErrorVariant;
  title?: string;
  message?: string;
  error?: unknown;
  reset?: () => void;
  requestId?: string;
}

const CURRENT_YEAR = new Date().getFullYear();

/**
 * @component ErrorView
 * @description Renders an error presentation card with action buttons and optional developer diagnostics.
 * @param {ErrorViewProps} props - Component properties.
 * @param {ErrorType} [props.type="404"] - Status type (404, 500, 403, offline, generic).
 * @param {ErrorVariant} [props.variant] - Embedded card layout or full-screen standalone layout.
 * @param {string} [props.title] - Custom heading title.
 * @param {string} [props.message] - Custom error explanation.
 * @param {unknown} [props.error] - Underlying exception object or error string.
 * @param {() => void} [props.reset] - Retry handler callback to re-attempt execution.
 * @param {string} [props.requestId] - Correlation request ID for diagnostics.
 * @state Manages clipboard copy feedback and window online/offline listeners.
 */
export function ErrorView({
  type = "404",
  variant,
  title,
  message,
  error,
  reset,
  requestId,
}: ErrorViewProps) {
  const router = useRouter();
  let locationPath = "";
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const location = useLocation();
    locationPath = location.pathname;
  } catch {
    locationPath =
      typeof window !== "undefined" ? window.location.pathname : "";
  }

  // When embedded inside the app workspace (/app) or explicitly requested, do not render external header/footer
  const effectiveVariant: ErrorVariant =
    variant || (locationPath.startsWith("/app") ? "embedded" : "standalone");

  const [copied, setCopied] = useState(false);
  const [reqIdCopied, setReqIdCopied] = useState(false);
  const [, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  const effectiveRequestId =
    requestId ||
    (error as any)?.requestId ||
    (error as any)?.error?.requestId ||
    "";

  const copyRequestId = () => {
    if (!effectiveRequestId) return;
    navigator.clipboard.writeText(effectiveRequestId).then(() => {
      setReqIdCopied(true);
      setTimeout(() => setReqIdCopied(false), 2000);
    });
  };

  // Listen to network changes when in offline state
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (type === "offline" && reset) {
        reset();
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [type, reset]);

  // Extract error details
  const errorDetails = error instanceof Error ? error : null;
  const errorMessage =
    errorDetails?.message || (typeof error === "string" ? error : "");
  const errorStack = errorDetails?.stack || "";
  const isDev = Boolean(import.meta.env.DEV);

  const copyDiagnostics = () => {
    const textToCopy = [
      effectiveRequestId ? `Request ID: ${effectiveRequestId}` : "",
      `Error Type: ${type}`,
      `URL: ${window.location.href}`,
      `Timestamp: ${new Date().toISOString()}`,
      errorMessage ? `Message: ${errorMessage}` : "",
      errorStack ? `Stack Trace:\n${errorStack}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Configuration map per error type (Full White Canvas + Blue Theme, No Tag Bubbles)
  const configs = {
    "404": {
      code: "404",
      defaultTitle: "Lost in the Document Vault?",
      defaultMessage:
        "The page or credential template you're looking for doesn't exist, has been archived, or was moved to another location.",
      icon: FileDashed,
      iconBg: "bg-blue-600 text-white shadow-lg shadow-blue-600/25",
    },
    "500": {
      code: "500",
      defaultTitle: "Something Went Sideways",
      defaultMessage:
        "An unexpected error occurred while processing this request. Our systems have logged the anomaly.",
      icon: WarningOctagon,
      iconBg: "bg-rose-600 text-white shadow-lg shadow-rose-600/25",
    },
    "403": {
      code: "403",
      defaultTitle: "Permission Required",
      defaultMessage:
        "You don't have authorization to view this workspace or resource. Please check your credentials or switch accounts.",
      icon: ShieldWarning,
      iconBg: "bg-amber-500 text-white shadow-lg shadow-amber-500/25",
    },
    offline: {
      code: "OFFLINE",
      defaultTitle: "Connection Interrupted",
      defaultMessage:
        "It looks like you are currently offline. Check your network connection. We will automatically reconnect once available.",
      icon: WifiSlash,
      iconBg: "bg-slate-900 text-white shadow-lg shadow-slate-900/20",
    },
    generic: {
      code: "ERROR",
      defaultTitle: "Unable to Load Page",
      defaultMessage:
        "We encountered an issue loading this section. Please try again or return to the main dashboard.",
      icon: WarningOctagon,
      iconBg: "bg-blue-600 text-white shadow-lg shadow-blue-600/25",
    },
  };

  const currentConfig = configs[type] || configs.generic;
  const finalTitle = title || currentConfig.defaultTitle;
  const finalMessage = message || currentConfig.defaultMessage;
  const IconComponent = currentConfig.icon;

  // Embedded Layout (Clean solid card inside AppShell's workspace - NO separate header)
  if (effectiveVariant === "embedded") {
    return (
      <div className="w-full max-w-2xl mx-auto my-6 p-8 sm:p-12 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col items-center text-center">
        {/* Solid Icon (No tag bubbles) */}
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center ${currentConfig.iconBg}`}
        >
          <IconComponent size={32} weight="bold" />
        </div>

        {/* Headings */}
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-6">
          {finalTitle}
        </h2>
        <p className="text-sm sm:text-base text-slate-600 max-w-md mt-2.5 leading-relaxed font-normal">
          {finalMessage}
        </p>

        {effectiveRequestId && (
          <div className="mt-3.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200/80 text-slate-700 text-xs font-mono">
            <span className="font-semibold text-slate-500">Request ID:</span>
            <span>{effectiveRequestId}</span>
            <button
              type="button"
              onClick={copyRequestId}
              title="Copy Request ID"
              className="ml-1 p-0.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              {reqIdCopied ? (
                <Check size={14} weight="bold" className="text-emerald-600" />
              ) : (
                <Copy size={14} weight="bold" />
              )}
            </button>
          </div>
        )}

        {/* Only Back and Dashboard buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 mt-8">
          <Button
            asChild
            className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            <Link to="/app">
              <House size={16} weight="bold" />
              <span>Dashboard</span>
            </Link>
          </Button>

          {reset ? (
            <Button
              onClick={() => reset()}
              variant="outline"
              size="sm"
              className="h-10 px-5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-semibold text-xs shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <ArrowClockwise size={16} weight="bold" />
              <span>Try Again</span>
            </Button>
          ) : (
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              size="sm"
              className="h-10 px-5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-semibold text-xs shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <ArrowLeft size={16} weight="bold" />
              <span>Go Back</span>
            </Button>
          )}
        </div>

        {/* Developer Diagnostics (Dev only) */}
        {isDev && (errorMessage || errorStack) && (
          <div className="w-full mt-8 pt-6 border-t border-slate-200 text-left">
            <details className="group rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-xs overflow-hidden">
              <summary className="flex items-center justify-between cursor-pointer font-bold text-slate-200 select-none">
                <span className="flex items-center gap-2">
                  <TerminalWindow
                    size={16}
                    weight="bold"
                    className="text-blue-400"
                  />
                  <span>Developer Diagnostics</span>
                </span>
                <span className="text-[10px] font-mono uppercase bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                  DEV MODE
                </span>
              </summary>
              <div className="mt-3.5 space-y-3">
                {errorMessage && (
                  <div>
                    <span className="text-[11px] font-bold text-slate-400">
                      Message:
                    </span>
                    <p className="font-mono text-[11px] text-rose-300 bg-rose-950/60 border border-rose-900/60 p-2 rounded-lg mt-1 break-all">
                      {errorMessage}
                    </p>
                  </div>
                )}
                {errorStack && (
                  <div>
                    <span className="text-[11px] font-bold text-slate-400">
                      Stack Trace:
                    </span>
                    <pre className="font-mono text-[10px] text-slate-300 bg-slate-900 border border-slate-800 p-2.5 rounded-lg overflow-x-auto max-h-48 mt-1 whitespace-pre-wrap">
                      {errorStack}
                    </pre>
                  </div>
                )}
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={copyDiagnostics}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check
                          size={14}
                          weight="bold"
                          className="text-emerald-400"
                        />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} weight="bold" />
                        <span>Copy Diagnostics</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>
    );
  }

  // Standalone Full-Screen Layout (Full White Canvas + Blue Theme, No Tag Bubbles, Only Back & Dashboard)
  return (
    <div className="min-h-screen w-full flex flex-col justify-between p-4 sm:p-6 lg:p-10 bg-white text-slate-900">
      {/* Top Header: Brand Logo only */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between pb-4">
        <Link to="/" className="inline-flex items-center gap-2.5 group">
          <div className="p-1 rounded-xl bg-white border border-slate-200/80 flex-none group-hover:scale-105 transition-transform shadow-2xs">
            <img
              src="/favicon.svg"
              alt="EmitDocs"
              className="w-7 h-7 rounded-lg"
            />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-slate-900">
            Emit<span className="text-blue-600">Docs</span>
          </span>
        </Link>
      </header>

      {/* Center: Full-White Solid Error Card (No Tag Bubbles) */}
      <main className="w-full max-w-xl mx-auto my-auto py-8">
        <div className="p-8 sm:p-12 rounded-[28px] bg-white border border-slate-200/80 shadow-[0_20px_50px_-15px_rgba(15,23,42,0.08)] text-slate-900 flex flex-col items-center text-center">
          {/* Solid Blue/Theme Icon Badge (No tag bubbles) */}
          <div className="mb-2 flex items-center justify-center">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center ${currentConfig.iconBg}`}
            >
              <IconComponent size={32} weight="bold" />
            </div>
          </div>

          {/* Title & Description */}
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-5">
            {finalTitle}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-md mt-2.5 leading-relaxed font-normal">
            {finalMessage}
          </p>

          {effectiveRequestId && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200/80 text-slate-700 text-xs font-mono">
              <span className="font-semibold text-slate-500">Request ID:</span>
              <span>{effectiveRequestId}</span>
              <button
                type="button"
                onClick={copyRequestId}
                title="Copy Request ID"
                className="ml-1 p-0.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                {reqIdCopied ? (
                  <Check size={14} weight="bold" className="text-emerald-600" />
                ) : (
                  <Copy size={14} weight="bold" />
                )}
              </button>
            </div>
          )}

          {/* Action Buttons: Only Dashboard and Back */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 mt-8 w-full max-w-sm">
            <Button
              asChild
              className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition-all active:scale-[0.98] cursor-pointer flex-1 min-w-[140px]"
            >
              <Link to="/app">
                <House size={18} weight="bold" />
                <span>Dashboard</span>
              </Link>
            </Button>

            {reset ? (
              <Button
                onClick={() => reset()}
                variant="outline"
                className="h-11 px-5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm border border-slate-200 shadow-xs transition-all active:scale-[0.98] cursor-pointer flex-1 min-w-[140px]"
              >
                <ArrowClockwise size={18} weight="bold" />
                <span>Try Again</span>
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (window.history.length > 1) {
                    window.history.back();
                  } else {
                    router.navigate({ to: "/" });
                  }
                }}
                variant="outline"
                className="h-11 px-5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm border border-slate-200 shadow-xs transition-all active:scale-[0.98] cursor-pointer flex-1 min-w-[140px]"
              >
                <ArrowLeft size={18} weight="bold" />
                <span>Go Back</span>
              </Button>
            )}
          </div>

          {/* Developer Diagnostics Drawer (Dev only) */}
          {isDev && (errorMessage || errorStack) && (
            <div className="w-full mt-8 text-left">
              <details className="group rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-xs overflow-hidden">
                <summary className="flex items-center justify-between cursor-pointer font-bold text-slate-200 hover:text-white select-none">
                  <span className="flex items-center gap-2">
                    <TerminalWindow
                      size={16}
                      weight="bold"
                      className="text-blue-400"
                    />
                    <span>Developer Diagnostics</span>
                  </span>
                  <span className="text-[10px] font-mono uppercase bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                    DEV MODE
                  </span>
                </summary>
                <div className="mt-3.5 space-y-3">
                  {errorMessage && (
                    <div>
                      <span className="text-[11px] font-bold text-slate-400">
                        Message:
                      </span>
                      <p className="font-mono text-[11px] text-rose-300 bg-rose-950/60 border border-rose-900/60 p-2.5 rounded-lg mt-1 break-all">
                        {errorMessage}
                      </p>
                    </div>
                  )}
                  {errorStack && (
                    <div>
                      <span className="text-[11px] font-bold text-slate-400">
                        Stack Trace:
                      </span>
                      <pre className="font-mono text-[10px] text-slate-300 bg-slate-900 border border-slate-800 p-3 rounded-lg overflow-x-auto max-h-52 mt-1 whitespace-pre-wrap">
                        {errorStack}
                      </pre>
                    </div>
                  )}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={copyDiagnostics}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-all cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check
                            size={14}
                            weight="bold"
                            className="text-emerald-400"
                          />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} weight="bold" />
                          <span>Copy Diagnostics</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-5xl mx-auto text-center text-xs text-slate-400 pt-4">
        © {CURRENT_YEAR} EmitDocs
      </footer>
    </div>
  );
}
