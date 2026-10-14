/**
 * @file ImportSchemaSummary.tsx
 * @description Summary card displaying the target template's expected placeholder variables and required data types.
 * @architecture Guidance card displayed during column mapping in the batch import wizard.
 * @agent_note Lists template version, total placeholder count, and pills for date, number, or text data types.
 */

import { FileText, CalendarBlank, Hash, TextT } from "@phosphor-icons/react";

interface FieldItem {
  key: string;
  label?: string;
  type?: string;
  required?: boolean;
}

interface ImportSchemaSummaryProps {
  templateName: string;
  version: number;
  fields: FieldItem[];
}

/**
 * @component ImportSchemaSummary
 * @description Visual overview of template variables and required formats before spreadsheet column binding.
 * @param {ImportSchemaSummaryProps} props - Component properties.
 * @returns {JSX.Element} Schema summary card with placeholder pills.
 */
export function ImportSchemaSummary({
  templateName,
  version,
  fields,
}: ImportSchemaSummaryProps) {
  return (
    <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100/70 text-blue-600 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{templateName}</h3>
            <p className="text-xs text-slate-400">Template Version {version}</p>
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 font-medium shadow-xs">
          {fields.length} Placeholders
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-3 border-t border-slate-100">
        {fields.map((f) => {
          const isRequired = f.required !== false;
          return (
            <div
              key={f.key}
              className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-100 shadow-xs text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                {f.type === "date" ? (
                  <CalendarBlank className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                ) : f.type === "number" ? (
                  <Hash className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <TextT className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                )}
                <span className="font-medium text-slate-800 truncate">
                  {f.label || f.key}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                  {f.type || "text"}
                </span>
                {isRequired ? (
                  <span className="text-[10px] text-amber-500 font-bold">
                    Req
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">Opt</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
