import React, { useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Printer,
  ArrowRight,
  House,
  MagnifyingGlass,
  EnvelopeSimple,
  ShieldCheck,
  FileText,
  Scales,
  X,
} from '@phosphor-icons/react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface LegalLayoutProps {
  title: string
  subtitle: string
  lastUpdated: string
  version: string
  activeDoc: 'terms' | 'privacy'
  sections: Array<{ id: string; title: string; number?: string | number }>
  children: React.ReactNode
}

const CURRENT_YEAR = new Date().getFullYear()

export function LegalLayout({
  title,
  subtitle,
  lastUpdated,
  version,
  activeDoc,
  sections,
  children,
}: LegalLayoutProps) {
  const { data: session } = authClient.useSession()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSectionId, setActiveSectionId] = useState<string>(
    sections[0]?.id || ''
  )

  // Scrollspy via IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSectionId(entry.target.id)
          }
        })
      },
      {
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0,
      }
    )

    sections.forEach(({ id }) => {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [sections])

  const filteredSections = sections.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-blue-100 selection:text-blue-900">
      {/* Print Stylesheet Overrides */}
      <style>{`
        @media print {
          .no-print, header, aside, footer {
            display: none !important;
          }
          body, .min-h-screen {
            background: white !important;
            color: black !important;
          }
          .print-full {
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Top Public Header */}
      <header className="no-print sticky top-0 z-40 w-full bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <div className="p-1 rounded-xl bg-white border border-slate-200/80 shadow-xs flex-none group-hover:scale-105 transition-transform">
                <img
                  src="/favicon.svg"
                  alt="EmitDocs"
                  className="w-7 h-7 rounded-lg"
                />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-slate-900">
                Emit<span className="text-blue-600">Docs</span>
              </span>
            </Link>
          </div>

          {/* Document Switcher Tabs (Terms ↔ Privacy) */}
          <nav className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 text-xs font-semibold">
            <Link
              to="/terms"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeDoc === 'terms'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Scales size={15} weight={activeDoc === 'terms' ? 'bold' : 'regular'} />
              <span>Terms of Service</span>
            </Link>
            <Link
              to="/privacy"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeDoc === 'privacy'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck size={15} weight={activeDoc === 'privacy' ? 'bold' : 'regular'} />
              <span>Privacy Policy</span>
            </Link>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border-slate-200 hover:bg-slate-100/80 rounded-xl"
            >
              <Printer size={15} weight="bold" />
              <span>Print / PDF</span>
            </Button>

            {session?.user ? (
              <Button
                asChild
                size="sm"
                className="rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                <Link to="/app" className="flex items-center gap-1.5">
                  <House size={14} weight="bold" />
                  <span>Go to App</span>
                  <ArrowRight size={14} weight="bold" />
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                size="sm"
                className="rounded-xl text-xs font-semibold bg-[#18181b] hover:bg-[#27272a] text-white shadow-sm"
              >
                <Link to="/sign-in" className="flex items-center gap-1.5">
                  <span>Sign In</span>
                  <ArrowRight size={14} weight="bold" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Sticky Sidebar (TOC) */}
          <aside className="no-print col-span-12 lg:col-span-4 xl:col-span-3 lg:sticky lg:top-24 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Contents
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {sections.length} sections
                </span>
              </div>

              {/* In-page Search / Filter */}
              <div className="relative">
                <label htmlFor="legal-filter-sections" className="sr-only">
                  Filter sections
                </label>
                <MagnifyingGlass
                  size={16}
                  weight="bold"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10 shrink-0"
                />
                <Input
                  id="legal-filter-sections"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter sections..."
                  className="w-full pl-10 pr-8 h-9 text-xs rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus-visible:ring-blue-500/20 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
                    aria-label="Clear filter"
                  >
                    <X size={13} weight="bold" />
                  </button>
                )}
              </div>

              {/* Navigation List */}
              <nav className="max-h-[calc(100vh-22rem)] overflow-y-auto space-y-1 pr-1 text-xs font-medium scrollbar-thin">
                {filteredSections.map((sec) => {
                  const isActive = activeSectionId === sec.id
                  return (
                    <a
                      key={sec.id}
                      href={`#${sec.id}`}
                      className={`group flex items-start gap-2 px-2.5 py-1.5 rounded-lg transition-all ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      {sec.number && (
                        <span
                          className={`font-mono text-[11px] shrink-0 ${
                            isActive ? 'text-blue-600 font-bold' : 'text-slate-400'
                          }`}
                        >
                          {sec.number}.
                        </span>
                      )}
                      <span className="line-clamp-1">{sec.title}</span>
                    </a>
                  )
                })}
                {filteredSections.length === 0 && (
                  <p className="text-xs text-slate-400 py-3 text-center">
                    No sections found.
                  </p>
                )}
              </nav>

              {/* Direct Support Inquiries */}
              <div className="pt-3 border-t border-slate-100 text-xs space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Questions &amp; Legal
                </div>
                <a
                  href={
                    activeDoc === 'terms'
                      ? 'mailto:legal@emitdocs.com'
                      : 'mailto:privacy@emitdocs.com'
                  }
                  className="inline-flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors font-medium text-xs"
                >
                  <EnvelopeSimple size={14} weight="bold" />
                  <span>
                    {activeDoc === 'terms' ? 'legal@emitdocs.com' : 'privacy@emitdocs.com'}
                  </span>
                </a>
              </div>
            </div>
          </aside>

          {/* Main Reading Content Area */}
          <main className="print-full col-span-12 lg:col-span-8 xl:col-span-9 bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-10 lg:p-12">
            {/* Document Header Banner */}
            <div className="pb-8 mb-8 border-b border-slate-100">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold mb-4 border border-slate-200/60">
                <FileText size={14} weight="bold" className="text-blue-600" />
                <span>EmitDocs Official Policy</span>
                <span className="text-slate-300">·</span>
                <span className="font-mono text-slate-500">{version}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-3">
                {title}
              </h1>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
                {subtitle}
              </p>

              <div className="flex flex-wrap items-center gap-4 mt-6 text-xs text-slate-400 font-medium">
                <div>
                  Effective: <span className="text-slate-600 font-semibold">{lastUpdated}</span>
                </div>
                <div>·</div>
                <div>
                  Last Updated: <span className="text-slate-600 font-semibold">{lastUpdated}</span>
                </div>
                <div>·</div>
                <div>
                  Governing Entity: <span className="text-slate-600 font-semibold">EmitDocs Platform</span>
                </div>
              </div>
            </div>

            {/* Document Body Sections */}
            <div className="divide-y divide-slate-100">{children}</div>
          </main>
        </div>
      </div>

      {/* Public Footer */}
      <footer className="no-print mt-auto bg-white border-t border-slate-200 py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="EmitDocs" className="w-5 h-5 rounded-md" />
            <span className="font-semibold text-slate-800">EmitDocs</span>
          </div>

          <div className="flex items-center gap-6 font-medium">
            <Link to="/terms" className="hover:text-blue-600 transition-colors">
              Terms of Service
            </Link>
            <Link to="/privacy" className="hover:text-blue-600 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/sign-in" className="hover:text-blue-600 transition-colors">
              Sign In
            </Link>
            <a
              href="mailto:legal@emitdocs.com"
              className="hover:text-blue-600 transition-colors"
            >
              Contact Legal
            </a>
          </div>

          <div>© {CURRENT_YEAR} EmitDocs. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}
