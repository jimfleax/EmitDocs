import { Skeleton } from "@/components/ui/Skeleton";

interface TemplateLibrarySkeletonProps {
  count?: number;
}

export function TemplateLibrarySkeleton({
  count = 8,
}: TemplateLibrarySkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 w-full">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col shadow-xs"
        >
          {/* Thumbnail Area matching aspect-[4/3] */}
          <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800/60 relative overflow-hidden p-3 flex flex-col justify-between border-b border-slate-100 dark:border-slate-800">
            {/* Top Badges */}
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-5 w-9 rounded-full bg-slate-200 dark:bg-slate-700" />
                <Skeleton className="h-5 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
              </div>
              <Skeleton className="h-5 w-14 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
            {/* Center icon / placeholder */}
            <div className="flex items-center justify-center py-2">
              <Skeleton className="h-10 w-10 rounded-xl bg-slate-200/80 dark:bg-slate-700/80" />
            </div>
            <div className="h-2" />
          </div>

          {/* Card Info & Actions */}
          <div className="p-4 flex-1 flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Skeleton className="h-3 w-1/3 rounded-md" />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100/80 dark:border-slate-800">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
