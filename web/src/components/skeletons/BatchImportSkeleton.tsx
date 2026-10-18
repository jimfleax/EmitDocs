/**
 * @file BatchImportSkeleton.tsx
 * @description Loading skeleton for the batch spreadsheet import wizard.
 * @architecture Visual placeholder for step navigation, file dropzone, and mapping guidelines during async batch loading.
 * @agent_note Mirrors the step pills bar and file dropzone layout of the batch import page.
 */

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * @component BatchImportSkeleton
 * @description Renders a placeholder skeleton for the batch import stepper and dropzone.
 */
export function BatchImportSkeleton() {
  return (
    <div className="space-y-6 w-full">
      {/* Step Pills Bar */}
      <div className="flex items-center gap-2 pb-1">
        {[1, 2, 3, 4].map((step) => (
          <Skeleton key={step} className="h-6 w-20 rounded-full" />
        ))}
      </div>

      {/* Main Container Card */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-xs space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-48 rounded-md" />
          <Skeleton className="h-3.5 w-80 rounded-md" />
        </div>

        {/* Dropzone Container */}
        <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center space-y-3 bg-slate-50/50 dark:bg-slate-800/30">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <Skeleton className="h-4 w-52 rounded-md" />
          <Skeleton className="h-3 w-64 rounded-md" />
          <div className="pt-2">
            <Skeleton className="h-9 w-36 rounded-xl" />
          </div>
        </div>

        {/* Guidance / Download Sample Banner */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-40 rounded-md" />
            <Skeleton className="h-3 w-60 rounded-md" />
          </div>
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
