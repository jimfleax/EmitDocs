/**
 * @file RetentionPresetSelector.tsx
 * @description Radio preset picker allowing user to choose retention period (24h, 7d, 30d) before document cleanup.
 */

import { Clock, ShieldCheck } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface RetentionPreset {
  hours: number;
  label: string;
}

interface RetentionPresetSelectorProps {
  presets: RetentionPreset[];
  selectedHours: number;
  onChange: (hours: number) => void;
  disabled?: boolean;
}

export function RetentionPresetSelector({
  presets,
  selectedHours,
  onChange,
  disabled = false,
}: RetentionPresetSelectorProps) {
  const descriptions: Record<number, string> = {
    24: "Quick turnaround. Storage purged 24 hours after completion.",
    168: "Standard issuance. Files retained for 7 days before automated cleanup.",
    720: "Extended audit. Files retained for 30 days before automated cleanup.",
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Retention & Lifecycle Policy
          </h3>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Zero PII Leakage Guarantee</span>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        Once document generation is completed, batch outputs and recipient data expire strictly after the selected window.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {presets.map((preset) => {
          const isSelected = selectedHours === preset.hours;
          return (
            <button
              key={preset.hours}
              type="button"
              disabled={disabled}
              onClick={() => onChange(preset.hours)}
              className={cn(
                "p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between",
                disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-slate-300 dark:hover:border-slate-700",
                isSelected
                  ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40"
              )}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "text-sm font-bold",
                      isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-slate-200"
                    )}
                  >
                    {preset.label}
                  </span>
                  <div
                    className={cn(
                      "w-3.5 h-3.5 rounded-full border flex items-center justify-center",
                      isSelected
                        ? "border-indigo-600 dark:border-indigo-400 bg-indigo-600 dark:bg-indigo-400"
                        : "border-slate-300 dark:border-slate-700"
                    )}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-950" />}
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {descriptions[preset.hours] || `Data retained for ${preset.hours} hours.`}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
