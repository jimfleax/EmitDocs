/**
 * @file OverflowBadge.tsx
 * @description Warning badge indicator signalling text overflow beyond template field boundaries.
 * @architecture Micro-indicator component used across draft review lists and detail cards.
 * @agent_note Flags that rendered text exceeds field dimensions and will be subject to shrink-to-fit or clipping.
 */

import { Warning } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface OverflowBadgeProps {
  className?: string;
  size?: "sm" | "md";
}

/**
 * @component OverflowBadge
 * @description Visual warning pill indicating text length exceeds field bounding box on the PDF canvas.
 * @param {OverflowBadgeProps} props - Component properties.
 * @returns {JSX.Element} Styled warning badge with tooltip description.
 */
export function OverflowBadge({ className, size = "sm" }: OverflowBadgeProps) {
  return (
    <Badge
      variant="warning"
      size={size}
      shape="rounded"
      className={cn(
        "inline-flex items-center gap-1 font-bold tracking-tight",
        className,
      )}
      title="Text exceeds field bounding box on PDF template. Content will shrink or clip."
    >
      <Warning className="w-3.5 h-3.5 text-amber-600 shrink-0" weight="fill" />
      <span>Text Overflow</span>
    </Badge>
  );
}
