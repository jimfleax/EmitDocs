import { Table } from '@phosphor-icons/react';

interface WorksheetSelectorProps {
  worksheets: string[];
  selectedWorksheet: string;
  onSelectWorksheet: (sheetName: string) => void;
  disabled?: boolean;
}

export function WorksheetSelector({
  worksheets,
  selectedWorksheet,
  onSelectWorksheet,
  disabled = false,
}: WorksheetSelectorProps) {
  if (worksheets.length <= 1) {
    return null;
  }

  return (
    <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Table className="w-4 h-4 text-blue-500" />
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Select Worksheet
        </h4>
        <span className="text-xs text-slate-400">({worksheets.length} sheets found)</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {worksheets.map((sheet) => {
          const isSelected = sheet === selectedWorksheet;
          return (
            <button
              key={sheet}
              type="button"
              disabled={disabled}
              onClick={() => onSelectWorksheet(sheet)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer select-none'}`}
            >
              {sheet}
            </button>
          );
        })}
      </div>
    </div>
  );
}
