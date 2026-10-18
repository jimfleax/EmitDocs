/**
 * @file KeyboardShortcutsModal.tsx
 * @description Modal dialog displaying keyboard shortcuts reference cheat-sheet for the mapping canvas.
 * @architecture UI presentation modal providing accessibility and power-user discoverability in template mapping.
 * @agent_note Displays platform-aware shortcut modifiers (Cmd on Mac, Ctrl on PC/Linux) and handles Escape-key dismiss.
 */

import { useEffect } from "react";
import { X, Keyboard } from "@phosphor-icons/react";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  category: string;
  items: ShortcutItem[];
}

/**
 * @component KeyboardShortcutsModal
 * @description Modal dialogue categorizing all workspace keyboard hotkeys (undo/redo, nudging, snapping bypass, duplication).
 * @param {KeyboardShortcutsModalProps} props - Component properties.
 * @param {boolean} props.isOpen - Whether the modal dialog is visible.
 * @param {() => void} props.onClose - Dismiss callback triggered on backdrop click, close button, or Escape.
 * @state Stateless; attaches global keydown listener for Escape key dismiss.
 * @api Parent callback: onClose.
 * @returns {JSX.Element | null} Rendered accessible dialog or null when closed.
 */
export function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  const cmdKey = isMac ? "⌘" : "Ctrl";

  const shortcutGroups: ShortcutGroup[] = [
    {
      category: "History & Time Travel",
      items: [
        { keys: [cmdKey, "Z"], description: "Undo last change" },
        {
          keys: [cmdKey, "Shift", "Z"],
          description: "Redo previously undone change",
        },
        { keys: [cmdKey, "Y"], description: "Alternative Redo shortcut" },
      ],
    },
    {
      category: "Selection",
      items: [
        {
          keys: ["Shift / " + cmdKey, "Click"],
          description: "Add/remove field from selection",
        },
        {
          keys: ["Shift / " + cmdKey, "Drag"],
          description: "Draw box to select multiple fields",
        },
        {
          keys: [cmdKey, "A"],
          description: "Select all fields on active page",
        },
        { keys: ["Esc"], description: "Clear selection" },
      ],
    },
    {
      category: "Movement & Precision",
      items: [
        {
          keys: ["↑", "↓", "←", "→"],
          description: "Nudge selected field(s) by 1 point",
        },
        {
          keys: ["Shift", "Arrows"],
          description: "Fast nudge selected field(s) by 10 points",
        },
        {
          keys: ["Alt", "Drag"],
          description: "Bypass magnetic snap alignment temporarily",
        },
      ],
    },
    {
      category: "Field Actions",
      items: [
        {
          keys: [cmdKey, "D"],
          description: "Duplicate selected field(s) with offset",
        },
        { keys: ["Del", "Backspace"], description: "Delete selected field(s)" },
        { keys: ["?"], description: "Open this keyboard shortcuts dialog" },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Keyboard size={18} weight="duotone" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">
                Keyboard Shortcuts
              </h2>
              <p className="text-xs text-slate-500">
                Quickly design and arrange template placeholders
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {shortcutGroups.map((group) => (
            <div key={group.category} className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                {group.category}
              </h3>
              <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl divide-y divide-slate-100 overflow-hidden">
                {group.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3.5 py-2.5 text-sm"
                  >
                    <span className="text-slate-700 font-normal">
                      {item.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-0.5 text-xs font-mono font-medium text-slate-700 bg-white border border-slate-200 rounded-md shadow-2xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>
            Press{" "}
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded shadow-2xs">
              Esc
            </kbd>{" "}
            anytime to dismiss
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
