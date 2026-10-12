import { useEffect, useCallback, useRef } from 'react';
import { ArrowsLeftRight, MagicWand, WarningCircle } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/Badge';

interface FieldItem {
  key: string;
  label?: string;
  type?: string;
  required?: boolean;
}

interface ColumnMappingTableProps {
  fields: FieldItem[];
  availableHeaders: string[];
  columnMap: Record<string, string>;
  onChangeMapping: (newMap: Record<string, string>) => void;
  dateHints?: Record<string, 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'>;
  onChangeDateHint?: (key: string, hint: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD') => void;
}

export function ColumnMappingTable({
  fields,
  availableHeaders,
  columnMap,
  onChangeMapping,
  dateHints = {},
  onChangeDateHint,
}: ColumnMappingTableProps) {
  const hasAutoSuggestedRef = useRef(false);

  // Heuristic auto-suggest function
  const runAutoSuggest = useCallback(() => {
    const updated = { ...columnMap };
    for (const field of fields) {
      if (updated[field.key]) continue; // already mapped

      const normalizedKey = field.key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizedLabel = (field.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      const match = availableHeaders.find((h) => {
        const normH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normH === normalizedKey || normH === normalizedLabel;
      });

      if (match) {
        updated[field.key] = match;
      }
    }
    onChangeMapping(updated);
  }, [columnMap, fields, availableHeaders, onChangeMapping]);

  // Run auto-suggest initially if columnMap is empty
  useEffect(() => {
    if (!hasAutoSuggestedRef.current && Object.keys(columnMap).length === 0 && availableHeaders.length > 0) {
      hasAutoSuggestedRef.current = true;
      runAutoSuggest();
    }
  }, [columnMap, availableHeaders, runAutoSuggest]);

  const handleSelectHeader = (fieldKey: string, header: string) => {
    const updated = { ...columnMap };
    if (!header || header === '__UNMAPPED__') {
      delete updated[fieldKey];
    } else {
      updated[fieldKey] = header;
    }
    onChangeMapping(updated);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Map Columns to Template Fields</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Select which column in your spreadsheet corresponds to each template field.
          </p>
        </div>
        <button
          type="button"
          onClick={runAutoSuggest}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-blue-600 transition-colors cursor-pointer select-none shadow-xs"
        >
          <MagicWand className="w-3.5 h-3.5" />
          Auto-Suggest
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-100">
            <tr>
              <th className="py-3 px-4">Template Placeholder</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4 text-center w-12">
                <ArrowsLeftRight className="w-4 h-4 mx-auto text-slate-300" />
              </th>
              <th className="py-3 px-4">Spreadsheet Column</th>
              <th className="py-3 px-4">Format / Options</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fields.map((f) => {
              const mappedColumn = columnMap[f.key] || '';
              const isRequired = f.required !== false;
              const isUnmapped = !mappedColumn && isRequired;

              return (
                <tr key={f.key} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-slate-800">
                    <div className="flex items-center gap-2">
                      <span>{f.label || f.key}</span>
                      {isRequired ? (
                        <span className="text-[10px] text-amber-500 font-bold">*</span>
                      ) : (
                        <span className="text-[10px] text-slate-400">(opt)</span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">{`{{${f.key}}}`}</span>
                  </td>

                  <td className="py-3.5 px-4">
                    <Badge variant="neutral" size="sm" shape="rounded" mono>
                      {f.type || 'text'}
                    </Badge>
                  </td>

                  <td className="py-3.5 px-4 text-center text-slate-300">→</td>

                  <td className="py-3.5 px-4">
                    <div className="relative">
                      <select
                        value={mappedColumn || '__UNMAPPED__'}
                        onChange={(e) => handleSelectHeader(f.key, e.target.value)}
                        className={`w-full max-w-xs px-3 py-1.5 rounded-lg text-xs font-medium bg-white border transition-all ${
                          isUnmapped
                            ? 'border-amber-300 text-amber-700 bg-amber-50'
                            : mappedColumn
                            ? 'border-blue-300 text-slate-800 bg-blue-50/30'
                            : 'border-slate-200 text-slate-400'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400`}
                      >
                        <option value="__UNMAPPED__">-- Do Not Map --</option>
                        {availableHeaders.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                      {isUnmapped && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-600 mt-1 font-medium">
                          <WarningCircle className="w-3 h-3" /> Required field is unmapped
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-slate-400">
                    {f.type === 'date' && onChangeDateHint ? (
                      <select
                        value={dateHints[f.key] || 'YYYY-MM-DD'}
                        onChange={(e) =>
                          onChangeDateHint(
                            f.key,
                            e.target.value as 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
                          )
                        }
                        className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        <option value="YYYY-MM-DD">ISO (YYYY-MM-DD)</option>
                        <option value="DD/MM/YYYY">UK/EU (DD/MM/YYYY)</option>
                        <option value="MM/DD/YYYY">US (MM/DD/YYYY)</option>
                      </select>
                    ) : (
                      <span className="text-[11px] text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
