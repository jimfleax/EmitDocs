/**
 * @file ApprovalProgress.tsx
 * @description Animated progress indicator when an approved snapshot is building and copying recipients.
 * @architecture Modal/overlay progress indicator embedded into ApprovalWorkspace during snapshot sealing lifecycle.
 * @agent_note Visualizes multi-stage batch sealing pipeline (copying records, canonical hashing, finalizing).
 */

import { CircleNotch, Database, Hash, Check } from "@phosphor-icons/react";

interface ApprovalProgressProps {
  step: "staging" | "hashing" | "finalizing" | "complete";
}

/**
 * @component ApprovalProgress
 * @description Renders step-by-step spinner and milestone breadcrumb during immutable snapshot creation.
 * @param {ApprovalProgressProps} props - Component properties.
 * @param {"staging" | "hashing" | "finalizing" | "complete"} props.step - Active batch sealing stage.
 * @returns {JSX.Element} Progress card with step indicators and animated icons.
 */
export function ApprovalProgress({ step }: ApprovalProgressProps) {
  const steps = [
    { id: "staging", label: "Copying Recipient Records", icon: Database },
    { id: "hashing", label: "Calculating Canonical Digest", icon: Hash },
    { id: "finalizing", label: "Sealing Batch Immutability", icon: Check },
  ];

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center">
      <div className="flex justify-center mb-4">
        <CircleNotch className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
      </div>
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
        Sealing Immutable Snapshot...
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
        Freezing recipient records and calculating cryptographic verification
        digest. Please do not close this window.
      </p>

      <div className="flex items-center justify-center gap-6 mt-6">
        {steps.map((s, idx) => {
          const Icon = s.icon;
          const isCurrent = step === s.id;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  isCurrent
                    ? "bg-indigo-600 text-white animate-pulse"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span
                className={`text-xs font-medium ${isCurrent ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-500"}`}
              >
                {s.label}
              </span>
              {idx < steps.length - 1 && (
                <span className="text-slate-300 dark:text-slate-700">→</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
