/**
 * @file InvalidRowsNotice.tsx
 * @description Alert notice banner displayed when draft rows contain errors that will be excluded upon approval.
 * @architecture Warning presentation component rendered in ApprovalWorkspace informing the user of partial issuance.
 * @agent_note Only rendered when invalidRows > 0, explaining that invalid rows will be skipped while valid rows proceed.
 */

import { WarningCircle, CheckSquareOffset } from "@phosphor-icons/react";

interface InvalidRowsNoticeProps {
  invalidRows: number;
  validRows: number;
}

/**
 * @component InvalidRowsNotice
 * @description Informational alert detailing invalid row exclusion rules prior to batch snapshot approval.
 * @param {InvalidRowsNoticeProps} props - Component properties.
 * @param {number} props.invalidRows - Number of excluded invalid draft rows.
 * @param {number} props.validRows - Number of valid rows proceeding to issuance.
 * @returns {JSX.Element | null} Banner element if invalid rows exist, otherwise null.
 */
export function InvalidRowsNotice({ invalidRows, validRows }: InvalidRowsNoticeProps) {
  if (invalidRows === 0) return null;

  return (
    <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 flex items-start gap-3.5">
      <WarningCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1">
        <h4 className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wide">
          Partial Issuance Notice
        </h4>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
          <strong>{invalidRows} invalid row{invalidRows > 1 ? "s" : ""}</strong> failed data format checks and will be <strong>excluded</strong> from this snapshot.
          The remaining <strong>{validRows} valid recipient{validRows > 1 ? "s" : ""}</strong> will proceed to document generation without interruption.
        </p>
        <div className="flex items-center gap-1.5 mt-2 text-[11px] font-medium text-amber-800/80 dark:text-amber-200/80">
          <CheckSquareOffset className="w-3.5 h-3.5" />
          <span>Excluded rows can be corrected later by re-importing an updated spreadsheet revision.</span>
        </div>
      </div>
    </div>
  );
}
