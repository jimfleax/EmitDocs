/**
 * @file select.tsx
 * @description Accessible custom select dropdown system with portal support and keyboard navigation.
 * @architecture Implements headless select state management (open state, label caching, selected value) with portal rendering and scroll buttons.
 * @agent_note Uses selectItemCache to look up rich labels for selected values.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { CaretDown, CaretUp, Check } from "@phosphor-icons/react";
import { cn, getReactNodeText } from "@/lib/utils";
import { extractItemsFromChildren, selectItemCache } from "@/lib/select-utils";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

interface SelectContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  setTriggerElement: (el: HTMLButtonElement | null) => void;
  getTriggerElement: () => HTMLButtonElement | null;
  registerItem: (value: string, label: React.ReactNode, text?: string) => void;
  unregisterItem: (value: string) => void;
  selectedLabel?: React.ReactNode;
  getLabel?: (value: string) => React.ReactNode;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
  getLabel?: (value: string) => React.ReactNode;
}

/**
 * @component Select
 * @description Root container for custom select dropdown, managing selection state and item registry.
 * @param {SelectProps} props - Component properties.
 * @param {string} [props.value] - Controlled selected value.
 * @param {string} [props.defaultValue] - Initial uncontrolled value.
 * @param {(value: string) => void} [props.onValueChange] - Selection change handler.
 * @param {boolean} [props.open] - Controlled open state.
 * @state Manages open/closed status, active item registry, and trigger element bounding rects.
 */
const Select = ({
  value: controlledValue,
  defaultValue,
  onValueChange,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  getLabel,
  children,
}: SelectProps) => {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(
    defaultValue ?? "",
  );
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  const itemsRef = React.useRef<
    Map<string, { label: React.ReactNode; text: string }>
  >(new Map());

  const isControlledValue = controlledValue !== undefined;
  const isControlledOpen = controlledOpen !== undefined;

  const value = isControlledValue ? controlledValue : uncontrolledValue;
  const open = isControlledOpen ? controlledOpen : uncontrolledOpen;

  // Synchronously parse items from children (pure traversal, no ref mutation during render)
  const extractedItems = React.useMemo(() => {
    return extractItemsFromChildren(children);
  }, [children]);

  // Cache extracted items outside render
  useIsomorphicLayoutEffect(() => {
    for (const [k, v] of extractedItems.entries()) {
      itemsRef.current.set(k, v);
      selectItemCache.set(k, v);
    }
  }, [extractedItems]);

  // Synchronously compute the selected label on Frame 1
  const synchronousLabel = React.useMemo(() => {
    if (value === undefined || value === "") return undefined;
    if (getLabel) return getLabel(value);
    return (
      extractedItems.get(value)?.label ?? selectItemCache.get(value)?.label
    );
  }, [value, getLabel, extractedItems]);

  const [registeredLabel, setRegisteredLabel] = React.useState<React.ReactNode>(
    () => synchronousLabel,
  );

  const currentLabel = synchronousLabel ?? registeredLabel;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlledOpen) setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [isControlledOpen, onOpenChange],
  );

  const handleValueChange = React.useCallback(
    (nextValue: string) => {
      if (!isControlledValue) setUncontrolledValue(nextValue);
      onValueChange?.(nextValue);
      setOpen(false);
    },
    [isControlledValue, onValueChange, setOpen],
  );

  const setTriggerElement = React.useCallback(
    (el: HTMLButtonElement | null) => {
      triggerRef.current = el;
    },
    [],
  );

  const getTriggerElement = React.useCallback(() => {
    return triggerRef.current;
  }, []);

  const valueRef = React.useRef(value);
  useIsomorphicLayoutEffect(() => {
    valueRef.current = value;
  }, [value]);

  const registerItem = React.useCallback(
    (itemVal: string, label: React.ReactNode, text?: string) => {
      const itemText =
        text ?? (typeof label === "string" ? label : getReactNodeText(label));
      itemsRef.current.set(itemVal, { label, text: itemText });
      selectItemCache.set(itemVal, { label, text: itemText });

      if (itemVal === valueRef.current) {
        setRegisteredLabel((prev) => {
          if (prev === label) return prev;
          if (
            typeof prev === "string" &&
            typeof label === "string" &&
            prev === label
          )
            return prev;
          return label;
        });
      }
    },
    [],
  );

  const unregisterItem = React.useCallback((_itemVal: string) => {
    // Retain registered labels so SelectValue preserves display text when dropdown closes
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (value !== undefined) {
      const item = itemsRef.current.get(value) ?? selectItemCache.get(value);
      if (item) {
        setRegisteredLabel((prev) => {
          if (prev === item.label) return prev;
          if (
            typeof prev === "string" &&
            typeof item.label === "string" &&
            prev === item.label
          )
            return prev;
          return item.label;
        });
      }
    }
  }, [value]);

  const contextValue = React.useMemo<SelectContextValue>(
    () => ({
      value,
      onValueChange: handleValueChange,
      open,
      setOpen,
      setTriggerElement,
      getTriggerElement,
      registerItem,
      unregisterItem,
      selectedLabel: currentLabel,
      getLabel,
    }),
    [
      value,
      handleValueChange,
      open,
      setOpen,
      setTriggerElement,
      getTriggerElement,
      registerItem,
      unregisterItem,
      currentLabel,
      getLabel,
    ],
  );

  return (
    <SelectContext.Provider value={contextValue}>
      <div className="relative inline-block w-full">{children}</div>
    </SelectContext.Provider>
  );
};

export interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, onClick, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    const setTriggerElement = context?.setTriggerElement;

    const handleRef = React.useCallback(
      (node: HTMLButtonElement | null) => {
        setTriggerElement?.(node);
        if (typeof ref === "function") ref(node);
        else if (ref)
          (ref as React.MutableRefObject<HTMLButtonElement | null>).current =
            node;
      },
      [setTriggerElement, ref],
    );

    return (
      <button
        ref={handleRef}
        type="button"
        role="combobox"
        aria-expanded={context?.open ?? false}
        onClick={(e) => {
          onClick?.(e);
          if (!props.disabled) context?.setOpen(!context.open);
        }}
        className={cn(
          "flex h-8 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-2xs transition-colors hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 select-none [&>span]:line-clamp-1 cursor-pointer",
          className,
        )}
        {...props}
      >
        {children}
        <CaretDown
          size={12}
          weight="bold"
          className="text-slate-400 shrink-0 ml-1.5"
        />
      </button>
    );
  },
);
SelectTrigger.displayName = "SelectTrigger";

export interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  placeholder?: string;
  getLabel?: (value: string) => React.ReactNode;
}

const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(
  ({ className, placeholder, children, getLabel, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    const labelFromProp =
      getLabel && context?.value !== undefined
        ? getLabel(context.value)
        : undefined;
    const labelFromContext =
      context?.getLabel && context?.value !== undefined
        ? context.getLabel(context.value)
        : undefined;

    const displayContent =
      children ??
      labelFromProp ??
      labelFromContext ??
      context?.selectedLabel ??
      placeholder ??
      context?.value;

    return (
      <span
        ref={ref}
        className={cn(
          "truncate block pointer-events-none text-left flex-1",
          !displayContent && "text-slate-400",
          !children &&
            !labelFromProp &&
            !labelFromContext &&
            !context?.selectedLabel &&
            placeholder &&
            "text-slate-400",
          className,
        )}
        {...props}
      >
        {displayContent}
      </span>
    );
  },
);
SelectValue.displayName = "SelectValue";

export interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  position?: "popper" | "item-aligned";
}

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const [coords, setCoords] = React.useState<{
      top: number;
      left: number;
      width: number;
    } | null>(null);
    const getTriggerElement = context?.getTriggerElement;
    const isOpen = context?.open;

    React.useEffect(() => {
      if (!isOpen) return;
      const triggerElement = getTriggerElement?.() ?? null;
      if (!triggerElement) return;

      const updatePosition = () => {
        const rect = triggerElement.getBoundingClientRect();
        setCoords({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
        });
      };

      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);

      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }, [isOpen, getTriggerElement]);

    const setOpen = context?.setOpen;

    React.useEffect(() => {
      if (!isOpen) return;

      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node;
        if (!target || !document.contains(target)) return;

        const triggerElement = getTriggerElement?.() ?? null;
        if (
          contentRef.current &&
          !contentRef.current.contains(target) &&
          triggerElement &&
          !triggerElement.contains(target)
        ) {
          setOpen?.(false);
        }
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen?.(false);
      };

      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [isOpen, getTriggerElement, setOpen]);

    if (typeof document === "undefined") {
      return null;
    }

    return createPortal(
      <div
        ref={(node) => {
          (contentRef as any).current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        style={{
          position: "fixed",
          top: coords?.top ?? 0,
          left: coords?.left ?? 0,
          minWidth: coords?.width ?? 0,
          zIndex: 9999,
          display: isOpen && coords ? "block" : "none",
        }}
        aria-hidden={!isOpen}
        data-select-content="true"
        className={cn(
          "max-h-72 overflow-y-auto rounded-xl border border-slate-200/90 bg-white p-1 text-slate-800 shadow-xl select-none animate-in fade-in-0 zoom-in-95",
          className,
        )}
        {...props}
      >
        {children}
      </div>,
      document.body,
    );
  },
);
SelectContent.displayName = "SelectContent";

export interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  textValue?: string;
  disabled?: boolean;
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  (
    {
      className,
      children,
      value,
      textValue,
      disabled = false,
      onClick,
      ...props
    },
    ref,
  ) => {
    const context = React.useContext(SelectContext);
    const isSelected = context?.value === value;
    const registerItem = context?.registerItem;

    const labelToRegister = textValue !== undefined ? textValue : children;

    const text =
      textValue !== undefined
        ? textValue
        : typeof children === "string"
          ? children
          : getReactNodeText(children);

    useIsomorphicLayoutEffect(() => {
      registerItem?.(value, labelToRegister, text);
    }, [value, labelToRegister, text, registerItem]);

    return (
      <div
        ref={ref}
        role="option"
        aria-selected={isSelected}
        data-state={isSelected ? "checked" : "unchecked"}
        data-disabled={disabled ? "" : undefined}
        onClick={(e) => {
          if (disabled) return;
          onClick?.(e);
          context?.onValueChange?.(value);
        }}
        className={cn(
          "relative flex w-full cursor-pointer select-none items-center rounded-lg py-1.5 pl-7 pr-2 text-xs font-medium text-slate-700 outline-none transition-colors hover:bg-blue-50 hover:text-blue-700 focus:bg-blue-50 focus:text-blue-700 data-[state=checked]:bg-blue-50/80 data-[state=checked]:text-blue-700 data-[state=checked]:font-semibold data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          className,
        )}
        {...props}
      >
        {isSelected && (
          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            <Check size={12} weight="bold" className="text-blue-600" />
          </span>
        )}
        <span className="truncate">{children}</span>
      </div>
    );
  },
);
SelectItem.displayName = "SelectItem";

const SelectGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-1", className)} {...props} />
));
SelectGroup.displayName = "SelectGroup";

const SelectLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none",
      className,
    )}
    {...props}
  />
));
SelectLabel.displayName = "SelectLabel";

const SelectSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-slate-100", className)}
    {...props}
  />
));
SelectSeparator.displayName = "SelectSeparator";

const SelectScrollUpButton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1 text-slate-500",
      className,
    )}
    {...props}
  >
    <CaretUp size={12} weight="bold" />
  </div>
));
SelectScrollUpButton.displayName = "SelectScrollUpButton";

const SelectScrollDownButton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1 text-slate-500",
      className,
    )}
    {...props}
  >
    <CaretDown size={12} weight="bold" />
  </div>
));
SelectScrollDownButton.displayName = "SelectScrollDownButton";

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
