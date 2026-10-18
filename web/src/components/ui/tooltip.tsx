/**
 * @file tooltip.tsx
 * @description Lightweight hover and focus tooltip component rendered via document portal.
 * @architecture Computes anchor bounding rects on hover/focus and projects floating tooltips into document.body.
 * @agent_note Portals into document.body with fixed positioning and automatically dismisses on scroll/resize.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { Slot } from "@radix-ui/react-slot";
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

export interface TooltipPositionResult {
  top: number;
  left: number;
  effectiveSide: "top" | "right" | "bottom" | "left";
}

/**
 * @function calculateTooltipPosition
 * @description Calculates screen pixel coordinates for tooltip positioning based on anchor bounding rect and viewport boundaries.
 * @param {Object} rect - Anchor element bounding client rect.
 * @param {Object} [options] - Alignment, side, and viewport constraint overrides.
 * @returns {TooltipPositionResult} Calculated coordinates and effective placement side.
 */
// oxlint-disable-next-line react/only-export-components
export function calculateTooltipPosition(
  rect: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  },
  options: {
    side?: "top" | "right" | "bottom" | "left";
    align?: "start" | "center" | "end";
    sideOffset?: number;
    viewportWidth?: number;
    viewportHeight?: number;
  } = {},
): TooltipPositionResult {
  const {
    side = "top",
    align = "center",
    sideOffset = 4,
    viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1024,
    viewportHeight = typeof window !== "undefined" ? window.innerHeight : 768,
  } = options;

  let effectiveSide = side;

  // Auto-flip if not enough clearance
  if (effectiveSide === "top" && rect.top - sideOffset < 36) {
    if (rect.bottom + sideOffset + 36 <= viewportHeight) {
      effectiveSide = "bottom";
    }
  } else if (
    effectiveSide === "bottom" &&
    rect.bottom + sideOffset + 36 > viewportHeight
  ) {
    if (rect.top - sideOffset >= 36) {
      effectiveSide = "top";
    }
  }

  let top = 0;
  let left = 0;

  if (effectiveSide === "top") {
    top = rect.top - sideOffset;
    left =
      align === "start"
        ? rect.left
        : align === "end"
          ? rect.right
          : rect.left + rect.width / 2;
  } else if (effectiveSide === "bottom") {
    top = rect.bottom + sideOffset;
    left =
      align === "start"
        ? rect.left
        : align === "end"
          ? rect.right
          : rect.left + rect.width / 2;
  } else if (effectiveSide === "left") {
    top = rect.top + rect.height / 2;
    left = rect.left - sideOffset;
  } else if (effectiveSide === "right") {
    top = rect.top + rect.height / 2;
    left = rect.right + sideOffset;
  }

  // Constrain horizontally within viewport bounds
  left = Math.max(12, Math.min(viewportWidth - 12, left));

  return { top, left, effectiveSide };
}

/**
 * @function resolveMeasurementTarget
 * @description Resolves the true measurement target element, unwrapping collapsed zero-sized parent wrappers if needed.
 * @param {HTMLElement | null} element - The initial DOM element candidate.
 * @returns {HTMLElement | null} The measurement target element.
 */
// oxlint-disable-next-line react/only-export-components
export function resolveMeasurementTarget(
  element: HTMLElement | null,
): HTMLElement | null {
  if (!element) return null;
  const firstChild = element.firstElementChild as HTMLElement | null;
  if (
    firstChild &&
    (typeof HTMLElement === "undefined" || firstChild instanceof HTMLElement) &&
    (element.offsetWidth === 0 || element.offsetHeight === 0)
  ) {
    return firstChild;
  }
  return element;
}

/**
 * @component Tooltip
 * @description Floating tooltip bubble triggered on hover or focus with configurable delay and positioning.
 * @param {TooltipProps} props - Component properties.
 * @param {React.ReactNode} props.content - Tooltip text or node content.
 * @param {React.ReactNode} props.children - Target element that triggers the tooltip.
 * @param {"top" | "right" | "bottom" | "left"} [props.side="top"] - Placement side.
 * @param {"start" | "center" | "end"} [props.align="center"] - Alignment along the chosen side.
 * @param {number} [props.sideOffset=4] - Offset distance in pixels from target element.
 * @param {boolean} [props.asChild=false] - Whether to merge props onto direct child via Radix Slot.
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
  asChild = false,
  delayDuration = 200,
}: TooltipProps) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [tooltipState, setTooltipState] =
    React.useState<TooltipPositionResult | null>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const target = resolveMeasurementTarget(triggerRef.current);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const pos = calculateTooltipPosition(rect, {
        side,
        align,
        sideOffset,
      });
      setTooltipState(pos);
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

  // Dismiss tooltip on scroll, resize, or wheel so it doesn't detach during pan/zoom/scroll
  React.useEffect(() => {
    if (!isVisible) return;
    const handleDismiss = () => {
      hideTooltip();
    };
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("resize", handleDismiss);
    window.addEventListener("wheel", handleDismiss, {
      passive: true,
      capture: true,
    });
    return () => {
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss);
      window.removeEventListener("wheel", handleDismiss, true);
    };
  }, [isVisible, hideTooltip]);

  const effectiveSide = tooltipState?.effectiveSide ?? side;
  const transformStyle = React.useMemo(() => {
    if (effectiveSide === "top") {
      return align === "start"
        ? "translate(0, -100%)"
        : align === "end"
          ? "translate(-100%, -100%)"
          : "translate(-50%, -100%)";
    }
    if (effectiveSide === "bottom") {
      return align === "start"
        ? "translate(0, 0)"
        : align === "end"
          ? "translate(-100%, 0)"
          : "translate(-50%, 0)";
    }
    if (effectiveSide === "left") {
      return "translate(-100%, -50%)";
    }
    return "translate(0, -50%)";
  }, [effectiveSide, align]);

  if (!content) {
    return <>{children}</>;
  }

  const Comp = asChild ? Slot : "span";

  return (
    <>
      <Comp
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className={
          asChild
            ? undefined
            : "inline-flex shrink-0 items-center justify-center"
        }
      >
        {children}
      </Comp>
      {isVisible &&
        tooltipState &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              top: tooltipState.top,
              left: tooltipState.left,
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
    </>
  );
};

export interface TooltipProviderProps {
  children: React.ReactNode;
  delayDuration?: number;
  skipDelayDuration?: number;
  disableHoverableContent?: boolean;
  [key: string]: unknown;
}

/**
 * @component TooltipProvider
 * @description Headless provider for global tooltip configuration and context pass-through.
 * @param {TooltipProviderProps} props - Provider properties.
 */
const TooltipProvider: React.FC<TooltipProviderProps> = ({ children }) => (
  <>{children}</>
);
const TooltipRoot = Tooltip;

/**
 * @component TooltipTrigger
 * @description Anchor trigger element for Radix-compatible tooltip declarations.
 * @param {React.HTMLAttributes<HTMLElement> & { asChild?: boolean }} props - Trigger attributes.
 */
const TooltipTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & { asChild?: boolean }
>(({ asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "span";
  return <Comp ref={ref} {...props} />;
});
TooltipTrigger.displayName = "TooltipTrigger";

/**
 * @component TooltipContent
 * @description Content placeholder for Radix-compatible tooltip declarations.
 * @param {React.HTMLAttributes<HTMLDivElement>} props - Content attributes.
 */
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
