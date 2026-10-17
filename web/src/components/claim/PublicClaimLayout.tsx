/**
 * @file PublicClaimLayout.tsx
 * @description Clean, mobile-first responsive container with EmitDocs header and trust badge.
 */

import { ShieldCheck } from "@phosphor-icons/react";

export interface PublicClaimLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function PublicClaimLayout({
  children,
  title,
  subtitle,
}: PublicClaimLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar */}
      <header className="max-w-xl w-full mx-auto flex items-center justify-between pb-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-extrabold flex items-center justify-center text-xs shadow-xs">
            ED
          </div>
          <span className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            EmitDocs
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium bg-white dark:bg-slate-900 px-2.5 py-1 rounded-full border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Secure Claim</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-xl w-full mx-auto">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-5 sm:p-8 space-y-6">
          {title && (
            <div className="text-center space-y-1">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {subtitle}
                </p>
              )}
            </div>
          )}

          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-xl w-full mx-auto text-center pt-8 pb-4 text-[11px] text-slate-400 space-y-1">
        <p>Protected by 256-bit Keyed Verifiers · Zero Plaintext Credential Storage</p>
        <p>Powered by EmitDocs</p>
      </footer>
    </div>
  );
}
