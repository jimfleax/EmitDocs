/**
 * @file TrustAndSecurity.tsx
 * @description Enterprise security, data privacy, and zero-model-training compliance overview.
 * @architecture Highlights GDPR/CCPA readiness, log sanitization, and automated retention mechanics.
 * @agent_note Details technical guarantees including strict short-lived TTLs, AES-256 storage, and zero model training.
 */

import {
  ShieldCheck,
  LockKey,
  Database,
  Trash,
  FileText,
  ArrowRight,
  EyeSlash,
  CheckCircle,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";

/**
 * @component TrustAndSecurity
 * @description Showcase section summarizing privacy commitments, encryption safeguards, and compliance standards.
 */
export function TrustAndSecurity() {
  const securityPillars = [
    {
      icon: <EyeSlash size={22} weight="bold" className="text-blue-600" />,
      title: "Zero Model Training Policy",
      description:
        "Your document artwork, font files, recipient datasets, and issued credentials are never used to train, retrain, or fine-tune foundational AI/ML models.",
      badge: "Confidentiality First",
    },
    {
      icon: <Database size={22} weight="bold" className="text-purple-600" />,
      title: "Production Log Sanitization",
      description:
        "All telemetry, worker runtimes, and application error logs are programmatically scrubbed. Under no circumstances are raw recipient rows or signed storage URLs persisted in logs.",
      badge: "PII Sanitized",
    },
    {
      icon: <Trash size={22} weight="bold" className="text-rose-600" />,
      title: "Deterministic Cloud Retention",
      description:
        "Batch issuance jobs enforce strict 24-hour, 7-day, or 30-day lifecycle presets. Access is revoked instantly at expiration, followed by physical object erasure.",
      badge: "Automated Purge",
    },
    {
      icon: <LockKey size={22} weight="bold" className="text-emerald-600" />,
      title: "GDPR & CCPA/CPRA Compliant",
      description:
        "Built-in compliance with EU/UK GDPR Articles 15–22 and CCPA requirements. We never sell personal information or share data with cross-context behavioral ad brokers.",
      badge: "Non-Sale Certified",
    },
  ];

  return (
    <section id="trust" className="py-20 sm:py-28 relative scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-semibold">
            <ShieldCheck size={14} weight="fill" />
            <span>Architecture &amp; Data Governance</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Privacy by design. <br />
            <span className="text-blue-600">
              Trust earned through architecture.
            </span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Organizations and educators process confidential records. EmitDocs
            enforces strict tenant isolation, ephemeral storage, and
            comprehensive compliance.
          </p>
        </div>

        {/* 4 Security Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {securityPillars.map((pillar, index) => (
            <div
              key={index}
              className="rounded-3xl bg-white border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-4 hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 shadow-2xs">
                    {pillar.icon}
                  </div>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                    {pillar.badge}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-slate-900">
                  {pillar.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {pillar.description}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center text-xs text-slate-500 font-medium">
                <CheckCircle
                  size={14}
                  weight="fill"
                  className="text-emerald-500 mr-1.5"
                />
                <span>Audited in official documentation</span>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Banner Callout */}
        <div className="rounded-3xl bg-slate-50 border border-slate-200 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-base font-bold text-slate-900">
              Read our full Privacy Policy &amp; Security Addendum
            </h4>
            <p className="text-xs sm:text-sm text-slate-500">
              Includes our vetted subprocessor directory, retention state
              machines, and Data Protection Officer contacts.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/privacy"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 hover:text-blue-600 hover:border-blue-300 shadow-2xs transition-all"
            >
              <FileText size={15} weight="bold" />
              <span>Review Privacy Policy</span>
              <ArrowRight size={13} weight="bold" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
