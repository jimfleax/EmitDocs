/**
 * @file HeroWorkflowPreview.tsx
 * @description Interactive micro-application canvas previewing EmitDocs's core PDF mapping, recipient switching, and live rendering pipeline.
 * @architecture Client-side interactive mockup built with pure Tailwind, Lucide/Phosphor icons, and reactive state.
 */

import { useState } from "react";
import {
  FileText,
  CheckCircle,
  WarningCircle,
  SlidersHorizontal,
  Sparkle,
  DownloadSimple,
  Check,
  QrCode,
  ShieldCheck,
  Eye,
} from "@phosphor-icons/react";

interface RecipientSample {
  id: string;
  name: string;
  role: string;
  date: string;
  code: string;
  status: "valid" | "warning";
  warningText?: string;
  fontSize: string;
}

const SAMPLE_RECIPIENTS: RecipientSample[] = [
  {
    id: "rec_1",
    name: "Dr. Elena Rostova",
    role: "Advanced Distributed Systems Architecture",
    date: "October 15, 2026",
    code: "EMIT-8842-AX",
    status: "valid",
    fontSize: "28px",
  },
  {
    id: "rec_2",
    name: "Marcus Aurelius Montgomery Vance",
    role: "Advanced Distributed Systems Architecture",
    date: "October 15, 2026",
    code: "EMIT-8843-AX",
    status: "warning",
    warningText: "Fit-then-flag: Auto-scaled to 20px to prevent overflow",
    fontSize: "20px",
  },
  {
    id: "rec_3",
    name: "Aisha Patel",
    role: "Advanced Distributed Systems Architecture",
    date: "October 15, 2026",
    code: "EMIT-8844-AX",
    status: "valid",
    fontSize: "28px",
  },
];

export function HeroWorkflowPreview() {
  const [selectedRecipient, setSelectedRecipient] = useState<RecipientSample>(
    SAMPLE_RECIPIENTS[0],
  );
  const [activePin, setActivePin] = useState<string | null>("name");
  const [isSimulatingBatch, setIsSimulatingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);

  const runSimulation = () => {
    if (isSimulatingBatch) return;
    setIsSimulatingBatch(true);
    setBatchProgress(0);

    const interval = setInterval(() => {
      setBatchProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setIsSimulatingBatch(false), 2000);
          return 100;
        }
        return prev + 20;
      });
    }, 180);
  };

  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl bg-slate-900 border border-slate-700/80 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.35)] overflow-hidden text-slate-100 flex flex-col">
      {/* 1. App-like Top Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-950/80 border-b border-slate-800 gap-3">
        {/* Left: Window Controls & Active Template */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="h-4 w-[1px] bg-slate-800 mx-1 hidden sm:block" />
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
            <FileText size={14} className="text-blue-400" weight="bold" />
            <span className="truncate max-w-[140px] sm:max-w-none">
              Certificate_Template_v2.pdf
            </span>
            <span className="text-emerald-400 font-sans font-semibold text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/30">
              CAS v2
            </span>
          </div>
        </div>

        {/* Right: Batch Status & Action Trigger */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Dataset: 5,000 rows mapped</span>
          </div>
          <button
            type="button"
            onClick={runSimulation}
            disabled={isSimulatingBatch}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm cursor-pointer disabled:opacity-80 active:scale-95 select-none"
          >
            {isSimulatingBatch ? (
              <>
                <span className="animate-spin inline-block">◌</span>
                <span>Generating {batchProgress}%</span>
              </>
            ) : batchProgress === 100 ? (
              <>
                <Check size={14} weight="bold" className="text-emerald-300" />
                <span>ZIP Ready (42 MB)</span>
              </>
            ) : (
              <>
                <DownloadSimple size={14} weight="bold" />
                <span>Simulate Bulk Run</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Workspace Body: Document Preview Stage */}
      <div className="p-4 sm:p-6 lg:p-8 bg-slate-900/90 flex flex-col lg:flex-row gap-6 items-center lg:items-start justify-center">
        {/* Document Visual Render Canvas */}
        <div className="w-full max-w-2xl bg-white text-slate-900 rounded-2xl shadow-2xl p-6 sm:p-10 relative overflow-hidden border border-slate-200 aspect-[1.414/1] flex flex-col justify-between selection:bg-blue-100">
          {/* Ornate Document Border Guilloche / Vector Accents */}
          <div
            aria-hidden="true"
            className="absolute inset-3 border-2 border-slate-200 pointer-events-none rounded-xl"
          />
          <div
            aria-hidden="true"
            className="absolute inset-4.5 border border-blue-500/20 pointer-events-none rounded-lg"
          />
          <div
            aria-hidden="true"
            className="absolute -top-12 -right-12 w-36 h-36 bg-blue-100/50 rounded-full blur-2xl pointer-events-none"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-12 -left-12 w-36 h-36 bg-indigo-100/40 rounded-full blur-2xl pointer-events-none"
          />

          {/* Certificate Header */}
          <div className="text-center relative z-10 pt-2">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 mb-2 shadow-2xs">
              <Sparkle size={20} weight="fill" />
            </div>
            <h4 className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.25em] text-slate-400 font-bold">
              Official Credential of Completion
            </h4>
            <h3 className="text-lg sm:text-2xl font-serif font-black tracking-tight text-slate-900 mt-0.5">
              EmitDocs Institute of Engineering
            </h3>
            <p className="text-[11px] text-slate-400 italic mt-0.5">
              This document certifies that
            </p>
          </div>

          {/* Dynamic Pin 1: Recipient Name */}
          <div className="text-center relative z-10 my-auto py-2">
            <div
              onClick={() => setActivePin("name")}
              className={`inline-block relative cursor-pointer px-3 py-1 rounded-xl transition-all ${
                activePin === "name"
                  ? "ring-2 ring-blue-500 bg-blue-50/70"
                  : "hover:bg-slate-50 ring-1 ring-transparent hover:ring-slate-300"
              }`}
            >
              <div
                style={{ fontSize: selectedRecipient.fontSize }}
                className="font-serif font-bold text-slate-900 tracking-tight transition-all duration-300"
              >
                {selectedRecipient.name}
              </div>
              <div className="h-0.5 w-3/4 mx-auto bg-blue-600/40 mt-1" />

              {/* Pin Tag Coordinate Marker */}
              <div
                className={`absolute -top-3.5 right-2 px-1.5 py-0.2 rounded font-mono text-[9px] font-bold shadow-xs flex items-center gap-1 transition-all ${
                  activePin === "name"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-200"
                }`}
              >
                <span>{"{{recipient_name}}"}</span>
                <span className="text-blue-200">#Y:380</span>
              </div>
            </div>

            {/* Dynamic Pin 2: Course Title */}
            <div className="mt-2">
              <p className="text-[11px] sm:text-xs text-slate-500">
                has successfully completed the curriculum and mastery evaluation for
              </p>
              <div
                onClick={() => setActivePin("role")}
                className={`inline-block relative cursor-pointer px-2.5 py-0.5 mt-1 rounded-lg text-xs sm:text-sm font-semibold text-slate-800 transition-all ${
                  activePin === "role"
                    ? "ring-2 ring-blue-500 bg-blue-50/70"
                    : "hover:bg-slate-50"
                }`}
              >
                <span>{selectedRecipient.role}</span>
                {activePin === "role" && (
                  <div className="absolute -top-3 right-0 px-1 py-0.2 rounded font-mono text-[9px] bg-blue-600 text-white font-bold">
                    {"{{course_title}}"}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Certificate Footer Metadata */}
          <div className="flex items-end justify-between relative z-10 pt-3 border-t border-slate-100 text-[10px] sm:text-xs text-slate-500">
            {/* Issue Date Pin */}
            <div
              onClick={() => setActivePin("date")}
              className={`cursor-pointer p-1.5 rounded-lg transition-all ${
                activePin === "date"
                  ? "ring-2 ring-blue-500 bg-blue-50/70"
                  : "hover:bg-slate-50"
              }`}
            >
              <span className="block text-[9px] font-mono uppercase text-slate-400">
                Date of Issuance
              </span>
              <span className="font-medium text-slate-800">
                {selectedRecipient.date}
              </span>
            </div>

            {/* Central Seal Badge */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-blue-500/40 bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                <ShieldCheck size={20} weight="bold" />
              </div>
              <span className="text-[8px] font-mono tracking-widest text-slate-400 uppercase mt-0.5">
                VERIFIED
              </span>
            </div>

            {/* Credential ID / QR */}
            <div
              onClick={() => setActivePin("id")}
              className={`text-right cursor-pointer p-1.5 rounded-lg transition-all ${
                activePin === "id"
                  ? "ring-2 ring-blue-500 bg-blue-50/70"
                  : "hover:bg-slate-50"
              }`}
            >
              <span className="block text-[9px] font-mono uppercase text-slate-400">
                Credential ID
              </span>
              <span className="font-mono font-bold text-slate-800 flex items-center justify-end gap-1">
                <QrCode size={12} weight="bold" />
                <span>{selectedRecipient.code}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Inspection & Recipient Switcher Rail */}
        <div className="w-full lg:w-80 flex flex-col space-y-4">
          {/* Active Variable Pin Inspector */}
          <div className="rounded-2xl bg-slate-950 p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={14} className="text-blue-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Field Inspector
                </span>
              </div>
              <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                Snapper: ON
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Active Token:</span>
                <span className="font-mono text-blue-400 font-semibold">
                  {activePin === "name"
                    ? "{{recipient_name}}"
                    : activePin === "role"
                      ? "{{course_title}}"
                      : activePin === "date"
                        ? "{{issue_date}}"
                        : "{{credential_id}}"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Target Column:</span>
                <span className="font-mono text-slate-200">
                  {activePin === "name"
                    ? "Full_Name"
                    : activePin === "role"
                      ? "Track_Title"
                      : activePin === "date"
                        ? "Graduation_Date"
                        : "UUID_Hash"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Computed Font:</span>
                <span className="font-mono text-slate-200">
                  {selectedRecipient.fontSize} Cinzel Serif
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Overflow Guard:</span>
                <span className="font-semibold text-emerald-400">
                  Fit-then-flag Active
                </span>
              </div>
            </div>

            {selectedRecipient.warningText && (
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 text-[11px] text-amber-300">
                <WarningCircle size={15} className="shrink-0 mt-0.5 text-amber-400" />
                <span>{selectedRecipient.warningText}</span>
              </div>
            )}
          </div>

          {/* Interactive Recipient Row Switcher */}
          <div className="rounded-2xl bg-slate-950 p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-blue-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Live Recipient Switcher
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                3 of 5,000
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-snug">
              Click a recipient to test dynamic rendering and overflow validation:
            </p>

            <div className="space-y-1.5">
              {SAMPLE_RECIPIENTS.map((rec) => {
                const isSelected = selectedRecipient.id === rec.id;
                return (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => setSelectedRecipient(rec)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-blue-600/20 border-blue-500/60 text-white shadow-xs"
                        : "bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-semibold truncate leading-tight">
                        {rec.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {rec.code}
                      </div>
                    </div>
                    {rec.status === "warning" ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                        Overflow Flag
                      </span>
                    ) : (
                      <CheckCircle
                        size={16}
                        weight="fill"
                        className={`shrink-0 ${
                          isSelected ? "text-blue-400" : "text-emerald-500"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Bar: Real-time Guarantee Notice */}
      <div className="px-4 sm:px-6 py-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <CheckCircle size={15} weight="fill" className="text-emerald-400" />
          <span>
            Every recipient draft is inspected prior to approval. Zero silent clipping.
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <span>Engine: pdf-lib + fontkit</span>
          <span>·</span>
          <span>Snapshot: SHA-256</span>
        </div>
      </div>
    </div>
  );
}
