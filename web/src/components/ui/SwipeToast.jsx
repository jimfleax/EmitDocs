"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  Cancel01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";

const EASE_OUT = [0.23, 1, 0.32, 1];
const FLICK = 0.11;
const DEAD_ZONE = 3;
const RESIST_PX = 24;
const COLLAPSE_MS = 200;
const EXIT = 0.7;
const BURN = [{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }];
const HAS_STARTING_STYLE =
  typeof window !== "undefined" && "CSSStartingStyleRule" in window;

const rubberband = (over, dim, c = 0.55) =>
  (over * dim * c) / (dim + c * Math.abs(over));
const velocityOf = (hist) => {
  if (hist.length < 2) return 0;
  const [t0, y0] = hist[0];
  const [t1, y1] = hist[hist.length - 1];
  return performance.now() - t1 > 100 ? 0 : (y1 - y0) / Math.max(1, t1 - t0);
};

const TOAST_VARIANTS = {
  default: {
    background: "#ffffff",
    color: "#0f172a",
    fuseColor: "#3b82f6",
    icon: null,
  },
  success: {
    background: "#ffffff",
    color: "#0f172a",
    fuseColor: "#16a34a",
    icon: (
      <HugeiconsIcon
        icon={CheckmarkCircle02Icon}
        size={18}
        className="text-emerald-600"
      />
    ),
  },
  error: {
    background: "#ffffff",
    color: "#0f172a",
    fuseColor: "#dc2626",
    icon: (
      <HugeiconsIcon
        icon={CancelCircleIcon}
        size={18}
        className="text-red-600"
      />
    ),
  },
  failure: {
    background: "#ffffff",
    color: "#0f172a",
    fuseColor: "#dc2626",
    icon: (
      <HugeiconsIcon
        icon={CancelCircleIcon}
        size={18}
        className="text-red-600"
      />
    ),
  },
  warning: {
    background: "#ffffff",
    color: "#0f172a",
    fuseColor: "#d97706",
    icon: (
      <HugeiconsIcon icon={Alert02Icon} size={18} className="text-amber-600" />
    ),
  },
  info: {
    background: "#ffffff",
    color: "#0f172a",
    fuseColor: "#3b82f6",
    icon: (
      <HugeiconsIcon
        icon={InformationCircleIcon}
        size={18}
        className="text-blue-600"
      />
    ),
  },
  loading: {
    background: "#ffffff",
    color: "#0f172a",
    fuseColor: "#3b82f6",
    duration: 0,
    dismissible: false,
    icon: (
      <HugeiconsIcon
        icon={Loading03Icon}
        size={18}
        className="text-[#3b82f6] animate-spin"
      />
    ),
  },
};

export default function SwipeToast({
  variant = "default",
  title = "File archived",
  description = "",
  icon,
  actionLabel = "",
  onAction,
  open = true,
  onClose,
  background,
  color,
  fuseColor,
  width = 356,
  radius = 12,
  slideMs = 400,
  settleBounce = 0.2,
  swipeDistance = 40,
  duration,
  fuse = "bottom",
  pauseOnHover = true,
  closeButton = false,
  inline = false,
  dismissible,
  className = "",
}) {
  const variantConfig = TOAST_VARIANTS[variant] || TOAST_VARIANTS.default;
  const resolvedBg = background ?? variantConfig.background;
  const resolvedColor = color ?? variantConfig.color;
  const resolvedFuseColor = fuseColor ?? variantConfig.fuseColor;
  const resolvedIcon = icon !== undefined ? icon : variantConfig.icon;
  const resolvedDuration =
    duration !== undefined ? duration : (variantConfig.duration ?? 4000);
  const resolvedDismissible =
    dismissible !== undefined
      ? dismissible
      : (variantConfig.dismissible ?? true);

  const reduce = useReducedMotion();
  const [phase, setPhase] = useState("open");
  const [instant, setInstant] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const [mounted, setMounted] = useState(HAS_STARTING_STYLE);
  const cardRef = useRef(null);
  const fuseRef = useRef(null);
  const anim = useRef(null);
  const drag = useRef(null);
  const flags = useRef({
    hover: false,
    interacting: false,
    focus: false,
    hidden: false,
  });
  const lastInput = useRef("pointer");
  const pendingClose = useRef(null);
  const closeTimer = useRef(undefined);
  const reason = useRef("timeout");
  const leaving = useRef(false);
  const phaseRef = useRef(phase);
  const latest = useRef({ onClose, onAction, slideMs, inline });

  useEffect(() => {
    phaseRef.current = phase;
    latest.current = { onClose, onAction, slideMs, inline };
  });

  const y = useMotionValue(0);
  const fade = useMotionValue(1);
  const transform = useTransform(y, (v) => `translateY(${v}px)`);

  const syncFuse = () => {
    const a = anim.current;
    if (!a) return;
    const f = flags.current;
    if (f.hover || f.interacting || f.focus || f.hidden) a.pause();
    else if (a.playState === "paused") a.play();
  };
  const finish = (why) => {
    setPhase("gone");
    leaving.current = false;
    if (latest.current.inline)
      closeTimer.current = setTimeout(
        () => latest.current.onClose?.(why),
        COLLAPSE_MS,
      );
    else latest.current.onClose?.(why);
  };
  const close = (why) => {
    if (phaseRef.current !== "open" || leaving.current) return;
    if (drag.current) {
      pendingClose.current = why;
      return;
    }
    anim.current?.pause();
    reason.current = why;
    const now =
      why === "escape" ||
      ((why === "action" || why === "close") &&
        lastInput.current === "keyboard");
    setInstant(now);
    setPhase("closing");
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(
      () => finish(why),
      now ? 0 : latest.current.slideMs * EXIT + 60,
    );
  };
  const rescue = () => {
    clearTimeout(closeTimer.current);
    setInstant(false);
    y.set(0);
    fade.set(1);
    setPhase("open");
  };

  useEffect(() => {
    if (!open) close("programmatic");
    else if (phaseRef.current !== "open") rescue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (!HAS_STARTING_STYLE) requestAnimationFrame(() => setMounted(true));
  }, []);
  useEffect(() => {
    if (phase !== "open" || resolvedDuration <= 0 || !fuseRef.current)
      return undefined;
    anim.current?.cancel();
    const a = fuseRef.current.animate(BURN, {
      duration: resolvedDuration,
      easing: "linear",
      fill: "forwards",
    });
    a.onfinish = () => close("timeout");
    anim.current = a;
    syncFuse();
    return () => {
      a.onfinish = null;
      a.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, resolvedDuration]);
  useEffect(() => {
    if (!pauseOnHover) {
      flags.current.hover = false;
      syncFuse();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pauseOnHover]);
  useEffect(() => {
    const onVisibility = () => {
      flags.current.hidden = document.hidden;
      syncFuse();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(closeTimer.current);
      anim.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const swipeOut = (dy, v) => {
    anim.current?.pause();
    leaving.current = true;
    pendingClose.current = null;
    if (!reduce && cardRef.current) {
      animate(y, dy + cardRef.current.offsetHeight, {
        type: "spring",
        duration: 0.3,
        bounce: 0,
        velocity: v * 1000,
      });
    }
    animate(fade, 0, { duration: 0.2, ease: EASE_OUT }).then(() =>
      finish("swipe"),
    );
  };
  const onPointerDown = (e) => {
    lastInput.current = "pointer";
    if (
      e.button !== 0 ||
      !resolvedDismissible ||
      drag.current ||
      leaving.current ||
      e.target.closest("button")
    )
      return;
    if (phaseRef.current === "closing") rescue();
    try {
      cardRef.current?.setPointerCapture(e.pointerId);
    } catch {}
    y.stop();
    drag.current = {
      id: e.pointerId,
      startY: e.clientY,
      grab: null,
      moved: false,
      hist: [[performance.now(), y.get()]],
    };
    flags.current.interacting = true;
    syncFuse();
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (d.grab === null) {
      if (Math.abs(e.clientY - d.startY) < DEAD_ZONE) return;
      d.grab = e.clientY - y.get();
      setSwiping(true);
    }
    const raw = e.clientY - d.grab;
    const next = raw >= 0 ? raw : rubberband(raw, RESIST_PX);
    y.set(next);
    d.moved = true;
    d.hist.push([performance.now(), next]);
    if (d.hist.length > 4) d.hist.shift();
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setSwiping(false);
    try {
      cardRef.current?.releasePointerCapture(e.pointerId);
    } catch {}
    flags.current.interacting = false;
    const dy = y.get();
    const v = velocityOf(d.hist);
    if (dy > 0 && (v > FLICK || (dy >= swipeDistance && v >= 0))) {
      swipeOut(dy, v);
      return;
    }
    if (d.moved) {
      animate(
        y,
        0,
        reduce
          ? { duration: 0.2, ease: EASE_OUT }
          : {
              type: "spring",
              duration: 0.5,
              bounce: settleBounce,
              velocity: v * 1000,
            },
      );
    }
    const queued = pendingClose.current;
    pendingClose.current = null;
    if (queued) close(queued);
    else syncFuse();
  };

  const isClosed = phase === "closing" || phase === "gone" || !mounted;

  return (
    <div
      className={`grid w-full text-[13px] leading-normal font-sans ${
        inline
          ? "relative w-full max-w-[var(--st-w)] transition-[grid-template-rows] duration-[var(--st-slide)] [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]"
          : "fixed right-4 md:right-8 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] md:bottom-[calc(2rem+env(safe-area-inset-bottom,0px))] z-[999999999] max-w-[calc(100vw-2rem)] md:max-w-[calc(100vw-4rem)] w-auto"
      } ${className}`.trim()}
      style={{
        gridTemplateRows: inline ? (isClosed ? "0fr" : "1fr") : "1fr",
        "--st-bg": resolvedBg,
        "--st-ink": resolvedColor,
        "--st-fuse": resolvedFuseColor,
        "--st-w": `${width}px`,
        "--st-radius": `${radius}px`,
        "--st-slide": `${slideMs}ms`,
        "--st-gap": "10px",
      }}
    >
      <div className="min-h-0">
        <div
          className={`${inline ? "mt-[10px]" : ""} transition-[transform,opacity] ${
            instant ? "duration-0" : "duration-[var(--st-slide)]"
          } [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] ${
            !mounted || phase === "closing"
              ? "opacity-0 translate-y-full"
              : phase === "gone"
                ? "opacity-0 translate-y-full invisible"
                : "opacity-100 translate-y-0"
          }`}
        >
          <motion.div
            ref={cardRef}
            className={`relative flex items-center gap-2.5 p-4 rounded-[var(--st-radius)] overflow-hidden bg-[var(--st-bg)] text-[var(--st-ink)] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.08),0_2px_6px_-1px_rgba(0,0,0,0.04)] border border-slate-200/90 outline-none select-none [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] ${
              resolvedDismissible
                ? swiping
                  ? "cursor-grabbing"
                  : "cursor-grab"
                : "cursor-default touch-auto"
            }`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            tabIndex={0}
            style={{ transform, opacity: fade }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerEnter={(e) => {
              if (pauseOnHover && e.pointerType === "mouse") {
                flags.current.hover = true;
                syncFuse();
              }
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") {
                flags.current.hover = false;
                syncFuse();
              }
            }}
            onFocus={() => {
              flags.current.focus = true;
              syncFuse();
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) {
                flags.current.focus = false;
                syncFuse();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                lastInput.current = "keyboard";
              if (e.key === "Escape" && resolvedDismissible) {
                e.stopPropagation();
                close("escape");
              }
            }}
          >
            {resolvedIcon ? (
              <span
                className="inline-flex flex-none w-[18px] h-[18px] items-center justify-center"
                aria-hidden="true"
              >
                {resolvedIcon}
              </span>
            ) : null}
            <span className="flex flex-1 flex-col gap-[1px] min-w-0 text-left">
              <span className="font-semibold leading-normal text-[13px]">
                {title}
              </span>
              {description ? (
                <span className="text-[12px] opacity-70 font-normal leading-snug">
                  {description}
                </span>
              ) : null}
            </span>
            {actionLabel ? (
              <button
                type="button"
                className="flex-none h-6 px-2.5 rounded-[5px] bg-[var(--st-ink)] text-[var(--st-bg)] text-xs font-semibold cursor-pointer border-0 outline-none transition-[transform,opacity] duration-150 active:scale-[0.97] hover:opacity-90"
                onClick={() => {
                  latest.current.onAction?.();
                  close("action");
                }}
              >
                {actionLabel}
              </button>
            ) : null}
            {closeButton ? (
              <button
                type="button"
                className="relative grid place-items-center w-6 h-6 rounded-[5px] bg-transparent text-slate-400 hover:text-slate-700 cursor-pointer border-0 outline-none transition-[transform,background-color] duration-150 active:scale-[0.97] hover:bg-slate-100 before:content-[''] before:absolute before:-inset-2"
                aria-label="Close"
                onClick={() => close("close")}
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={12}
                  strokeWidth={2.5}
                />
              </button>
            ) : null}
            <i
              ref={fuseRef}
              className={`absolute right-0 left-0 h-[2px] pointer-events-none origin-left ${
                fuse === "top" ? "top-0" : "bottom-0"
              } ${fuse === "none" || resolvedDuration <= 0 ? "opacity-0" : "opacity-100"}`}
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--st-fuse) 18%, transparent) 9%, color-mix(in srgb, var(--st-fuse) 50%, transparent) 18%, color-mix(in srgb, var(--st-fuse) 84%, transparent) 28%, var(--st-fuse) 38%, var(--st-fuse) 62%, color-mix(in srgb, var(--st-fuse) 84%, transparent) 72%, color-mix(in srgb, var(--st-fuse) 50%, transparent) 82%, color-mix(in srgb, var(--st-fuse) 18%, transparent) 91%, transparent 100%)",
              }}
              aria-hidden="true"
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
