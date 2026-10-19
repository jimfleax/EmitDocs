/**
 * @file PublicClaimLayout.tsx
 * @description Clean, mobile-first responsive container with prominent EmitDocs branding.
 * @architecture Public claim interface layout wrapper providing consistent header chrome, ambient glows, and responsive margins.
 * @agent_note Mobile-first responsive wrapper with centered brand identity and footer security badges.
 */

export interface PublicClaimLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  maxWidth?: "xl" | "2xl" | "3xl";
}

/**
 * @component PublicClaimLayout
 * @description Responsive container shell wrapping public claim interface forms, previews, and notices.
 * @param {PublicClaimLayoutProps} props - Component properties.
 * @param {React.ReactNode} props.children - Child components and forms.
 * @param {string} [props.title] - Page title heading.
 * @param {string} [props.subtitle] - Explanatory subtitle.
 * @param {"xl" | "2xl" | "3xl"} [props.maxWidth="xl"] - Maximum width constraint.
 */
export function PublicClaimLayout({
  children,
  title,
  subtitle,
  maxWidth = "xl",
}: PublicClaimLayoutProps) {
  const maxWidthClass =
    maxWidth === "3xl"
      ? "max-w-3xl"
      : maxWidth === "2xl"
        ? "max-w-2xl"
        : "max-w-xl";

  return (
    <div className="relative min-h-screen bg-slate-50/80 dark:bg-slate-950 flex flex-col justify-between p-4 sm:p-6 overflow-hidden">
      {/* Ambient background glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[640px] h-80 bg-gradient-to-b from-blue-500/10 via-indigo-500/5 to-transparent blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-20 w-80 h-80 rounded-full bg-blue-500/10 dark:bg-blue-500/5 blur-3xl"
      />

      {/* Brand Header */}
      <header
        className={`${maxWidthClass} w-full mx-auto flex items-center justify-center pt-4 sm:pt-7 pb-6 sm:pb-8 z-10`}
      >
        <div className="inline-flex items-center gap-3 sm:gap-3.5 select-none">
          <div className="p-2 sm:p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm shadow-blue-500/5 flex-none transition-transform hover:scale-105">
            <img
              src="/favicon.svg"
              alt="EmitDocs"
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl"
            />
          </div>
          <span className="font-black text-2xl sm:text-3xl tracking-tight text-slate-900 dark:text-slate-100">
            Emit<span className="text-blue-600 dark:text-blue-500">Docs</span>
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className={`${maxWidthClass} w-full mx-auto z-10 my-auto`}>
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-black/40 p-6 sm:p-8 space-y-6">
          {title && (
            <div className="text-center space-y-1.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
                  {subtitle}
                </p>
              )}
            </div>
          )}

          {children}
        </div>
      </main>

      {/* Footer */}
      <footer
        className={`${maxWidthClass} w-full mx-auto text-center pt-8 pb-4 text-xs text-slate-400 dark:text-slate-500 space-y-1 z-10`}
      >
        <p className="flex items-center justify-center gap-1.5">
          <span>Powered by</span>
          <span className="font-bold text-slate-600 dark:text-slate-300">
            EmitDocs
          </span>
          <span>·</span>
          <span>Instant Document Delivery</span>
        </p>
      </footer>
    </div>
  );
}
