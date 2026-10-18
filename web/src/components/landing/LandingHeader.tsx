/**
 * @file LandingHeader.tsx
 * @description Fixed public navigation header for the EmitDocs homepage.
 * @architecture Supports smooth scroll anchor links, mobile navigation drawer, and dynamic auth state.
 * @agent_note Features sticky frosted-glass header with mobile drawer toggle and auth routing buttons.
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, House, List, X } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

/**
 * @component LandingHeader
 * @description Sticky header navigation bar with product anchor links and authentication action buttons.
 */
export function LandingHeader() {
  const { data: session } = authClient.useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-white/85 backdrop-blur-xl border-b border-slate-200/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between gap-4">
        {/* Brand Logo & Wordmark */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 group cursor-pointer"
          >
            <div className="p-1.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex-none group-hover:scale-105 group-hover:border-blue-400/80 transition-all duration-200">
              <img
                src="/favicon.svg"
                alt="EmitDocs"
                className="w-7 h-7 rounded-lg"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-slate-900 leading-none">
                Emit<span className="text-blue-600">Docs</span>
              </span>
              <span className="text-[10px] font-mono font-medium text-slate-400 tracking-wider uppercase mt-0.5 hidden sm:block">
                Document Automation
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
          <a
            href="#features"
            className="hover:text-blue-600 transition-colors cursor-pointer"
          >
            Features
          </a>
          <a
            href="#workflow"
            className="hover:text-blue-600 transition-colors cursor-pointer"
          >
            How It Works
          </a>
          <a
            href="#trust"
            className="hover:text-blue-600 transition-colors cursor-pointer"
          >
            Architecture &amp; Trust
          </a>
          <Link
            to="/privacy"
            className="hover:text-blue-600 transition-colors cursor-pointer"
          >
            Privacy
          </Link>
          <Link
            to="/terms"
            className="hover:text-blue-600 transition-colors cursor-pointer"
          >
            Terms
          </Link>
        </nav>

        {/* Auth Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          {session?.user ? (
            <Button
              asChild
              className="rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs px-5 h-10 transition-all active:scale-[0.98]"
            >
              <Link to="/app" className="flex items-center gap-2">
                <House size={16} weight="bold" />
                <span>Open Dashboard</span>
                <ArrowRight size={15} weight="bold" />
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              className="rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs px-5 h-10 transition-all active:scale-[0.98]"
            >
              <Link to="/sign-in" className="flex items-center gap-2">
                <span>Sign In</span>
                <ArrowRight size={15} weight="bold" />
              </Link>
            </Button>
          )}
        </div>

        {/* Mobile Menu Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          {session?.user ? (
            <Button
              asChild
              className="rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3.5 h-9"
            >
              <Link to="/app">Dashboard</Link>
            </Button>
          ) : (
            <Button
              asChild
              className="rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3.5 h-9"
            >
              <Link to="/sign-in">Sign In</Link>
            </Button>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} weight="bold" /> : <List size={20} weight="bold" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-xl px-4 py-5 space-y-3 shadow-lg">
          <nav className="flex flex-col space-y-3 text-sm font-semibold text-slate-700">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Features
            </a>
            <a
              href="#workflow"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              How It Works
            </a>
            <a
              href="#trust"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Architecture &amp; Trust
            </a>
            <Link
              to="/privacy"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Terms of Service
            </Link>
          </nav>
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {session?.user ? (
              <Button
                asChild
                className="w-full justify-center rounded-xl bg-blue-600 text-white font-semibold"
              >
                <Link to="/app" onClick={() => setMobileMenuOpen(false)}>
                  Open Dashboard
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                className="w-full justify-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                <Link to="/sign-in" onClick={() => setMobileMenuOpen(false)}>
                  Sign In
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
