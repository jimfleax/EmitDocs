/**
 * @file HeroWorkflowPreview.tsx
 * @description Interactive micro-application canvas previewing EmitDocs's core PDF mapping, recipient switching, and live rendering pipeline.
 * @architecture Client-side interactive mockup styled in EmitDocs's signature sapphire-navy theme with ambient glow flares.
 * @agent_note Bidirectionally connects certificate token pins to inspector controls and dynamic recipient field switching.
 */

import { useState } from "react";
import {
  FileText,
  CheckCircle,
  WarningCircle,
  SlidersHorizontal,
  Sparkle,
  QrCode,
  ShieldCheck,
  Eye,
  Check,
} from "@phosphor-icons/react";

interface RecipientSample {
  id: string;
  rowNumber: number;
  name: string;
  role: string;
  date: string;
  code: string;
  status: "valid" | "warning";
  warningText?: string;
  fontSize: string;
}

interface TokenMeta {
  id: string;
  tokenName: string;
  column: string;
  alignment: string;
  fontFamily: string;
  clamp: string;
  status: string;
  description: string;
}

const TOKEN_DETAILS: Record<string, TokenMeta> = {
  name: {
    id: "name",
    tokenName: "{{recipient_name}}",
    column: "Full_Name",
    alignment: "Center",
    fontFamily: "Cinzel Serif",
    clamp: "18pt min · 32pt max",
    status: "Fit-then-flag Active",
    description:
      "Personalized recipient full name dynamically bound to spreadsheet rows with automatic typography scaling.",
  },
  role: {
    id: "role",
    tokenName: "{{course_title}}",
    column: "Track_Title",
    alignment: "Center",
    fontFamily: "Inter SemiBold",
    clamp: "12pt min · 18pt max",
    status: "Safe (No clipping)",
    description:
      "Curriculum or program title anchored to horizontal center guides.",
  },
  date: {
    id: "date",
    tokenName: "{{issue_date}}",
    column: "Graduation_Date",
    alignment: "Left",
    fontFamily: "Inter Medium",
    clamp: "10pt fixed",
    status: "Safe (No clipping)",
    description:
      "Localized date of document issuance with automated ISO format parse.",
  },
  id: {
    id: "id",
    tokenName: "{{credential_id}}",
    column: "UUID_Hash",
    alignment: "Right",
    fontFamily: "JetBrains Mono",
    clamp: "10pt monospace",
    status: "Safe (No clipping)",
    description:
      "Unique credential identifier mapped with anti-collision validation.",
  },
};

const SAMPLE_RECIPIENTS: RecipientSample[] = [
  {
    id: "rec_1",
    rowNumber: 1,
    name: "Dr. Elena Rostova",
    role: "Cloud Infrastructure & Distributed Systems",
    date: "October 15, 2026",
    code: "EMIT-8842-AX",
    status: "valid",
    fontSize: "28px",
  },
  {
    id: "rec_2",
    rowNumber: 2,
    name: "Marcus Aurelius Montgomery Vance",
    role: "High-Throughput Concurrent Systems Engineering",
    date: "November 02, 2026",
    code: "EMIT-8843-AX",
    status: "warning",
    warningText:
      "Fit-then-flag: Auto-scaled to 20px to prevent boundary overflow",
    fontSize: "20px",
  },
  {
    id: "rec_3",
    rowNumber: 3,
    name: "Aisha Patel",
    role: "Autonomous Data Pipeline Engineering",
    date: "December 10, 2026",
    code: "EMIT-8844-AX",
    status: "valid",
    fontSize: "28px",
  },
];

/**
 * Returns field-aware primary and secondary display strings for the recipient switcher.
 */
function getFieldDisplay(rec: RecipientSample, pin: string) {
  switch (pin) {
    case "role":
      return {
        primary: rec.role,
        secondary: `${rec.name} · Row #${rec.rowNumber}`,
        code: rec.code,
      };
    case "date":
      return {
        primary: rec.date,
        secondary: `${rec.name} · Row #${rec.rowNumber}`,
        code: rec.code,
      };
    case "id":
      return {
        primary: rec.code,
        secondary: `${rec.name} · Row #${rec.rowNumber}`,
        code: rec.code,
      };
    case "name":
    default:
      return {
        primary: rec.name,
        secondary: `${rec.code} · Row #${rec.rowNumber}`,
        code: rec.code,
      };
  }
}

/**
 * @component HeroWorkflowPreview
 * @description Interactive canvas simulating certificate rendering, token pins, and recipient switching.
 */
export function HeroWorkflowPreview() {
  const [selectedRecipient, setSelectedRecipient] = useState<RecipientSample>(
    SAMPLE_RECIPIENTS[0],
  );
  const [activePin, setActivePin] = useState<string>("name");

  const currentToken = TOKEN_DETAILS[activePin] || TOKEN_DETAILS.name;
  const currentSelectedDisplay = getFieldDisplay(selectedRecipient, activePin);

  return (
    <div className="relative w-full max-w-5xl mx-auto rounded-3xl bg-[rgb(16_60_133)] border border-white/20 shadow-[0_25px_60px_-15px_rgba(16,60,133,0.4)] overflow-hidden text-white flex flex-col">
      {/* Ambient Radial Glow Flares */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-400/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-indigo-400/25 blur-3xl"
      />

      {/* 1. App-like Top Navigation Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between px-4 sm:px-6 py-3.5 bg-black/20 backdrop-blur-md border-b border-white/15 gap-3">
        {/* Left: Window Controls & Active Template */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <div className="w-3 h-3 rounded-full bg-rose-400/90" />
            <div className="w-3 h-3 rounded-full bg-amber-400/90" />
            <div className="w-3 h-3 rounded-full bg-emerald-400/90" />
          </div>
          <div className="h-4 w-[1px] bg-white/20 mx-1 hidden sm:block" />
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs font-mono text-white">
            <FileText size={14} className="text-blue-300" weight="bold" />
            <span className="truncate max-w-[140px] sm:max-w-none">
              Certificate_Template_v2.pdf
            </span>
            <span className="text-emerald-300 font-sans font-semibold text-[10px] px-1.5 py-0.2 rounded bg-emerald-400/15 border border-emerald-400/30">
              CAS v2
            </span>
          </div>
        </div>

        {/* Right: Batch Status & Mode */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-blue-100">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Dataset: 5,000 rows mapped</span>
          </div>
          <div className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono bg-white/10 px-2.5 py-1 rounded-lg border border-white/15 text-blue-200">
            <SlidersHorizontal size={13} />
            <span>Click any field in PDF to inspect</span>
          </div>
        </div>
      </div>

      {/* 2. Workspace Body: Document Preview Stage & Interactive Rail */}
      <div className="relative z-10 p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 items-center lg:items-start justify-center">
        {/* Document Visual Render Canvas */}
        <div className="w-full max-w-2xl bg-white text-slate-900 rounded-2xl shadow-2xl p-6 sm:p-10 relative overflow-hidden border border-white/40 aspect-[1.414/1] flex flex-col justify-between selection:bg-blue-100">
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
              role="button"
              tabIndex={0}
              onClick={() => setActivePin("name")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setActivePin("name");
              }}
              aria-label="Select recipient name token"
              className={`inline-block relative cursor-pointer px-3 py-1 rounded-xl transition-all ${
                activePin === "name"
                  ? "ring-2 ring-blue-500 bg-blue-50/80 shadow-xs"
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
                has successfully completed the curriculum and mastery evaluation
                for
              </p>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setActivePin("role")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setActivePin("role");
                }}
                aria-label="Select course title token"
                className={`inline-block relative cursor-pointer px-2.5 py-1 mt-1 rounded-lg text-xs sm:text-sm font-semibold text-slate-800 transition-all ${
                  activePin === "role"
                    ? "ring-2 ring-blue-500 bg-blue-50/80 shadow-xs"
                    : "hover:bg-slate-50 ring-1 ring-transparent hover:ring-slate-300"
                }`}
              >
                <span>{selectedRecipient.role}</span>
                <div
                  className={`absolute -top-3.5 right-0 px-1.5 py-0.2 rounded font-mono text-[9px] font-bold shadow-xs transition-all ${
                    activePin === "role"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-200 hidden sm:block"
                  }`}
                >
                  {"{{course_title}}"}
                </div>
              </div>
            </div>
          </div>

          {/* Certificate Footer Metadata */}
          <div className="flex items-end justify-between relative z-10 pt-3 border-t border-slate-100 text-[10px] sm:text-xs text-slate-500">
            {/* Issue Date Pin */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setActivePin("date")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setActivePin("date");
              }}
              aria-label="Select issue date token"
              className={`cursor-pointer p-1.5 rounded-lg transition-all ${
                activePin === "date"
                  ? "ring-2 ring-blue-500 bg-blue-50/80 shadow-xs"
                  : "hover:bg-slate-50"
              }`}
            >
              <span className="block text-[9px] font-mono uppercase text-slate-400">
                Date of Issuance
              </span>
              <span className="font-medium text-slate-800">
                {selectedRecipient.date}
              </span>
              {activePin === "date" && (
                <span className="block text-[8px] font-mono font-bold text-blue-600">
                  {"{{issue_date}}"}
                </span>
              )}
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
              role="button"
              tabIndex={0}
              onClick={() => setActivePin("id")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setActivePin("id");
              }}
              aria-label="Select credential ID token"
              className={`text-right cursor-pointer p-1.5 rounded-lg transition-all ${
                activePin === "id"
                  ? "ring-2 ring-blue-500 bg-blue-50/80 shadow-xs"
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
              {activePin === "id" && (
                <span className="block text-[8px] font-mono font-bold text-blue-600">
                  {"{{credential_id}}"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Inspection & Recipient Switcher Rail */}
        <div className="w-full lg:w-80 flex flex-col space-y-4">
          {/* Active Variable Pin Inspector */}
          <div className="rounded-2xl bg-white/10 backdrop-blur-md p-4 border border-white/20 space-y-3 shadow-lg">
            <div className="flex items-center justify-between pb-2 border-b border-white/15">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={15} className="text-blue-300" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Field Inspector
                </span>
              </div>
              <span className="font-mono text-[10px] text-emerald-300 bg-emerald-400/15 px-2 py-0.5 rounded border border-emerald-400/30">
                {currentToken.tokenName}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-blue-100/70">Bound Column:</span>
                <span className="font-mono text-white font-semibold bg-white/10 px-2 py-0.5 rounded">
                  {currentToken.column}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-100/70">Current Value:</span>
                <span
                  className="font-semibold text-white font-mono text-[11px] bg-white/10 px-2 py-0.5 rounded truncate max-w-[170px]"
                  title={currentSelectedDisplay.primary}
                >
                  {currentSelectedDisplay.primary}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-100/70">Alignment:</span>
                <span className="font-semibold text-white">
                  {currentToken.alignment}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-100/70">Font &amp; Clamp:</span>
                <span className="font-mono text-blue-200 text-[11px]">
                  {activePin === "name"
                    ? `${selectedRecipient.fontSize} (${currentToken.clamp})`
                    : currentToken.clamp}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-100/70">Safety Guard:</span>
                <span className="font-semibold text-emerald-300 flex items-center gap-1">
                  <Check size={12} weight="bold" />
                  <span>{currentToken.status}</span>
                </span>
              </div>
            </div>

            {selectedRecipient.warningText && activePin === "name" && (
              <div className="p-2.5 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-start gap-2 text-[11px] text-amber-200">
                <WarningCircle
                  size={16}
                  className="shrink-0 mt-0.5 text-amber-300"
                  weight="fill"
                />
                <span className="leading-snug">
                  {selectedRecipient.warningText}
                </span>
              </div>
            )}
          </div>

          {/* Interactive Recipient Row Switcher (Field-Aware) */}
          <div className="rounded-2xl bg-white/10 backdrop-blur-md p-4 border border-white/20 space-y-3 shadow-lg">
            <div className="flex items-center justify-between pb-2 border-b border-white/15">
              <div className="flex items-center gap-2">
                <Eye size={15} className="text-blue-300" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Live Row Switcher
                </span>
              </div>
              <span className="text-[10px] text-blue-200 font-mono bg-white/10 px-2 py-0.5 rounded border border-white/15">
                Column: {currentToken.column}
              </span>
            </div>

            <p className="text-[11px] text-blue-100/80 leading-snug">
              Previewing values for{" "}
              <span className="font-mono font-bold text-white">
                {currentToken.tokenName}
              </span>{" "}
              across recipient rows:
            </p>

            <div className="space-y-2">
              {SAMPLE_RECIPIENTS.map((rec) => {
                const isSelected = selectedRecipient.id === rec.id;
                const fieldDisplay = getFieldDisplay(rec, activePin);
                return (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => setSelectedRecipient(rec)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-white/25 border-white/40 text-white shadow-sm ring-1 ring-white/30"
                        : "bg-white/5 border-white/10 text-blue-100/80 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-semibold truncate leading-tight">
                        {fieldDisplay.primary}
                      </div>
                      <div className="text-[10px] text-blue-200/70 font-mono mt-0.5 truncate">
                        {fieldDisplay.secondary}
                      </div>
                    </div>
                    {rec.status === "warning" && activePin === "name" ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-400/20 text-amber-200 border border-amber-400/40 shrink-0">
                        Auto-Scaled
                      </span>
                    ) : (
                      <CheckCircle
                        size={16}
                        weight="fill"
                        className={`shrink-0 ${
                          isSelected ? "text-white" : "text-emerald-400"
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
      <div className="relative z-10 px-4 sm:px-6 py-3 bg-black/20 backdrop-blur-md border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs text-blue-100/80">
        <div className="flex items-center gap-2">
          <CheckCircle size={15} weight="fill" className="text-emerald-400" />
          <span>
            Every recipient draft is inspected prior to approval. Zero silent
            clipping.
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono text-blue-200">
          <span>Engine: pdf-lib + fontkit</span>
          <span>·</span>
          <span>Snapshot: SHA-256</span>
        </div>
      </div>
    </div>
  );
}
