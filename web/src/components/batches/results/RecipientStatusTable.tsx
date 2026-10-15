/**
 * @file RecipientStatusTable.tsx
 * @description Paginated, searchable listing of approved recipients with generation status and row actions (PRD-CORE-07).
 */

import { useState, useMemo } from "react";
import {
  MagnifyingGlass,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { SingleRecipientAction } from "./SingleRecipientAction";
import type { EngineWarning } from "@/lib/pdf-engine/pdf-preview-engine";

export interface RecipientStatusTableProps {
  recipients: Array<{
    _id?: string;
    recipientKey: string;
    sourceRowNumber: number;
    effectiveData: Record<string, any>;
    status?: string;
    generationStatus?: string;
  }>;
  generatedMap: Record<string, { byteLength: number; generatedAt: number }>;
  warningsMap: Record<string, EngineWarning[]>;
  onGenerateSingle: (recipient: {
    recipientKey: string;
    effectiveData: Record<string, any>;
  }) => Promise<{
    pdfBytes: Uint8Array;
    warnings: EngineWarning[];
    durationMs?: number;
  }>;
  totalCount: number;
  page: number;
  limit: number;
  onPageChange: (newPage: number) => void;
  isLoading?: boolean;
}

export function RecipientStatusTable({
  recipients,
  generatedMap,
  warningsMap,
  onGenerateSingle,
  totalCount,
  page,
  limit,
  onPageChange,
  isLoading = false,
}: RecipientStatusTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRecipients = useMemo(() => {
    if (!searchTerm.trim()) return recipients;
    const term = searchTerm.toLowerCase().trim();
    return recipients.filter((r) => {
      if (r.recipientKey.toLowerCase().includes(term)) return true;
      const dataStr = Object.values(r.effectiveData || {})
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return dataStr.includes(term);
    });
  }, [recipients, searchTerm]);

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Table Header with Search */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Approved Recipients ({totalCount.toLocaleString()})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Instant preview (&lt;20ms) and direct PDF download available per recipient.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <MagnifyingGlass className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search key or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table Element */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-2.5 px-4 w-16">Row</th>
              <th className="py-2.5 px-4">Recipient Key</th>
              <th className="py-2.5 px-4">Effective Details</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                  Loading recipients...
                </td>
              </tr>
            ) : filteredRecipients.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                  No matching recipient records found.
                </td>
              </tr>
            ) : (
              filteredRecipients.map((rec) => {
                const isGenerated = Boolean(generatedMap[rec.recipientKey]);
                const warnings = warningsMap[rec.recipientKey] || [];
                const hasWarnings = warnings.length > 0;

                const primaryName =
                  rec.effectiveData.studentName ||
                  rec.effectiveData.name ||
                  rec.effectiveData.fullName ||
                  rec.effectiveData.recipientName ||
                  "—";

                const secondaryId =
                  rec.effectiveData.studentId ||
                  rec.effectiveData.id ||
                  rec.effectiveData.email ||
                  "";

                return (
                  <tr
                    key={rec.recipientKey}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono text-slate-500">
                      #{rec.sourceRowNumber}
                    </td>

                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {rec.recipientKey}
                    </td>

                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {primaryName}
                      </div>
                      {secondaryId && (
                        <div className="text-[11px] font-mono text-slate-400">
                          {secondaryId}
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-4">
                      {hasWarnings ? (
                        <Badge variant="warning" size="sm" shape="pill" dot>
                          Warned ({warnings.length})
                        </Badge>
                      ) : isGenerated ? (
                        <Badge variant="success" size="sm" shape="pill">
                          Generated
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="sm" shape="pill">
                          Pending
                        </Badge>
                      )}
                    </td>

                    <td className="py-2.5 px-4 text-right">
                      <SingleRecipientAction
                        recipient={rec}
                        onGenerateSingle={onGenerateSingle}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 bg-slate-50/50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        <span className="text-slate-500">
          Page {page} of {totalPages}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <CaretLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <CaretRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
