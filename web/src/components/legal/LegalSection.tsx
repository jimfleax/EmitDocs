/**
 * @file LegalSection.tsx
 * @description Policy section container with numbered headings, anchor deep-links, and plain-English TL;DR callouts.
 * @architecture Reusable statutory legal clause wrapper used inside LegalLayout.
 */

import React from "react";
import { LinkSimple, Info } from "@phosphor-icons/react";

export interface LegalSectionProps {
  id: string;
  sectionNumber?: string | number;
  title: string;
  tldr?: string;
  children: React.ReactNode;
}

/**
 * @component LegalSection
 * @description Formats a single policy clause with anchor link, summary box, and body paragraphs.
 * @param {LegalSectionProps} props - Component properties.
 * @param {string} props.id - HTML section id for deep-linking.
 * @param {string | number} [props.sectionNumber] - Numeric section prefix.
 * @param {string} props.title - Section title.
 * @param {string} [props.tldr] - Plain English summary callout text.
 */
export function LegalSection({
  id,
  sectionNumber,
  title,
  tldr,
  children,
}: LegalSectionProps) {
  return (
    <section
      id={id}
      className="scroll-mt-28 py-8 first:pt-2 border-b border-slate-100 last:border-b-0"
    >
      {/* Section Header */}
      <div className="group flex items-baseline gap-2 mb-4">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-baseline gap-2">
          {sectionNumber && (
            <span className="text-blue-600 font-mono text-lg sm:text-xl font-semibold">
              {sectionNumber}.
            </span>
          )}
          <span>{title}</span>
        </h2>
        <a
          href={`#${id}`}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600 p-1"
          aria-label={`Link to section: ${title}`}
        >
          <LinkSimple size={18} weight="bold" />
        </a>
      </div>

      {/* TL;DR Plain English Callout Box */}
      {tldr && (
        <div className="relative overflow-hidden rounded-2xl bg-blue-50/70 border border-blue-100 p-4 sm:p-5 mb-6 text-sm text-slate-800 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]">
          <div className="flex items-start gap-3">
            <div className="p-1 rounded-lg bg-blue-600 text-white shrink-0 mt-0.5">
              <Info size={16} weight="bold" />
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-xs uppercase tracking-wider text-blue-700">
                Summary (TL;DR)
              </div>
              <p className="text-slate-700 leading-relaxed font-normal">
                {tldr}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Statutory Legal Clause Body */}
      <div className="text-slate-700 leading-relaxed text-sm sm:text-base space-y-4 font-normal">
        {children}
      </div>
    </section>
  );
}
