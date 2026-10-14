/**
 * @file DraftReviewSkeleton.tsx
 * @description Two-column loading skeleton for the draft review workspace and document preview pane.
 * @architecture Suspense boundary placeholder for the /app/batches/$batchId/review route.
 */

import { Skeleton } from "@/components/ui/Skeleton";
import { DraftGallerySkeleton } from "./DraftGallerySkeleton";

/**
 * @component DraftReviewSkeleton
 * @description Renders a side-by-side skeleton layout for the draft gallery list and PDF document preview pane.
 */
export function DraftReviewSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-225px)] min-h-[500px] w-full items-start">
      {/* Left Column: Draft Gallery (5 cols) */}
      <div className="lg:col-span-5 h-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col shadow-xs">
        {/* Search header placeholder */}
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800">
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>

        {/* Filter Pills placeholder */}
        <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto">
          <Skeleton className="h-6 w-14 rounded-lg" />
          <Skeleton className="h-6 w-14 rounded-lg" />
          <Skeleton className="h-6 w-16 rounded-lg" />
          <Skeleton className="h-6 w-16 rounded-lg" />
        </div>

        {/* List items */}
        <div className="flex-1 overflow-y-auto">
          <DraftGallerySkeleton count={7} />
        </div>
      </div>

      {/* Right Column: Preview & Inspector (7 cols) */}
      <div className="lg:col-span-7 h-full flex flex-col space-y-3 lg:sticky lg:top-4">
        {/* View Mode Switcher Skeleton */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl shadow-xs shrink-0">
          <div className="flex items-center gap-1">
            <Skeleton className="h-7 w-28 rounded-xl" />
            <Skeleton className="h-7 w-28 rounded-xl" />
          </div>
          <Skeleton className="h-7 w-24 rounded-xl" />
        </div>

        {/* Document Preview Viewport Placeholder */}
        <div className="flex-1 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 p-8 shadow-xs flex items-center justify-center overflow-hidden">
          <div className="max-w-md w-full aspect-[1/1.414] bg-white dark:bg-slate-900 rounded-lg shadow-md border border-slate-200/80 dark:border-slate-800 p-6 flex flex-col justify-between">
            <div className="space-y-3">
              <Skeleton className="h-5 w-32 rounded-md" />
              <Skeleton className="h-3.5 w-48 rounded-md" />
              <div className="pt-4 space-y-2">
                <Skeleton className="h-3 w-full rounded-md" />
                <Skeleton className="h-3 w-5/6 rounded-md" />
                <Skeleton className="h-3 w-4/6 rounded-md" />
              </div>
            </div>
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between">
              <Skeleton className="h-6 w-20 rounded-md" />
              <Skeleton className="h-6 w-20 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
