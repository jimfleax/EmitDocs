/**
 * @file TemplateDetailsSkeleton.tsx
 * @description Loading skeleton for the template details and version history screen.
 * @architecture Suspense fallback for the /app/templates/$templateId route.
 * @agent_note Wireframes the document preview card and version history list on the template details screen.
 */

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * @component TemplateDetailsSkeleton
 * @description Renders a two-column layout skeleton for document preview card and version history list.
 */
export function TemplateDetailsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
      {/* Left Column: Preview Card */}
      <div className="md:col-span-1 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-3">
        <Skeleton className="h-3 w-28 rounded-md" />
        <div className="aspect-[3/4] rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex flex-col justify-between items-center p-6">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2 w-full flex flex-col items-center">
            <Skeleton className="h-3 w-1/2 rounded-md" />
            <Skeleton className="h-2.5 w-1/3 rounded-md" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>

      {/* Right Column: Version History & Metadata */}
      <div className="md:col-span-2 space-y-6">
        {/* Template Information Card */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
          <Skeleton className="h-4 w-36 rounded-md" />
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-2">
              <Skeleton className="h-3 w-12 rounded-md" />
              <Skeleton className="h-5 w-8 rounded-md" />
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-2">
              <Skeleton className="h-3 w-14 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
          </div>
        </div>

        {/* Version History Card */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-3 w-16 rounded-md" />
          </div>

          <div className="space-y-2">
            {[1, 2, 3].map((ver) => (
              <div
                key={ver}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40"
              >
                <div className="flex items-center gap-2.5">
                  <Skeleton className="w-7 h-7 rounded-lg" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-20 rounded-md" />
                    <Skeleton className="h-2.5 w-32 rounded-md" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-10 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
