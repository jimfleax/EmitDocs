/**
 * @file debug.errors.tsx
 * @description Developer playground route for previewing and testing application error boundaries and states.
 * @architecture Development-only route guarded by beforeLoad to throw 404 in non-development environments.
 * @agent_note Allows testing standalone and embedded variants of 404, 500, 403, and offline error screens.
 */

import { useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  NotFoundView,
  GeneralErrorView,
  AccessDeniedView,
  OfflineView,
  type ErrorVariant,
} from "@/components/errors";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/debug/errors")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw notFound();
    }
  },
  component: DebugErrorsPage,
});

/**
 * @component DebugErrorsPage
 * @description Interactive visual workbench for inspecting error views and simulating uncaught exceptions.
 * @returns {JSX.Element} Interactive debug studio.
 */
function DebugErrorsPage() {
  const [activeTab, setActiveTab] = useState<"404" | "500" | "403" | "offline">(
    "404",
  );
  const [variant, setVariant] = useState<ErrorVariant>("standalone");
  const [explode, setExplode] = useState(false);
  const [triggerNotFound, setTriggerNotFound] = useState(false);

  if (explode) {
    throw new Error(
      "This is a simulated uncaught runtime error triggered from the debug playground!",
    );
  }

  if (triggerNotFound) {
    throw notFound();
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Top Debug Bar */}
      <div className="bg-slate-950 border-b border-slate-800 p-4 sticky top-0 z-50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
            Dev Playground
          </span>
          <h1 className="text-sm font-bold text-slate-200">
            Error States Inspector
          </h1>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          {(["404", "500", "403", "offline"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                activeTab === tab
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Variant Selection */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setVariant("standalone")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              variant === "standalone"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Standalone (Full White Canvas)
          </button>
          <button
            type="button"
            onClick={() => setVariant("embedded")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              variant === "embedded"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Embedded (In-App)
          </button>
        </div>

        {/* Crash Triggers */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setExplode(true)}
            variant="destructive"
            className="h-8 text-xs font-semibold rounded-lg cursor-pointer"
          >
            Trigger 500 Crash
          </Button>
          <Button
            size="sm"
            onClick={() => setTriggerNotFound(true)}
            variant="outline"
            className="h-8 text-xs font-semibold rounded-lg border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
          >
            Trigger Router 404
          </Button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 min-h-0 relative">
        {variant === "embedded" ? (
          <div className="p-6 md:p-12 max-w-5xl mx-auto">
            <div className="p-3 mb-4 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
              💡 Previewing how this error displays inside the authenticated{" "}
              <code className="text-blue-300 font-mono">AppShell</code>{" "}
              workspace:
            </div>
            {activeTab === "404" && <NotFoundView variant="embedded" />}
            {activeTab === "500" && (
              <GeneralErrorView
                variant="embedded"
                error={new Error("Simulated Database Connection Failure")}
                reset={() => alert("Reset callback triggered!")}
              />
            )}
            {activeTab === "403" && <AccessDeniedView variant="embedded" />}
            {activeTab === "offline" && (
              <OfflineView
                variant="embedded"
                reset={() => alert("Online check refreshed!")}
              />
            )}
          </div>
        ) : (
          <div>
            {activeTab === "404" && <NotFoundView variant="standalone" />}
            {activeTab === "500" && (
              <GeneralErrorView
                variant="standalone"
                error={
                  new Error(
                    "Simulated Service Unavailable: Status code 503 from worker",
                  )
                }
                reset={() => alert("Reset callback triggered!")}
              />
            )}
            {activeTab === "403" && <AccessDeniedView variant="standalone" />}
            {activeTab === "offline" && (
              <OfflineView
                variant="standalone"
                reset={() => alert("Online check refreshed!")}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
