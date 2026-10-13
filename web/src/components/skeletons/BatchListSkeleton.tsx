import { Skeleton } from '@/components/ui/Skeleton';

export function BatchListSkeleton() {
  return (
    <div className="space-y-4 w-full animate-pulse">
      {/* Search and filters skeleton bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <Skeleton className="h-9 w-48 rounded-xl" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>

      {/* Batch rows skeleton list */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-2xl border border-slate-100 bg-white/70 shadow-2xs gap-4"
          >
            <div className="flex items-center gap-4 min-w-0 flex-1">
              {/* Icon badge skeleton */}
              <Skeleton className="w-11 h-11 rounded-xl shrink-0" />

              {/* Text content skeleton */}
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-4 w-40 sm:w-56 rounded-md" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-3 w-28 rounded-md" />
                  <Skeleton className="h-3 w-20 rounded-md" />
                  <Skeleton className="h-3 w-24 rounded-md" />
                </div>
              </div>
            </div>

            {/* Action buttons skeleton */}
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <Skeleton className="h-8 w-24 rounded-xl" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
