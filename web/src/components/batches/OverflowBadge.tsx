import { Warning } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface OverflowBadgeProps {
  className?: string;
  size?: "sm" | "md";
}

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
