/**
 * @file LandingFooter.tsx
 * @description Comprehensive brand footer for the EmitDocs platform.
 * @architecture Multi-column navigation with real links to legal docs, app features, and operational status.
 */

import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "@phosphor-icons/react";

const CURRENT_YEAR = new Date().getFullYear();

export function LandingFooter() {
  return (
    <footer className="bg-white border-t border-slate-200/90 pt-16 pb-12 text-slate-600 text-xs sm:text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Main 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Column (Span 2) */}
          <div className="lg:col-span-2 space-y-4">
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
              Turn existing PDF templates and spreadsheet data into thousands of personalized, review-ready documents at scale. Review every draft, spot clipping before generation, and export with confidence.
            </p>

            {/* System Status Indicator */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All Systems Operational</span>
              <span className="text-slate-300">·</span>
              <span className="font-mono text-slate-500 text-[11px]">v1.0.0</span>
            </div>
          </div>

          {/* Column 2: Platform */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Platform
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#features" className="hover:text-blue-600 transition-colors">
                  Visual PDF Studio
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-blue-600 transition-colors">
                  Batch Intake Engine
                </a>
              </li>
              <li>
                <a href="#workflow" className="hover:text-blue-600 transition-colors">
                  Draft Review Gallery
                </a>
              </li>
              <li>
                <a href="#workflow" className="hover:text-blue-600 transition-colors">
                  Streaming ZIP Archive
                </a>
              </li>
              <li>
                <Link to="/sign-in" className="hover:text-blue-600 transition-colors">
                  Google Single Sign-On
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Architecture & Security */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Architecture
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#features" className="hover:text-blue-600 transition-colors">
                  Sub-Pixel Coordinates
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-blue-600 transition-colors">
                  Fit-then-flag Algorithm
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-blue-600 transition-colors">
                  Cryptographic Snapshots
                </a>
              </li>
              <li>
                <a href="#trust" className="hover:text-blue-600 transition-colors">
                  Sanitized Production Logs
                </a>
              </li>
              <li>
                <a href="#trust" className="hover:text-blue-600 transition-colors">
                  Automated Cloud Retention
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Legal & Governance */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Trust &amp; Legal
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/terms" className="hover:text-blue-600 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-blue-600 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-blue-600 transition-colors flex items-center gap-1">
                  <span>Zero AI Model Training</span>
                  <ArrowUpRight size={11} />
                </Link>
              </li>
              <li>
                <a href="mailto:security@emitdocs.com" className="hover:text-blue-600 transition-colors">
                  Security Disclosures
                </a>
              </li>
              <li>
                <a href="mailto:privacy@emitdocs.com" className="hover:text-blue-600 transition-colors">
                  Contact Privacy Officer
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Attribution */}
        <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            © {CURRENT_YEAR} EmitDocs Platform. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <Link to="/terms" className="hover:text-slate-600 transition-colors">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-slate-600 transition-colors">
              Privacy
            </Link>
            <a
              href="mailto:support@emitdocs.com"
              className="hover:text-slate-600 transition-colors"
            >
              Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
