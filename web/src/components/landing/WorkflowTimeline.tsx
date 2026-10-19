/**
 * @file WorkflowTimeline.tsx
 * @description 3-step streamlined visual progression showing the EmitDocs issuance journey with technical benchmarks.
 * @architecture High-contrast technical layout using step cards, connector beams, and benchmark metrics.
 * @agent_note Displays interactive step progression with tabbed preview states and benchmark statistics.
 */

import { useState } from "react";
import {
  FileText,
  Stack,
  DownloadSimple,
  CheckCircle,
  Lightning,
  Sparkle,
} from "@phosphor-icons/react";

/**
 * @component WorkflowTimeline
 * @description Step-by-step interactive workflow presentation with benchmark metrics and visual preview cards.
 */
export function WorkflowTimeline() {
  const [activeStep, setActiveStep] = useState<number>(1);

  const steps = [
    {
      number: "01",
      title: "Upload Template & Anchor Variables",
      subtitle: "Visual PDF Studio & Sub-Pixel Mapping",
      description:
        "Upload any text-based PDF certificate, invoice, pass, or letter. EmitDocs automatically extracts text layers, detects candidate placeholders ({{recipient_name}}), and binds coordinate frames with fit-then-flag typography rules.",
      icon: <FileText size={22} weight="bold" />,
      tag: "Template Studio",
      metric: "< 100ms coordinate calculation",
      badgeColor: "text-blue-600 bg-blue-50 border-blue-200",
      details: [
        "Automatic token detection across multi-page PDFs",
        "Visual drag-and-drop alignment snappers",
        "Optimistic CAS version bumping with mappingHash",
      ],
    },
    {
      number: "02",
      title: "Ingest Spreadsheets & Audit Every Draft",
      subtitle: "Chunked Intake & Non-Destructive Review",
      description:
        "Drop in your recipient data via CSV or XLSX. The intake engine automatically correlates column headers, isolates duplicate fingerprints, and provides a side-by-side gallery to review each personalized draft before approval.",
      icon: <Stack size={22} weight="bold" />,
      tag: "Batch Intake",
      metric: "5,000+ rows parsed in seconds",
      badgeColor: "text-purple-600 bg-purple-50 border-purple-200",
      details: [
        "Worksheet selection and automated header pairing",
        "Duplicate fingerprinting without dropping valid records",
        "Inline overrides stored separately from raw reference data",
      ],
    },
    {
      number: "03",
      title: "Seal Snapshot & Instant Bulk Export",
      subtitle: "Immutable SHA-256 Seal & Streaming ZIP",
      description:
        "Seal the batch into an immutable ApprovedSnapshot. Our parallel PDF engine compiles thousands of individualized documents with pixel-perfect font embedding and streams an organized, ready-to-distribute ZIP archive.",
      icon: <DownloadSimple size={22} weight="bold" />,
      tag: "Generation & Export",
      metric: "125+ PDFs / sec generation speed",
      badgeColor: "text-emerald-600 bg-emerald-50 border-emerald-200",
      details: [
        "Cryptographic snapshot guarantees tamper-proof generation",
        "Dual client-side and cloud worker execution without memory bloat",
        "Single-click bulk ZIP download with clean filenames",
      ],
    },
  ];

  return (
    <section
      id="workflow"
      className="py-20 sm:py-28 bg-slate-50/70 border-y border-slate-200/80 relative scroll-mt-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold">
            <Sparkle size={13} weight="fill" />
            <span>Workflow Progression</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            How EmitDocs works. <br />
            <span className="text-blue-600">
              From raw design to thousands of verified PDFs.
            </span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            A reliable 3-step pipeline designed to prevent issuance errors
            before they happen.
          </p>
        </div>

        {/* 3-Step Interactive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
          {steps.map((step, index) => {
            const isCurrent = activeStep === index + 1;
            return (
              <div
                key={step.number}
                onClick={() => setActiveStep(index + 1)}
                onMouseEnter={() => setActiveStep(index + 1)}
                className={`rounded-3xl p-6 sm:p-8 border transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                  isCurrent
                    ? "bg-white border-blue-500/80 shadow-[0_15px_30px_-10px_rgba(37,99,235,0.15)] ring-2 ring-blue-500/20"
                    : "bg-white/80 border-slate-200/90 shadow-sm hover:border-slate-300 hover:bg-white"
                }`}
              >
                <div className="space-y-5">
                  {/* Step Header */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-3xl sm:text-4xl font-black text-slate-300">
                      {step.number}
                    </span>
                    <div
                      className={`p-2.5 rounded-2xl border ${step.badgeColor} shadow-2xs`}
                    >
                      {step.icon}
                    </div>
                  </div>

                  {/* Title & Tag */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                      {step.tag}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 leading-snug">
                      {step.title}
                    </h3>
                    <p className="text-xs font-medium text-blue-600">
                      {step.subtitle}
                    </p>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {step.description}
                  </p>

                  {/* Bullet Highlights */}
                  <ul className="space-y-2 text-xs text-slate-700 pt-2 border-t border-slate-100">
                    {step.details.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle
                          size={15}
                          weight="fill"
                          className="text-blue-500 shrink-0 mt-0.5"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Bottom Metric Pill */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-500">
                  <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                    <Lightning
                      size={14}
                      className="text-amber-500"
                      weight="fill"
                    />
                    <span>{step.metric}</span>
                  </span>
                  <span className="text-blue-600 font-semibold">
                    Step {step.number}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ======================================================== */}
        {/* Technical Performance Benchmarks Banner                   */}
        {/* ======================================================== */}
        <div className="relative rounded-3xl lg:rounded-[32px] bg-[rgb(16_60_133)] border border-white/20 p-8 sm:p-10 shadow-[0_25px_60px_-15px_rgba(16,60,133,0.4)] text-white overflow-hidden">
          {/* Ambient Radial Glow Flares */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-400/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-indigo-400/25 blur-3xl"
          />

          <div className="relative z-10 max-w-3xl mb-8 space-y-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-200">
              Verified Technical Benchmarks
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Production Performance Under Pressure
            </h3>
            <p className="text-sm text-blue-100/80 leading-relaxed">
              Tested rigorously against large datasets and complex multi-page
              layouts.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 pt-6 border-t border-white/15">
            {/* Stat 1 */}
            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-extrabold text-blue-200 font-mono tracking-tight">
                5,000
              </div>
              <p className="text-xs font-semibold text-white">
                Max Recipient Batch Size
              </p>
              <p className="text-[11px] text-blue-100/70">
                Chunked streaming with zero memory spikes
              </p>
            </div>

            {/* Stat 2 */}
            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-extrabold text-emerald-300 font-mono tracking-tight">
                100%
              </div>
              <p className="text-xs font-semibold text-white">
                Engine Preview Parity
              </p>
              <p className="text-[11px] text-blue-100/70">
                Identical pipeline for draft and final output
              </p>
            </div>

            {/* Stat 3 */}
            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-extrabold text-amber-300 font-mono tracking-tight">
                0 Bytes
              </div>
              <p className="text-xs font-semibold text-white">
                Model Training / PII Leak
              </p>
              <p className="text-[11px] text-blue-100/70">
                Production logs sanitized of recipient rows
              </p>
            </div>

            {/* Stat 4 */}
            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-extrabold text-purple-300 font-mono tracking-tight">
                30 Days
              </div>
              <p className="text-xs font-semibold text-white">
                Auto-Purge Cloud Retention
              </p>
              <p className="text-[11px] text-blue-100/70">
                Instant link revocation &amp; physical cloud shred
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
