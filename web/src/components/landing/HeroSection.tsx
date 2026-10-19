/**
 * @file HeroSection.tsx
 * @description Hero section featuring the authoritative value proposition, primary CTAs, and interactive workflow canvas.
 * @architecture Clean SaaS typographic hierarchy with ambient radial backdrops and live micro-app centerpiece.
 * @agent_note Connects directly with Better Auth session state to dynamically alter primary CTA between Sign In and Dashboard.
 */

import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Lightning,
  House,
  Stack,
  FileText,
} from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { HeroWorkflowPreview } from "./HeroWorkflowPreview";

/**
 * @component HeroSection
 * @description Hero billboard component highlighting the core product proposition, auth CTAs, and interactive workspace demo.
 */
export function HeroSection() {
  const { data: session } = authClient.useSession();

  return (
    <section className="relative pt-12 sm:pt-20 pb-16 sm:pb-24 overflow-hidden">
      {/* Ambient Canvas Background Glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[450px] rounded-full bg-blue-400/15 blur-3xl -z-10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-40 right-10 w-[500px] h-[350px] rounded-full bg-indigo-400/10 blur-3xl -z-10"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 sm:space-y-16">
        {/* Hero Narrative & Action Controls */}
        <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8">
          {/* Master Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.08]">
            One template. <br className="hidden sm:inline" />
            Every recipient. <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600 bg-clip-text text-transparent">
              Ready to go.
            </span>
          </h1>

          {/* Clear, Zero-Fluff Value Proposition Subheadline */}
          <p className="text-base sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto font-normal">
            Turn your PDF template and spreadsheet into thousands of
            personalized, review-ready documents. Spot clipping issues before
            generation, apply non-destructive overrides, and export verified
            PDFs at scale.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 pt-2">
            {session?.user ? (
              <Button
                asChild
                size="lg"
                className="w-full sm:w-auto h-12 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-[0_10px_25px_-8px_rgba(37,99,235,0.4)] transition-all active:scale-[0.98]"
              >
                <Link to="/app" className="flex items-center gap-2">
                  <House size={18} weight="bold" />
                  <span>Continue to Your Dashboard</span>
                  <ArrowRight size={16} weight="bold" />
                </Link>
              </Button>
            ) : (
              <>
                <Button
                  asChild
                  size="lg"
                  className="w-full sm:w-auto h-12 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-[0_10px_25px_-8px_rgba(37,99,235,0.4)] transition-all active:scale-[0.98]"
                >
                  <Link to="/sign-in" className="flex items-center gap-2">
                    <span>Start Issuing Free</span>
                    <ArrowRight size={16} weight="bold" />
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto h-12 px-6 rounded-2xl border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-semibold text-sm transition-all"
                >
                  <a href="#workflow" className="flex items-center gap-2">
                    <span>See How It Works</span>
                  </a>
                </Button>
              </>
            )}
          </div>

          {/* Trust Highlights */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-5 sm:gap-8 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle
                size={15}
                weight="fill"
                className="text-emerald-500"
              />
              <span>No credit card required</span>
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={15} weight="fill" className="text-blue-600" />
              <span>Zero AI model training</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle
                size={15}
                weight="fill"
                className="text-emerald-500"
              />
              <span>100% Draft-to-Output Parity</span>
            </span>
          </div>
        </div>

        {/* Centerpiece: Interactive Micro-App Live Workflow Canvas */}
        <div className="relative pt-4">
          <HeroWorkflowPreview />
        </div>

        {/* Feature Badges Grid Underneath Hero */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 pt-4 max-w-5xl mx-auto">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <FileText size={18} weight="bold" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">
                Sub-Pixel Snapping
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                Fit-then-flag safety
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Stack size={18} weight="bold" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">
                5,000+ Recipients
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                Chunked CSV &amp; XLSX
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck size={18} weight="bold" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">
                SHA-256 Snapshots
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                Tamper-proof approval
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Lightning size={18} weight="bold" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">
                Streaming ZIP
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                125+ PDFs / second
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
