import { useState } from "react";
import { Copy, CheckCircle, Funnel } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export interface RowErrorItem {
  field: string;
  code: string;
  message: string;
}

export interface RowWarningItem {
  field?: string;
  code: string;
  message: string;
  referenceRowNumbers?: number[];
}

export interface DisplayDraftRow {
  _id?: string;
  sourceRowNumber: number;
  rowKey: string;
  status: "valid" | "invalid";
  effectiveData: Record<string, any>;
  errors: RowErrorItem[];
  warnings: RowWarningItem[];
  isDuplicate: boolean;
  duplicateReferences: number[];
}

interface RowErrorTableProps {
  rows: DisplayDraftRow[];
  totalRows: number;
  onPageChange?: (page: number) => void;
}

export function RowErrorTable({ rows, totalRows }: RowErrorTableProps) {
  const [filter, setFilter] = useState<"all" | "invalid" | "duplicate">(
    "invalid",
  );

  const filteredRows = rows.filter((r) => {
    if (filter === "invalid") return r.status === "invalid";
    if (filter === "duplicate") return r.isDuplicate;
    return true;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
      {/* Table Header & Filter Bar */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900">
            Row Integrity Inspector
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Detailed validation diagnostics and duplicate references per row.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl text-xs shadow-xs">
          <Funnel className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
          <button
            type="button"
            onClick={() => setFilter("invalid")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              filter === "invalid"
                ? "bg-rose-50 text-rose-600 border border-rose-200"
                : "text-slate-400 hover:text-slate-700"
            }`}
          >
            Invalid Only
          </button>
          <button
            type="button"
            onClick={() => setFilter("duplicate")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              filter === "duplicate"
                ? "bg-amber-50 text-amber-600 border border-amber-200"
                : "text-slate-400 hover:text-slate-700"
            }`}
          >
            Duplicates
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              filter === "all"
                ? "bg-slate-100 text-slate-800 border border-slate-200"
                : "text-slate-400 hover:text-slate-700"
            }`}
          >
            All Rows ({totalRows})
          </button>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState
          icon={
            <CheckCircle
              size={24}
              weight="duotone"
              className="text-emerald-500"
            />
          }
          title={`No rows matching "${filter}" filter`}
          description="All records meet the selected filter criteria."
          variant="solid"
          size="compact"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-100">
              <tr>
                <th className="py-2.5 px-3.5 w-16 text-center">Row</th>
                <th className="py-2.5 px-3.5 w-24">Status</th>
                <th className="py-2.5 px-3.5">Values / Effective Data</th>
                <th className="py-2.5 px-3.5">Diagnostics & Warnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredRows.map((row) => (
                <tr
                  key={row.rowKey}
                  className="hover:bg-slate-50/60 transition-colors"
                >
                  <td className="py-3 px-3.5 text-center font-bold text-slate-400">
                    #{row.sourceRowNumber}
                  </td>

                  <td className="py-3 px-3.5">
                    {row.status === "valid" ? (
                      <Badge variant="success" size="sm" shape="pill" dot>
                        Valid
                      </Badge>
                    ) : (
                      <Badge variant="error" size="sm" shape="pill" dot>
                        Invalid
                      </Badge>
                    )}
                  </td>

                  <td className="py-3 px-3.5 font-sans">
                    <div className="flex flex-wrap gap-1.5 max-w-md">
                      {Object.entries(row.effectiveData || {}).map(
                        ([key, val]) => (
                          <span
                            key={key}
                            className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] border border-slate-200"
                          >
                            <span className="text-slate-400 font-mono text-[10px] mr-1">
                              {key}:
                            </span>
                            {String(val || "—")}
                          </span>
                        ),
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-3.5 font-sans">
                    <div className="flex flex-col gap-1">
                      {row.errors.map((err, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 text-rose-600 text-[11px]"
                        >
                          <Badge variant="error" size="sm" shape="rounded" mono>
                            {err.code}
                          </Badge>
                          <span>{err.message}</span>
                        </div>
                      ))}

                      {row.warnings.map((warn, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 text-amber-600 text-[11px]"
                        >
                          <Badge
                            variant="warning"
                            size="sm"
                            shape="rounded"
                            mono
                          >
                            <Copy className="w-2.5 h-2.5" />
                            {warn.code}
                          </Badge>
                          <span>{warn.message}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
