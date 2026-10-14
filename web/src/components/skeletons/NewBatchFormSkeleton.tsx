/**
 * @file NewBatchFormSkeleton.tsx
 * @description Form loading skeleton for new batch configuration and template selection.
 * @architecture Suspense boundary placeholder for the /app/batches/new route.
 */

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * @component NewBatchFormSkeleton
 * @description Renders placeholder inputs for batch name, template dropdown, and card selections.
 */
export function NewBatchFormSkeleton() {
  return (
    <div className="space-y-6 w-full">
      {/* Batch Name Input */}
      <div>
        <Skeleton className="h-3 w-24 rounded-md mb-2" />
        <Skeleton className="h-11 w-full rounded-xl border border-slate-200/80 dark:border-slate-800" />
      </div>

      {/* Template Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-36 rounded-md" />
          <Skeleton className="h-3 w-28 rounded-md" />
        </div>

        {/* Dropdown Select Menu Skeleton */}
        <Skeleton className="h-11 w-full rounded-xl border border-slate-200/80 dark:border-slate-800" />

        {/* Visual Template Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </div>
              <div className="flex items-center justify-between pt-1">
                <Skeleton className="h-3 w-20 rounded-md" />
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Submit Button */}
      <div className="pt-2 flex justify-end">
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>
    </div>
  );
}
