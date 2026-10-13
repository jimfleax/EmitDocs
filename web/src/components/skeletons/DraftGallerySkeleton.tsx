import { Skeleton } from '@/components/ui/Skeleton';

interface DraftGallerySkeletonProps {
  count?: number;
}

export function DraftGallerySkeleton({ count = 6 }: DraftGallerySkeletonProps) {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800 w-full">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between p-3.5 text-xs select-none"
        >
          {/* Left: Indicator, Row Number & Name */}
          <div className="flex items-center gap-3 min-w-0 pr-2">
            {/* Status dot */}
            <Skeleton className="w-2 h-2 rounded-full shrink-0" />

            {/* Row Number */}
            <Skeleton className="h-3.5 w-6 rounded-md shrink-0" />

            {/* Primary text and email */}
            <div className="space-y-1.5 min-w-0">
              <Skeleton className="h-3.5 w-28 rounded-md" />
              <Skeleton className="h-2.5 w-36 rounded-md" />
            </div>
          </div>

          {/* Right: Badges */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
