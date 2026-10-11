import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  DotsThree,
  Plus,
  Certificate,
  Medal,
  FileText,
  Stamp,
  CheckCircle,
  Files,
} from '@phosphor-icons/react'

export const Route = createFileRoute('/_protected/app/')({
  component: AppIndexRoute,
})

// Mock collaborator avatars for the header
const COLLABORATORS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96&h=96&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&fit=crop&crop=faces',
]

// Minimalist activity bar chart data (24 bars matching Figma)
const ACTIVITY_BARS = [
  { height: 28, isHighlight: false },
  { height: 42, isHighlight: false },
  { height: 20, isHighlight: false },
  { height: 35, isHighlight: false },
  { height: 24, isHighlight: false },
  { height: 18, isHighlight: false },
  { height: 32, isHighlight: false },
  { height: 22, isHighlight: false },
  { height: 45, isHighlight: false },
  { height: 38, isHighlight: false },
  { height: 26, isHighlight: false },
  { height: 16, isHighlight: false },
  { height: 30, isHighlight: false },
  { height: 40, isHighlight: false },
  { height: 28, isHighlight: false },
  { height: 34, isHighlight: false },
  { height: 48, isHighlight: false },
  { height: 36, isHighlight: false },
  { height: 25, isHighlight: false },
  { height: 42, isHighlight: false },
  { height: 75, isHighlight: true }, // Highlighted bar
  { height: 38, isHighlight: false },
  { height: 45, isHighlight: false },
]

function AppIndexRoute() {
  const [dateRange] = useState('01 - 25 Oct, 2026')

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-10">
      {/* ======================================================== */}
      {/* Left Main Column: Title, Activity Chart, Grouped Batches */}
      {/* ======================================================== */}
      <div className="xl:col-span-8 space-y-8">
        {/* Header: Page Title, Date Range & Collaborator Avatars */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Batches & Issuance
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
              {dateRange}
            </p>
          </div>

          {/* Collaborator Avatars & Add Button */}
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2 overflow-hidden">
              {COLLABORATORS.map((avatar, idx) => (
                <img
                  key={idx}
                  src={avatar}
                  alt="Team member"
                  className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover"
                />
              ))}
            </div>
            <button
              type="button"
              title="Add Team Member"
              className="h-8 w-8 rounded-full border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 flex items-center justify-center transition-colors cursor-pointer select-none"
            >
              <Plus size={14} weight="bold" />
            </button>
          </div>
        </div>

        {/* Minimalist Activity Bar Chart (Figma Style) */}
        <div className="pt-2 pb-4">
          <div className="h-24 flex items-end justify-between gap-1 sm:gap-2 px-1">
            {ACTIVITY_BARS.map((bar, i) => (
              <div
                key={i}
                className="flex-1 flex items-end justify-center h-full group cursor-pointer"
              >
                <div
                  style={{ height: `${bar.height}%` }}
                  className={`w-full max-w-[14px] rounded-t-sm transition-all duration-300 ${
                    bar.isHighlight
                      ? 'bg-blue-600 group-hover:bg-blue-700 shadow-sm'
                      : 'bg-blue-100/90 group-hover:bg-blue-200'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ======================================================== */}
        {/* Grouped Activity Rows (Figma Grouped List Style)          */}
        {/* ======================================================== */}
        <div className="space-y-6">
          {/* Group 1: Today */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Today
              </span>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <DotsThree size={20} weight="bold" />
              </button>
            </div>

            <div className="space-y-2">
              {/* Row 1 */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-50/80 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-sky-500 text-white flex items-center justify-center flex-none shadow-xs">
                    <Certificate size={20} weight="bold" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 leading-tight">
                      Annual Graduation Degrees
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      5:12 pm · 1,420 recipients
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-900">
                    +1,420
                  </span>
                </div>
              </div>

              {/* Row 2 */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-50/80 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center flex-none shadow-xs">
                    <Medal size={20} weight="bold" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 leading-tight">
                      Leadership Excellence Badges
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      3:45 pm · 250 recipients
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-900">
                    +250
                  </span>
                </div>
              </div>

              {/* Row 3 */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-50/80 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center flex-none shadow-xs">
                    <FileText size={20} weight="bold" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 leading-tight">
                      Q3 Professional Certifications
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      11:20 am · 85 recipients
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-900">
                    +85
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Group 2: Monday, 23 Oct 2026 */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Monday, 23 Oct 2026
              </span>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <DotsThree size={20} weight="bold" />
              </button>
            </div>

            <div className="space-y-2">
              {/* Row 4 */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-50/80 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center flex-none shadow-xs">
                    <Stamp size={20} weight="bold" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 leading-tight">
                      Alumni Lifetime Credentials
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      4:15 pm · 630 recipients
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-900">
                    +630
                  </span>
                </div>
              </div>

              {/* Row 5 */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-50/80 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-none shadow-xs">
                    <CheckCircle size={20} weight="bold" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 leading-tight">
                      Cybersecurity Workshop Passes
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      1:30 pm · 112 recipients
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-900">
                    +112
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* Right Column: Category Progress Bars & Quick Start Card   */}
      {/* ======================================================== */}
      <div className="xl:col-span-4 flex flex-col justify-between space-y-8 pt-2 xl:pt-0 xl:border-l xl:border-slate-100 xl:pl-8">
        {/* Category Breakdown Progress Bars */}
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-900">
              Issuance by Category
            </h2>
          </div>

          <div className="space-y-5">
            {/* Category 1: Certificates */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-800">Certificates</span>
                <span className="text-slate-500 font-mono">1,820</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: '84%' }}
                />
              </div>
            </div>

            {/* Category 2: Badges */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-800">Badges</span>
                <span className="text-slate-500 font-mono">940</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: '62%' }}
                />
              </div>
            </div>

            {/* Category 3: Transcripts */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-800">Transcripts</span>
                <span className="text-slate-500 font-mono">510</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: '45%' }}
                />
              </div>
            </div>

            {/* Category 4: Diplomas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-800">Diplomas</span>
                <span className="text-slate-500 font-mono">280</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: '30%' }}
                />
              </div>
            </div>

            {/* Category 5: Licenses */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-800">Licenses</span>
                <span className="text-slate-500 font-mono">140</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full"
                  style={{ width: '18%' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action Helper Card (Figma Bottom Promo Card) */}
        <div className="rounded-2xl bg-slate-50/90 border border-slate-100 p-6 space-y-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100/70 text-blue-600 flex items-center justify-center">
            <Files size={24} weight="duotone" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-900">
              Automate Bulk Issuance
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upload recipient data via CSV and generate individualized credentials in minutes.
            </p>
          </div>

          <button
            type="button"
            className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-900 active:scale-[0.98] text-white font-semibold text-xs tracking-wide transition-all shadow-sm cursor-pointer select-none"
          >
            QUICK START GUIDE
          </button>
        </div>
      </div>
    </div>
  )
}
