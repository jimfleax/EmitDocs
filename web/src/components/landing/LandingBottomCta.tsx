/**
 * @file LandingBottomCta.tsx
 * @description High-contrast bottom call-to-action banner styled in EmitDocs's signature deep sapphire-navy canvas.
 * @architecture Deep navy container matching AppShell with ambient radial glows and Google OAuth entry point.
 * @agent_note Displays dynamic CTA buttons depending on whether a user session is active.
 */

import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  House,
} from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

/**
 * @component LandingBottomCta
 * @description Bottom conversion banner inviting new users to get started or return to their dashboard.
 */
export function LandingBottomCta() {
  const { data: session } = authClient.useSession();

  return (
    <section className="py-16 sm:py-24 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl lg:rounded-[32px] bg-[rgb(16_60_133)] text-white p-8 sm:p-14 lg:p-20 overflow-hidden shadow-[0_25px_60px_-15px_rgba(16,60,133,0.4)] border border-white/20">
          {/* Ambient Glow Flares */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-400/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-indigo-400/25 blur-3xl"
          />

          <div className="relative z-10 max-w-3xl mx-auto text-center space-y-8">
            {/* Headline & Pitch */}
            <div className="space-y-4">
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                One template. Every recipient. <br />
                <span className="text-blue-200">Ready to go.</span>
              </h2>
              <p className="text-base sm:text-lg text-blue-100/80 max-w-xl mx-auto leading-relaxed">
                Connect your existing PDF template, upload your spreadsheet, and
                generate high-fidelity, verified documents with zero manual
                busywork.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              {session?.user ? (
                <Button
                  asChild
                  size="lg"
                  className="w-full sm:w-auto h-12 px-8 rounded-2xl bg-white hover:bg-slate-100 text-blue-900 font-bold text-sm shadow-lg transition-all active:scale-[0.98]"
                >
                  <Link to="/app" className="flex items-center gap-2">
                    <House size={18} weight="bold" />
                    <span>Go to Your Dashboard</span>
                    <ArrowRight size={16} weight="bold" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button
                    asChild
                    size="lg"
                    className="w-full sm:w-auto h-12 px-8 rounded-2xl bg-white hover:bg-slate-100 text-blue-900 font-bold text-sm shadow-lg transition-all active:scale-[0.98]"
                  >
                    <Link to="/sign-in" className="flex items-center gap-2">
                      <span>Get Started with Google</span>
                      <ArrowRight size={16} weight="bold" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    className="w-full sm:w-auto h-12 px-7 rounded-2xl bg-white/15 hover:bg-white/25 border-2 border-white/40 hover:border-white text-white font-bold text-sm backdrop-blur-md shadow-sm transition-all active:scale-[0.98]"
                  >
                    <a href="#features">Explore Features</a>
                  </Button>
                </>
              )}
            </div>

            {/* Trust Markers */}
            <div className="pt-6 border-t border-white/15 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-blue-100/70 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle
                  size={15}
                  weight="fill"
                  className="text-blue-300"
                />
                <span>No credit card required</span>
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck
                  size={15}
                  weight="fill"
                  className="text-blue-300"
                />
                <span>Zero AI model training</span>
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle
                  size={15}
                  weight="fill"
                  className="text-blue-300"
                />
                <span>Automated 24h/7d/30d retention purge</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
