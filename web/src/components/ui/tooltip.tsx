/**
 * @file tooltip.tsx
 * @description Lightweight hover and focus tooltip component rendered via document portal.
 * @architecture Computes anchor bounding rects on hover/focus and projects floating tooltips into document.body with collision avoidance.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface TooltipProps {
  content?: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  contentClassName?: string;
  asChild?: boolean;
  delayDuration?: number;
  children: React.ReactNode;
}

/**
 * @component Tooltip
 * @description Floating tooltip bubble triggered on hover or focus with configurable delay and positioning.
 * @param {TooltipProps} props - Component properties.
 * @param {React.ReactNode} props.content - Tooltip text or node content.
 * @param {React.ReactNode} props.children - Target element that triggers the tooltip.
 * @param {"top" | "right" | "bottom" | "left"} [props.side="top"] - Placement side.
 * @param {"start" | "center" | "end"} [props.align="center"] - Alignment along the chosen side.
 * @param {number} [props.delayDuration=200] - Delay in milliseconds before showing tooltip.
 * @state Manages visibility timer and viewport pixel coordinates.
 */
const Tooltip = ({
  content,
  children,
  side = "top",
  align = "center",
  sideOffset = 4,
  contentClassName,
  delayDuration = 200,
}: TooltipProps) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [coords, setCoords] = React.useState<{
    top: number;
    left: number;
  } | null>(null);
  const triggerRef = React.useRef<HTMLSpanElement>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      let top = 0;
      let left = 0;

      if (side === "top") {
        top = rect.top - sideOffset;
        left =
          align === "start"
            ? rect.left
            : align === "end"
              ? rect.right
              : rect.left + rect.width / 2;
      } else if (side === "bottom") {
        top = rect.bottom + sideOffset;
        left =
          align === "start"
            ? rect.left
            : align === "end"
              ? rect.right
              : rect.left + rect.width / 2;
      } else if (side === "left") {
        top = rect.top + rect.height / 2;
        left = rect.left - sideOffset;
      } else if (side === "right") {
        top = rect.top + rect.height / 2;
        left = rect.right + sideOffset;
      }

      setCoords({ top, left });
      setIsVisible(true);
    }, delayDuration);
  }, [side, align, sideOffset, delayDuration]);

  const hideTooltip = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsVisible(false);
  }, []);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const transformStyle = React.useMemo(() => {
    if (side === "top") {
      return align === "start"
        ? "translate(0, -100%)"
        : align === "end"
          ? "translate(-100%, -100%)"
          : "translate(-50%, -100%)";
    }
    if (side === "bottom") {
      return align === "start"
        ? "translate(0, 0)"
        : align === "end"
          ? "translate(-100%, 0)"
          : "translate(-50%, 0)";
    }
    if (side === "left") {
      return "translate(-100%, -50%)";
    }
    return "translate(0, -50%)";
  }, [side, align]);

  if (!content) {
    return <>{children}</>;
  }

  return (
    <span
      ref={triggerRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      className="inline-flex shrink-0 items-center justify-center"
    >
      {children}
      {isVisible &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              transform: transformStyle,
              zIndex: 9999,
              pointerEvents: "none",
            }}
            className={cn(
              "overflow-hidden rounded-md border border-slate-200/90 bg-white/95 px-2.5 py-1 text-xs font-medium text-slate-800 shadow-md backdrop-blur-xs select-none animate-in fade-in-0 zoom-in-95",
              contentClassName,
            )}
          >
            {content}
          </div>,
          document.body,
        )}
    </span>
  );
};

export interface TooltipProviderProps {
  children: React.ReactNode;
  delayDuration?: number;
  skipDelayDuration?: number;
  disableHoverableContent?: boolean;
  [key: string]: unknown;
}

const TooltipProvider: React.FC<TooltipProviderProps> = ({ children }) => (
  <>{children}</>
);
const TooltipRoot = Tooltip;
const TooltipTrigger = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>((props, ref) => <span ref={ref} {...props} />);
TooltipTrigger.displayName = "TooltipTrigger";
const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((props, ref) => <div ref={ref} {...props} />);
TooltipContent.displayName = "TooltipContent";

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
};
