/**
 * @file Skeleton.tsx
 * @description Animated pulsing placeholder primitive for loading placeholders and content mockups.
 * @architecture Base design system primitive for building composite skeleton screens.
 * @agent_note Marked with aria-hidden="true" to prevent redundant screen reader announcements while content loads.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * @component Skeleton
 * @description Pulsing placeholder box matching dimensions of loading content.
 * @param {SkeletonProps} props - Native HTML div element attributes.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-800",
        className,
      )}
      {...props}
    />
  );
}
