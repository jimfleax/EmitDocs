/**
 * @file retention.tsx
 * @description Retention and data lifecycle settings page (PRD-CORE-09).
 * @architecture Authenticated settings page mounted inside AppShell with PageShell layout.
 * @agent_note Allows users to configure default TTL retention windows and explains zero-storage architecture.
 */

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Database, HardDrives } from "@phosphor-icons/react";
import { PageShell } from "@/components/layout/PageShell";
import { RetentionPresetSelector } from "@/components/batches/approval/RetentionPresetSelector";
import { toast } from "@/components/ui/toast";

/**
 * @constant Route
 * @description Route definition for data retention settings at "/app/settings/retention".
 */
export const Route = createFileRoute("/_protected/app/settings/retention")({
  component: RetentionSettingsPage,
});

const PRESETS = [
  { hours: 24, label: "24 Hours" },
  { hours: 168, label: "7 Days (Default)" },
  { hours: 720, label: "30 Days" },
];

/**
 * @component RetentionSettingsPage
 * @description Configuration screen for default batch retention periods and architectural privacy guarantees.
 * @state Local state and localStorage sync for `defaultHours` (24h, 7d, 30d presets).
 * @api Stores default retention preference in localStorage for subsequent batch creation flows.
 * @returns {JSX.Element} Retention settings interface.
 */
function RetentionSettingsPage() {
  const [defaultHours, setDefaultHours] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("emitdocs_default_retention_hours");
      if (saved && [24, 168, 720].includes(Number(saved))) {
        return Number(saved);
      }
    }
    return 168;
  });

  const handlePresetChange = (hours: number) => {
    setDefaultHours(hours);
    if (typeof window !== "undefined") {
      localStorage.setItem("emitdocs_default_retention_hours", String(hours));
    }
    toast.success("Default Retention Updated", `Default batch retention set to ${hours} hours.`);
  };

  return (
    <PageShell
      title="Retention & Data Lifecycle"
      subtitle="Configure data retention policies, automatic PII pruning, and zero-storage guarantees."
      backTo="/app"
      backLabel="Back to Dashboard"
      maxWidth="5xl"
    >
      <div className="space-y-6 pb-12">
        {/* Preset Selector */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Default Batch Retention Window
          </h2>
          <p className="text-xs text-slate-500">
            Choose the default expiration timeline applied to newly approved issuance batches.
          </p>
          <RetentionPresetSelector
            presets={PRESETS}
            selectedHours={defaultHours}
            onChange={handlePresetChange}
          />
        </div>

        {/* Technical Architecture Guarantees */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Database size={18} weight="bold" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Automated TTL Pruning</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Recipient records are indexed with native MongoDB TTL indexes. The moment a batch expires, recipient PII is irreversibly wiped.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck size={18} weight="bold" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Zero Cloud Storage Leaks</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              PDF certificates are synthesized on-demand in browser client memory via Web Workers. No recipient PDFs ever touch Cloudinary.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <HardDrives size={18} weight="bold" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Preserved Audit History</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Batch summary metadata (name, total count, valid count, issuance dates) is kept for operational auditing while personal data is deleted.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
