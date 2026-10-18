/**
 * @file RecipientStatusTable.tsx
 * @description Paginated, searchable listing of approved recipients with generation status and row actions (PRD-CORE-07).
 * @architecture Data table in ResultsWorkspace enabling inspection of generated PDFs, on-demand single rendering, and error tracking.
 * @agent_note Supports client-side name search filtering, server pagination callbacks, and per-recipient canvas preview triggers.
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
  errorsMap?: Record<string, string>;
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

/**
 * @component RecipientStatusTable
 * @description Table displaying approved recipients, individual generation status badges, byte sizes, and preview/download actions.
 * @param {RecipientStatusTableProps} props - Component properties.
 * @param {Array<Object>} props.recipients - List of recipient records for the current page.
 * @param {Record<string, { byteLength: number; generatedAt: number }>} props.generatedMap - Cache of generated document metadata indexed by recipient key.
 * @param {Record<string, EngineWarning[]>} props.warningsMap - PDF layout warnings indexed by recipient key.
 * @param {Record<string, string>} [props.errorsMap] - PDF generation errors indexed by recipient key.
 * @param {Function} props.onGenerateSingle - On-demand generator function for individual recipient preview/download.
 * @param {number} props.totalCount - Total recipient count across all pages.
 * @param {number} props.page - Current 1-based page number.
 * @param {number} props.limit - Page row limit.
 * @param {(newPage: number) => void} props.onPageChange - Pagination navigation handler.
 * @param {boolean} [props.isLoading=false] - Whether recipient rows are currently being loaded.
 * @state {string} searchTerm - Client-side filter query for recipient names and identifiers.
 * @returns {JSX.Element} Paginated recipient table with search bar and action buttons.
 */
export function RecipientStatusTable({
  recipients,
  generatedMap,
  warningsMap,
  errorsMap,
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
            placeholder="Search recipient or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table Element */}
      <div className="overflow-x-auto">
        <table className="w-full text-center border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4 w-20 text-center">Row</th>
              <th className="py-3 px-4 text-center">Recipient Details</th>
              <th className="py-3 px-4 w-40 text-center">Status</th>
              <th className="py-3 px-4 w-44 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                  Loading recipients...
                </td>
              </tr>
            ) : filteredRecipients.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                  No matching recipient records found.
                </td>
              </tr>
            ) : (
              filteredRecipients.map((rec) => {
                const isGenerated = Boolean(generatedMap[rec.recipientKey]);
                const warnings = warningsMap[rec.recipientKey] || [];
                const hasWarnings = warnings.length > 0;
                const rowError = errorsMap?.[rec.recipientKey];

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
                    <td
                      className="py-3 px-4 font-mono text-slate-500 align-middle whitespace-nowrap text-center"
                      title={`Record Key: ${rec.recipientKey}`}
                    >
                      #{rec.sourceRowNumber}
                    </td>

                    <td className="py-3 px-4 align-middle text-center">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 text-center">
                        {primaryName}
                      </div>
                      {secondaryId && (
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5 text-center">
                          {secondaryId}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 align-middle whitespace-nowrap text-center">
                      {rowError ? (
                        <div className="flex flex-col items-center gap-1 justify-center">
                          <Badge variant="error" size="sm" shape="pill" title={rowError}>
                            Failed
                          </Badge>
                          <span
                            className="text-[10px] text-rose-600 dark:text-rose-400 max-w-[180px] truncate text-center"
                            title={rowError}
                          >
                            {rowError}
                          </span>
                        </div>
                      ) : hasWarnings ? (
                        <div className="flex justify-center">
                          <Badge variant="warning" size="sm" shape="pill" dot>
                            Warned ({warnings.length})
                          </Badge>
                        </div>
                      ) : isGenerated ? (
                        <div className="flex justify-center">
                          <Badge variant="success" size="sm" shape="pill">
                            Generated
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <Badge variant="neutral" size="sm" shape="pill">
                            Pending
                          </Badge>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center align-middle whitespace-nowrap">
                      <div className="flex justify-center">
                        <SingleRecipientAction
                          recipient={rec}
                          onGenerateSingle={onGenerateSingle}
                        />
                      </div>
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
