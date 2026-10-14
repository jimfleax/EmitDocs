/**
 * @file SwipeToast.d.ts
 * @description TypeScript interface declarations for the swipe-to-dismiss toast component.
 * @architecture Defines prop interfaces, variant constants, and dismiss reason types for SwipeToast.jsx.
 */

import type { FC, ReactNode } from "react";

export type SwipeToastVariant =
  "default" | "success" | "error" | "failure" | "warning" | "info" | "loading";

export type SwipeToastCloseReason =
  "timeout" | "swipe" | "action" | "close" | "escape" | "programmatic";

export interface SwipeToastProps {
  /** The feedback category preset. Default: 'default' */
  variant?: SwipeToastVariant;
  /** The first line of the toast. Default: 'File archived' */
  title?: ReactNode;
  /** The dimmer second line. Empty hides it. Default: '' */
  description?: ReactNode;
  /** An 18px icon before the text. If omitted, uses variant icon. */
  icon?: ReactNode;
  /** The inverted button label. Empty hides it. Default: '' */
  actionLabel?: ReactNode;
  /** Called when the action is pressed, before the close. */
  onAction?: () => void;
  /** Flip to false to close from outside. True again re-enters. Default: true */
  open?: boolean;
  /** Called after the exit, and after the inline slot has collapsed. */
  onClose?: (reason: SwipeToastCloseReason) => void;
  /** The card surface color, and the action text color. */
  background?: string;
  /** Ink: title, description and action fill color. */
  color?: string;
  /** The burning fuse line color. */
  fuseColor?: string;
  /** Card width in pixels, capped at parent when inline. Default: 356 */
  width?: number;
  /** Corner radius in pixels. Default: 12 */
  radius?: number;
  /** How long the rise and drop take in ms. Default: 400 */
  slideMs?: number;
  /** Overshoot of the return after an abandoned swipe. Default: 0.2 */
  settleBounce?: number;
  /** How far a slow drag must go before release dismisses in px. Default: 40 */
  swipeDistance?: number;
  /** Milliseconds until it closes itself. Default: 4000 (0 for loading/infinite). */
  duration?: number;
  /** Which edge the line burns along. Default: 'bottom' */
  fuse?: "bottom" | "top" | "none";
  /** Hovering freezes the line and timer. Default: true */
  pauseOnHover?: boolean;
  /** Adds a cross at the end of the row. Default: false */
  closeButton?: boolean;
  /** In flow inside parent instead of fixed to bottom-right of viewport. Default: false */
  inline?: boolean;
  /** Off removes the swipe and Escape. Default: true */
  dismissible?: boolean;
  /** Extra classes for the root container. Default: '' */
  className?: string;
}

export declare const TOAST_VARIANTS: Record<
  SwipeToastVariant,
  {
    background: string;
    color: string;
    fuseColor: string;
    icon: ReactNode;
    duration?: number;
    dismissible?: boolean;
  }
>;

declare const SwipeToast: FC<SwipeToastProps>;

export default SwipeToast;
