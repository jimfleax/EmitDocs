import {
  CheckCircle,
  Warning,
  Copy,
  ArrowRight,
  ArrowClockwise,
} from "@phosphor-icons/react";

interface SummaryData {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
}

interface ImportValidationSummaryProps {
  summary: SummaryData;
  onProceed: () => void;
  onReimport: () => void;
}

export function ImportValidationSummary({
  summary,
  onProceed,
  onReimport,
}: ImportValidationSummaryProps) {
  const { totalRows, validRows, invalidRows, duplicateRows } = summary;

  return (
    <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Validation Results
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Overview of validated records and integrity status.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onReimport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 border border-slate-200 shadow-xs transition-colors cursor-pointer select-none"
          >
            <ArrowClockwise className="w-4 h-4" />
            Re-import File
          </button>

          <button
            type="button"
            onClick={onProceed}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 active:scale-[0.98] text-xs font-semibold text-white shadow-sm transition-all cursor-pointer select-none"
          >
            Proceed to Review
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Rows */}
        <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-xs">
          <p className="text-xs font-medium text-slate-400">Total Imported</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">
            {totalRows.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Spreadsheet records
          </span>
        </div>

        {/* Valid Rows */}
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-emerald-600">
              Valid Records
            </p>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">
            {validRows.toLocaleString()}
          </p>
          <span className="text-[10px] text-emerald-500 mt-1 block">
            Ready for document issuance
          </span>
        </div>

        {/* Invalid Rows */}
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-rose-600">Invalid Records</p>
            <Warning className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-extrabold text-rose-700 mt-1">
            {invalidRows.toLocaleString()}
          </p>
          <span className="text-[10px] text-rose-500 mt-1 block">
            Missing or malformed data
          </span>
        </div>

        {/* Duplicate Rows */}
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-amber-600">Duplicates</p>
            <Copy className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-amber-700 mt-1">
            {duplicateRows.toLocaleString()}
          </p>
          <span className="text-[10px] text-amber-500 mt-1 block">
            Preserved with warnings
          </span>
        </div>
      </div>
    </div>
  );
}
