/**
 * @file FeaturesBentoGrid.tsx
 * @description 6-card interactive Bento Grid showcasing EmitDocs's core technical pillars.
 * @architecture Uses Tailwind grids, responsive cards, crisp borders, and embedded micro-UI simulations.
 */

import { useState } from "react";
import {
  FileText,
  Stack,
  SlidersHorizontal,
  LockKey,
  Lightning,
  ShieldCheck,
  Check,
  CheckCircle,
  WarningCircle,
  ArrowsClockwise,
  Clock,
  Sparkle,
  CopySimple,
} from "@phosphor-icons/react";

export function FeaturesBentoGrid() {
  // Card 1 State: Coordinate Snapper
  const [pinPos, setPinPos] = useState({ x: 42, y: 55 });

  // Card 2 State: Spreadsheet Intake Filter
  const [intakeFilter, setIntakeFilter] = useState<"all" | "valid" | "quarantine">("all");

  // Card 3 State: Non-destructive Override Diff
  const [showOverride, setShowOverride] = useState(true);

  // Card 4 State: Cryptographic Seal State
  const [isCopiedHash, setIsCopiedHash] = useState(false);

  // Card 5 State: Engine Streaming Simulator
  const [engineActive, setEngineActive] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(3840);

  // Card 6 State: Retention Preset
  const [retentionPeriod, setRetentionPeriod] = useState<"24h" | "7d" | "30d">("7d");

  const toggleEngine = () => {
    if (engineActive) return;
    setEngineActive(true);
    setGeneratedCount(0);
    const timer = setInterval(() => {
      setGeneratedCount((prev) => {
        if (prev >= 5000) {
          clearInterval(timer);
          setEngineActive(false);
          return 5000;
        }
        return prev + 625;
      });
    }, 120);
  };

  const copyHash = () => {
    navigator.clipboard.writeText("0xa48fb3c2998d712e09ffc71b12e3");
    setIsCopiedHash(true);
    setTimeout(() => setIsCopiedHash(false), 1800);
  };

  return (
    <section id="features" className="py-20 sm:py-28 relative scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section Heading */}
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold">
            <Sparkle size={13} weight="fill" />
            <span>Architectural Pillars</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Engineered for precision. <br />
            <span className="text-blue-600">Built without compromise.</span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            EmitDocs solves the real hazards of bulk issuance: broken coordinate transformations, silent text clipping, corrupted spreadsheets, and unrecoverable errors.
          </p>
        </div>

        {/* 6-Card Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* ======================================================== */}
          {/* Card 1 (Span 2 cols on lg): Visual PDF Coordinate Engine */}
          {/* ======================================================== */}
          <div className="lg:col-span-2 rounded-3xl bg-white border border-slate-200/90 shadow-sm p-6 sm:p-8 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="space-y-3 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shadow-2xs">
                <FileText size={20} weight="bold" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600">
                  PRD-CORE-03
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Sub-Pixel Coordinate Anchoring &amp; Fit-Then-Flag
                </h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
                Automatic placeholder token detection with interactive alignment snappers across rotated, multi-page PDFs. Our Fit-Then-Flag algorithm clamps font sizing to safe minimums and raises blocking flags before silent clipping occurs.
              </p>
            </div>

            {/* Interactive Coordinate Canvas Micro-UI */}
            <div className="mt-6 pt-6 border-t border-slate-100">
              <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    <span>Interactive PDF Page Coordinate Space [792 x 612 pt]</span>
                  </div>
                  <span>Pin: [{pinPos.x}%, {pinPos.y}%]</span>
                </div>

                {/* Simulated interactive mini-canvas */}
                <div
                  className="h-32 sm:h-36 rounded-xl bg-slate-950 border border-slate-800/80 relative cursor-crosshair overflow-hidden"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                    setPinPos({ x, y });
                  }}
                >
                  {/* Subtle Grid Lines */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:16px_16px] opacity-40 pointer-events-none"
                  />

                  {/* Movable Pin */}
                  <div
                    style={{ left: `${pinPos.x}%`, top: `${pinPos.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none transition-all duration-150"
                  >
                    <div className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-mono text-[10px] font-bold shadow-md whitespace-nowrap">
                      {"{{recipient_name}}"}
                    </div>
                    <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-blue-600 shadow-sm mt-0.5" />
                  </div>

                  <div className="absolute bottom-2 left-2 text-[10px] font-mono text-slate-500 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                    Click anywhere on this canvas to reposition the variable anchor
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle size={14} weight="fill" />
                    <span>Rotation Invariance (0°, 90°, 180°, 270°) Verified</span>
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    Clamp: 18pt min · 32pt max
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* Card 2: Resilient Batch Intake & Quarantine               */}
          {/* ======================================================== */}
          <div className="rounded-3xl bg-white border border-slate-200/90 shadow-sm p-6 sm:p-8 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center shadow-2xs">
                <Stack size={20} weight="bold" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-purple-600">
                  PRD-CORE-04
                </span>
                <h3 className="text-xl font-bold text-slate-900">
                  Resilient Intake &amp; Quarantine
                </h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Chunked CSV &amp; XLSX ingestion parses 5,000+ rows seamlessly. Duplicate fingerprinting quarantines anomalies while valid records proceed without obstruction.
              </p>
            </div>

            {/* Interactive Data Filter Micro-UI */}
            <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setIntakeFilter("all")}
                  className={`flex-1 py-1 rounded-lg transition-all ${
                    intakeFilter === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  All (5,000)
                </button>
                <button
                  type="button"
                  onClick={() => setIntakeFilter("valid")}
                  className={`flex-1 py-1 rounded-lg transition-all ${
                    intakeFilter === "valid" ? "bg-white text-emerald-600 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Valid (4,992)
                </button>
                <button
                  type="button"
                  onClick={() => setIntakeFilter("quarantine")}
                  className={`flex-1 py-1 rounded-lg transition-all ${
                    intakeFilter === "quarantine" ? "bg-white text-amber-600 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Quarantine (8)
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5">
                {intakeFilter === "all" && (
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="font-medium">Total Ingestion State</span>
                    <span className="font-mono font-bold text-blue-600">100% Parsed</span>
                  </div>
                )}
                {intakeFilter === "valid" && (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span className="font-medium flex items-center gap-1">
                      <CheckCircle size={14} weight="fill" /> Ready for PDF generation
                    </span>
                    <span className="font-mono font-bold">4,992 Rows</span>
                  </div>
                )}
                {intakeFilter === "quarantine" && (
                  <div className="flex items-center justify-between text-amber-700">
                    <span className="font-medium flex items-center gap-1">
                      <WarningCircle size={14} weight="fill" /> Duplicate Fingerprint
                    </span>
                    <span className="font-mono font-bold">8 Non-blocking</span>
                  </div>
                )}
                <div className="text-[11px] text-slate-400">
                  Zero row dropping: duplicate warnings never block generation of valid rows.
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* Card 3: Draft Review & Non-Destructive Overrides          */}
          {/* ======================================================== */}
          <div className="rounded-3xl bg-white border border-slate-200/90 shadow-sm p-6 sm:p-8 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shadow-2xs">
                <SlidersHorizontal size={20} weight="bold" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-600">
                  PRD-CORE-05
                </span>
                <h3 className="text-xl font-bold text-slate-900">
                  Non-Destructive Overrides
                </h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Review every recipient draft. Edit typos or add formal titles inline without altering raw CSV reference rows, safeguarded by optimistic CAS concurrency.
              </p>
            </div>

            {/* Interactive Raw vs Override Micro-UI */}
            <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Row #420 Recipient</span>
                <button
                  type="button"
                  onClick={() => setShowOverride(!showOverride)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1"
                >
                  <ArrowsClockwise size={13} weight="bold" />
                  <span>Toggle {showOverride ? "Raw Data" : "Override"}</span>
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                  <span>Field: recipient_name</span>
                  <span className={showOverride ? "text-emerald-400" : "text-slate-400"}>
                    {showOverride ? "Override Layer Active" : "Original Source Value"}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 font-mono text-sm border border-slate-800">
                  {showOverride ? (
                    <span className="text-emerald-300 font-semibold">
                      Marcus Chen, Ph.D.
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      marcus chen (original typo)
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  CAS Version: 0x228f · Raw spreadsheet remains 100% immutable
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* Card 4: Cryptographic Approved Snapshot                   */}
          {/* ======================================================== */}
          <div className="rounded-3xl bg-white border border-slate-200/90 shadow-sm p-6 sm:p-8 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shadow-2xs">
                <LockKey size={20} weight="bold" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-600">
                  PRD-CORE-06
                </span>
                <h3 className="text-xl font-bold text-slate-900">
                  Cryptographic Approved Snapshots
                </h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Prior to generation, approve an immutable snapshot sealed with a canonical SHA-256 hash. Any upstream mutation automatically invalidates stale approval states.
              </p>
            </div>

            {/* Micro-UI: Interactive Cryptographic Seal */}
            <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    <ShieldCheck size={16} weight="fill" className="text-emerald-600" />
                    <span>ApprovedSnapshot Sealed</span>
                  </span>
                  <span className="font-mono text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                    IMMUTABLE
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-emerald-200/80 font-mono text-[11px] text-slate-700">
                  <span className="truncate max-w-[190px]">sha256:0xa48fb3c2998d712e09ff...</span>
                  <button
                    type="button"
                    onClick={copyHash}
                    className="p-1 text-slate-400 hover:text-slate-800 transition-colors"
                    title="Copy hash"
                  >
                    {isCopiedHash ? <Check size={14} className="text-emerald-600" /> : <CopySimple size={14} />}
                  </button>
                </div>
                <div className="text-[10px] text-emerald-800">
                  Guarantees that generated PDFs match exactly what was approved.
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* Card 5: High-Speed Parallel Generation & ZIP              */}
          {/* ======================================================== */}
          <div className="rounded-3xl bg-white border border-slate-200/90 shadow-sm p-6 sm:p-8 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shadow-2xs">
                <Lightning size={20} weight="bold" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600">
                  PRD-CORE-07 &amp; 08
                </span>
                <h3 className="text-xl font-bold text-slate-900">
                  Streaming Generation &amp; ZIP Export
                </h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Dual client-side and cloud worker rendering engine powered by pdf-lib &amp; fontkit. Stream thousands of individualized documents into a single organized ZIP archive.
              </p>
            </div>

            {/* Micro-UI: Interactive Generation Progress Trigger */}
            <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-700">Batch Throughput</span>
                <button
                  type="button"
                  onClick={toggleEngine}
                  disabled={engineActive}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer disabled:opacity-50"
                >
                  {engineActive ? "Generating..." : "Run Test Benchmark"}
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-slate-500">
                  <span>{generatedCount} / 5,000 PDFs</span>
                  <span>{Math.round((generatedCount / 5000) * 100)}%</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    style={{ width: `${(generatedCount / 5000) * 100}%` }}
                    className="h-full bg-blue-600 rounded-full transition-all duration-150"
                  />
                </div>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                <span>Speed: ~125 PDFs / second</span>
                <span className="font-mono text-slate-600">Zero Memory Bloat</span>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* Card 6: Zero Model Training & Automated Retention         */}
          {/* ======================================================== */}
          <div className="lg:col-span-2 rounded-3xl bg-white border border-slate-200/90 shadow-sm p-6 sm:p-8 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-2xs">
                <ShieldCheck size={20} weight="bold" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
                  PRD-CORE-09 &amp; PRIVACY
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Zero AI Model Training &amp; Guaranteed Cloud Purge
                </h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
                Confidentiality by design. Your document designs, recipient names, and personal identification are <strong>never</strong> used to train machine learning models. Set automated 24-hour, 7-day, or 30-day lifecycle policies with guaranteed physical deletion.
              </p>
            </div>

            {/* Interactive Retention Slider Micro-UI */}
            <div className="mt-6 pt-6 border-t border-slate-100">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-900">
                      Configure Job Retention Preset:
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Select policy to inspect automated purge schedule
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                    {(["24h", "7d", "30d"] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setRetentionPeriod(period)}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          retentionPeriod === period
                            ? "bg-slate-900 text-white shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {period === "24h" ? "24 Hours" : period === "7d" ? "7 Days (Default)" : "30 Days (Max)"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                  <div className="p-3 rounded-xl bg-white border border-slate-200/60 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-400">Step 1</span>
                    <div className="font-semibold text-slate-800 flex items-center gap-1">
                      <Clock size={13} className="text-blue-600" />
                      <span>Logical Expiry</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Download links revoked instantly at T + {retentionPeriod}.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200/60 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-400">Step 2</span>
                    <div className="font-semibold text-slate-800 flex items-center gap-1">
                      <ShieldCheck size={13} className="text-emerald-600" />
                      <span>Physical Erasure</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Cloudflare R2 and MongoDB recipient rows permanently shredded.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200/60 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-400">Step 3</span>
                    <div className="font-semibold text-slate-800 flex items-center gap-1">
                      <Check size={13} className="text-blue-600" />
                      <span>Audit Verification</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      GDPR Art. 17 &amp; CCPA non-sale compliance audit logged.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
