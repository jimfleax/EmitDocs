import React from "react";
import type { EngineWarning } from "@/lib/pdf-engine/pdf-preview-engine";
import { CheckCircle, Warning } from "@phosphor-icons/react";

interface LayoutWarningListProps {
  warnings: EngineWarning[];
  onSelectField?: (fieldKey: string) => void;
}

export const LayoutWarningList: React.FC<LayoutWarningListProps> = ({
  warnings,
  onSelectField,
}) => {
  if (!warnings || warnings.length === 0) {
    return (
      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-700 flex items-center gap-2">
        <CheckCircle
          size={16}
          weight="fill"
          className="text-emerald-600 shrink-0"
        />
        <span>Layout checks passed. No overflow or font glyph warnings.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-amber-700">
        <span>Layout & Font Warnings ({warnings.length})</span>
        <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300 font-mono">
          Action Required
        </span>
      </div>

      <div className="space-y-1.5">
        {warnings.map((w, idx) => (
          <div
            key={`warn-${idx}`}
            onClick={() => onSelectField && onSelectField(w.fieldKey)}
            className="p-2.5 bg-amber-50/70 border border-amber-200 rounded text-xs hover:border-amber-400 cursor-pointer transition-colors shadow-2xs"
          >
            <div className="flex items-start gap-2">
              <Warning
                size={16}
                weight="fill"
                className="text-amber-600 shrink-0 mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 font-medium text-slate-800">
                  <span className="font-mono text-blue-600">
                    &#123;&#123;{w.fieldKey}&#125;&#125;
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                    {w.type.replace("_", " ")}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                  {w.message}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
