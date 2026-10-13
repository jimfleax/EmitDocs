import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "@phosphor-icons/react";
import { DefaultPageSkeleton } from "@/components/skeletons/DefaultPageSkeleton";
import { cn } from "@/lib/utils";

export type PageShellMaxWidth = "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "full";

const MAX_WIDTH_CLASSES: Record<PageShellMaxWidth, string> = {
  "2xl": "max-w-2xl mx-auto",
  "3xl": "max-w-3xl mx-auto",
  "4xl": "max-w-4xl mx-auto",
  "5xl": "max-w-5xl mx-auto",
  "6xl": "max-w-6xl mx-auto",
  full: "w-full",
};

export interface PageShellProps {
  /** Main page heading */
  title: React.ReactNode;
  /** Optional subtitle / description beneath the title */
  subtitle?: React.ReactNode;
  /**
   * Route path to navigate back to. When provided, a back-arrow button is
   * rendered to the left of the title. Omit on top-level dashboard pages where
   * navigation happens via the sidebar nav plane.
   */
  backTo?: string;
  /** Tooltip / aria-label for the back button. Defaults to "Go back". */
  backLabel?: string;
  /**
   * Optional slot rendered on the right side of the header bar, aligned with
   * the title row. Use for primary CTAs, search inputs, step indicators, etc.
   */
  actions?: React.ReactNode;
  /**
   * Maximum width constraint for the page body content.
   * When set to anything other than 'full', content is automatically centered via `mx-auto`.
   * Defaults to 'full'.
   */
  maxWidth?: PageShellMaxWidth;
  /**
   * Whether the page is currently in a loading state.
   * When true, preserves the full-width header and renders a centered LoadingState in the body.
   */
  isLoading?: boolean;
  /** Custom heading text for LoadingState when isLoading is true */
  loadingTitle?: string;
  /** Custom subtitle / description for LoadingState when isLoading is true */
  loadingDescription?: string;
  /** Optional dedicated skeleton component rendered when isLoading is true */
  skeleton?: React.ReactNode;
  /** Optional additional class names for the body container */
  contentClassName?: string;
  /** Page body content */
  children?: React.ReactNode;
}

/**
 * PageShell — standardised page-level layout used by every route inside `/app/*`.
 * Provides a 100% full-width header (optional back button + title + subtitle + actions slot)
 * separated from the body by a divider, and an architecturally centered body container.
 */
export function PageShell({
  title,
  subtitle,
  backTo,
  backLabel = "Go back",
  actions,
  maxWidth = "full",
  isLoading = false,
  loadingTitle: _loadingTitle,
  loadingDescription: _loadingDescription,
  skeleton,
  contentClassName,
  children,
}: PageShellProps) {
  return (
    <div className="flex flex-col w-full min-w-0 gap-8">
      {/* ── 100% Width Header Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-5 border-b border-slate-100 w-full min-w-0">
        {/* Left: back button + title stack */}
        <div className="flex items-start gap-3 min-w-0">
          {backTo && (
            <Link
              to={backTo}
              aria-label={backLabel}
              title={backLabel}
              className="mt-1 p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer select-none shrink-0"
            >
              <ArrowLeft size={20} weight="bold" />
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
              {title}
            </h1>
            {subtitle && (
              <div className="text-xs sm:text-sm text-slate-400 mt-1 font-normal leading-relaxed">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {/* Right: actions slot */}
        {actions && (
          <div className="flex items-center gap-3 shrink-0 sm:mt-1">
            {actions}
          </div>
        )}
      </div>

      {/* ── Body Container with Architectural Centering ─────────────────── */}
      <div
        className={cn(
          "w-full min-w-0",
          MAX_WIDTH_CLASSES[maxWidth],
          contentClassName,
        )}
      >
        {isLoading ? skeleton ? skeleton : <DefaultPageSkeleton /> : children}
      </div>
    </div>
  );
}
