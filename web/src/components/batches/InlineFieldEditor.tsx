import React, { useState, useRef, useEffect } from "react";
import {
  Check,
  X,
  ArrowCounterClockwise,
  PencilSimple,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

export interface InlineFieldEditorProps {
  fieldKey: string;
  label: string;
  type?: string;
  required?: boolean;
  value: any;
  originalValue?: any;
  isOverridden: boolean;
  errorMessage?: string;
  onSave: (fieldKey: string, newValue: any) => Promise<void>;
  onRevert: (fieldKey: string) => Promise<void>;
  disabled?: boolean;
}

export function InlineFieldEditor({
  fieldKey,
  label,
  type = "text",
  required = false,
  value,
  originalValue,
  isOverridden,
  errorMessage,
  onSave,
  onRevert,
  disabled = false,
}: InlineFieldEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(
    value !== null && value !== undefined ? String(value) : "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (disabled || isSaving || isReverting) return;
    setDraftValue(value !== null && value !== undefined ? String(value) : "");
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setDraftValue(value !== null && value !== undefined ? String(value) : "");
  };

  const handleCommit = async () => {
    if (disabled || isSaving) return;
    const trimmed = draftValue.trim();
    const currentStr =
      value !== null && value !== undefined ? String(value).trim() : "";
    if (trimmed === currentStr) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      await onSave(fieldKey, trimmed);
      setIsEditing(false);
    } catch {
      // Error handled by parent toast/alert
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevertClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || isReverting) return;
    try {
      setIsReverting(true);
      await onRevert(fieldKey);
    } catch {
      // Error handled by parent
    } finally {
      setIsReverting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <div
      className={cn(
        "group relative p-3 rounded-xl border transition-all duration-150",
        errorMessage
          ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900"
          : isOverridden
            ? "bg-blue-50/30 dark:bg-blue-950/20 border-blue-200/80 dark:border-blue-800/80"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700",
      )}
    >
      {/* Field Label Header */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
            {label}
          </span>
          {required && (
            <span className="text-rose-500 font-bold text-xs">*</span>
          )}
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
            {type}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isOverridden && (
            <>
              <Badge
                variant="primary"
                size="sm"
                title={
                  originalValue !== undefined
                    ? `Original spreadsheet value: "${originalValue}"`
                    : "Manually overridden value"
                }
              >
                Override
              </Badge>

              <button
                type="button"
                onClick={handleRevertClick}
                disabled={disabled || isReverting}
                title="Revert to original spreadsheet value"
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {isReverting ? (
                  <Spinner size="sm" variant="muted" />
                ) : (
                  <ArrowCounterClockwise className="w-3.5 h-3.5" />
                )}
              </button>
            </>
          )}

          {!isEditing && (
            <button
              type="button"
              onClick={handleStartEdit}
              disabled={disabled}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
              title="Edit field value"
            >
              <PencilSimple className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Editor or Static Display */}
      {isEditing ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-blue-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />

            <button
              type="button"
              onClick={handleCommit}
              disabled={isSaving}
              className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shrink-0"
              title="Save override (Enter)"
            >
              {isSaving ? (
                <Spinner size="sm" variant="current" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer shrink-0"
              title="Cancel (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            Press Enter to save, Esc to cancel
          </p>
        </div>
      ) : (
        <div
          onClick={handleStartEdit}
          className="cursor-pointer min-h-[24px] flex items-center justify-between"
        >
          <div className="text-xs text-slate-900 dark:text-slate-100 font-medium break-all">
            {value !== null &&
            value !== undefined &&
            String(value).trim().length > 0 ? (
              String(value)
            ) : (
              <span className="text-slate-400 dark:text-slate-500 italic font-normal text-xs">
                (empty)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Validation Error Banner */}
      {errorMessage && (
        <div className="mt-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
          <span>• {errorMessage}</span>
        </div>
      )}
    </div>
  );
}
