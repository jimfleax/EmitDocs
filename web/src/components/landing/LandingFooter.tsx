/**
 * @file LandingFooter.tsx
 * @description Comprehensive brand footer for the EmitDocs platform with creator branding.
 * @architecture Consolidated single navigation column with dedicated Jim Fleax developer profile.
 * @agent_note Displays brand copyright, consolidated navigation links, and creator socials/portfolio.
 */

import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  GithubLogo,
  LinkedinLogo,
  XLogo,
  EnvelopeSimple,
  Globe,
} from "@phosphor-icons/react";
import { CONTACT_MAILTO } from "@/lib/contact";

const CURRENT_YEAR = new Date().getFullYear();

/**
 * @component LandingFooter
 * @description Consolidated website footer containing single-column navigation links and creator branding card.
 */
export function LandingFooter() {
  return (
    <footer className="bg-white border-t border-slate-200/90 pt-16 pb-12 text-slate-600 text-xs sm:text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Main 3-Section Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Brand Column (Span 5) */}
          <div className="lg:col-span-5 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <div className="p-1.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex-none group-hover:scale-105 transition-transform">
                <img
                  src="/favicon.svg"
                  alt="EmitDocs"
                  className="w-7 h-7 rounded-lg"
                />
              </div>
              <span className="font-extrabold text-2xl tracking-tight text-slate-900">
                Emit<span className="text-blue-600">Docs</span>
              </span>
            </Link>

            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed max-w-sm">
              Turn existing PDF templates and spreadsheet data into thousands of
              personalized, review-ready documents at scale. Review every draft,
              spot clipping before generation, and export with confidence.
            </p>

            {/* System Status Indicator */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All Systems Operational</span>
              <span className="text-slate-300">·</span>
              <span className="font-mono text-slate-500 text-[11px]">
                v1.0.0
              </span>
            </div>
          </div>

          {/* Consolidated Navigation Column (Span 3) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Platform Navigation
            </h4>
            <ul className="space-y-2.5 text-xs font-medium">
              <li>
                <a
                  href="#features"
                  className="hover:text-blue-600 transition-colors"
                >
                  Platform Features
                </a>
              </li>
              <li>
                <a
                  href="#workflow"
                  className="hover:text-blue-600 transition-colors"
                >
                  How It Works
                </a>
              </li>
              <li>
                <a
                  href="#trust"
                  className="hover:text-blue-600 transition-colors"
                >
                  Architecture &amp; Trust
                </a>
              </li>
              <li>
                <Link
                  to="/privacy"
                  className="hover:text-blue-600 transition-colors"
                >
                  Privacy Policy (Zero Model Training)
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="hover:text-blue-600 transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <a
                  href={CONTACT_MAILTO.security}
                  className="hover:text-blue-600 transition-colors"
                >
                  Security &amp; Compliance Disclosures
                </a>
              </li>
            </ul>
          </div>

          {/* Creator & Developer Branding Section (Span 4) */}
          <div className="lg:col-span-4">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs space-y-3.5">
              <div className="flex items-center gap-3">
                <img
                  src="/branding/jimfleax.png"
                  alt="Reetabrata Bhandari (Jim Fleax)"
                  className="w-12 h-12 rounded-xl border border-slate-200/90 shadow-2xs object-cover flex-none"
                />
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-slate-900 leading-tight">
                    Reetabrata Bhandari
                  </h4>
                  <span className="text-[11px] font-mono text-blue-600 font-medium block mt-0.5">
                    Jim Fleax · Full-Stack Developer
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Creator of EmitDocs. Focused on building high-precision document
                engines, responsive web systems, and production web
                applications.
              </p>

              <div className="pt-1 flex flex-wrap items-center gap-2">
                <a
                  href="https://jimfleax.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors"
                >
                  <Globe size={14} weight="bold" />
                  <span>jimfleax.in</span>
                  <ArrowUpRight size={12} weight="bold" />
                </a>

                <div className="flex items-center gap-1.5 text-slate-600">
                  <a
                    href="https://github.com/jimfleax"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="GitHub Profile"
                    className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <GithubLogo size={16} weight="bold" />
                  </a>
                  <a
                    href="https://www.linkedin.com/in/jimfleax"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="LinkedIn Profile"
                    className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 hover:text-blue-600 transition-colors"
                  >
                    <LinkedinLogo size={16} weight="bold" />
                  </a>
                  <a
                    href="https://x.com/jimfleax"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="X (Twitter) Profile"
                    className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <XLogo size={16} weight="bold" />
                  </a>
                  <a
                    href={CONTACT_MAILTO.creator}
                    aria-label="Email Jim Fleax"
                    className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 hover:text-rose-600 transition-colors"
                  >
                    <EnvelopeSimple size={16} weight="bold" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Attribution */}
        <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>© {CURRENT_YEAR} EmitDocs Platform. All rights reserved.</div>
          <div className="flex items-center gap-6">
            <Link
              to="/terms"
              className="hover:text-slate-600 transition-colors"
            >
              Terms
            </Link>
            <Link
              to="/privacy"
              className="hover:text-slate-600 transition-colors"
            >
              Privacy
            </Link>
            <a
              href={CONTACT_MAILTO.support}
              className="hover:text-slate-600 transition-colors"
            >
              Support
            </a>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">
              Crafted by{" "}
              <a
                href="https://jimfleax.in"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 font-medium"
              >
                Jim Fleax
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
