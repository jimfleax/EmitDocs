import { Skeleton } from '@/components/ui/Skeleton';

export function PdfMappingWorkspaceSkeleton() {
  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100 dark:bg-slate-950 flex flex-col rounded-3xl lg:rounded-[28px] select-none">
      {/* Top-Left Back Button Skeleton */}
      <div className="absolute top-3 left-3 z-40">
        <Skeleton className="h-8 w-28 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 shadow-md" />
      </div>

      {/* Floating Top Toolbar Skeleton */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 shadow-lg">
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-7 w-7 rounded-lg" />
        <Skeleton className="h-7 w-7 rounded-lg" />
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
        <Skeleton className="h-7 w-24 rounded-lg" />
        <Skeleton className="h-7 w-16 rounded-lg" />
      </div>

      {/* Main Studio Area */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-hidden relative">
        {/* Floating Left Panel (Tokens/Fields) */}
        <div className="absolute left-4 top-16 bottom-16 w-64 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-md p-4 hidden xl:flex flex-col space-y-3 z-20">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-8 w-full rounded-xl" />
          <div className="space-y-2 pt-2 flex-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-9 w-full rounded-xl" />
            ))}
          </div>
        </div>

        {/* Center Canvas: PDF Paper Sheet Wireframe */}
        <div className="max-w-lg w-full aspect-[1/1.414] bg-white dark:bg-slate-900 rounded-lg shadow-md border border-slate-200/80 dark:border-slate-800 p-8 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <Skeleton className="h-6 w-32 rounded-md" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-3/4 rounded-md" />
            <Skeleton className="h-4 w-1/2 rounded-md" />
            <div className="pt-6 space-y-2">
              <Skeleton className="h-3.5 w-full rounded-md" />
              <Skeleton className="h-3.5 w-5/6 rounded-md" />
              <Skeleton className="h-3.5 w-4/6 rounded-md" />
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-8 w-28 rounded-md" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-8 w-28 rounded-md" />
            </div>
          </div>
        </div>

        {/* Floating Right Panel (Properties) */}
        <div className="absolute right-4 top-16 bottom-16 w-72 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-md p-4 hidden lg:flex flex-col space-y-3 z-20">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-7 w-full rounded-lg" />
          <div className="space-y-3 pt-3 flex-1">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
