import { Funnel } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export type FilterFacet = 'all' | 'valid' | 'invalid' | 'duplicate' | 'warning' | 'overridden';

export interface FilterCounts {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  warningRows: number;
  overriddenRows: number;
}

interface FilterByIssueProps {
  activeFilter: FilterFacet;
  onSelectFilter: (filter: FilterFacet) => void;
  counts: FilterCounts;
  className?: string;
}

export function FilterByIssue({
  activeFilter,
  onSelectFilter,
  counts,
  className,
}: FilterByIssueProps) {
  const facets: Array<{
    id: FilterFacet;
    label: string;
    count: number;
    activeClass: string;
  }> = [
    {
      id: 'all',
      label: 'All',
      count: counts.totalRows,
      activeClass: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs',
    },
    {
      id: 'valid',
      label: 'Valid',
      count: counts.validRows,
      activeClass: 'bg-emerald-600 text-white dark:bg-emerald-500 shadow-xs',
    },
    {
      id: 'invalid',
      label: 'Invalid',
      count: counts.invalidRows,
      activeClass: 'bg-rose-600 text-white dark:bg-rose-500 shadow-xs',
    },
    {
      id: 'duplicate',
      label: 'Duplicates',
      count: counts.duplicateRows,
      activeClass: 'bg-amber-600 text-white dark:bg-amber-500 shadow-xs',
    },
    {
      id: 'warning',
      label: 'Warnings',
      count: counts.warningRows,
      activeClass: 'bg-amber-500 text-white dark:bg-amber-500 shadow-xs',
    },
    {
      id: 'overridden',
      label: 'Overridden',
      count: counts.overriddenRows,
      activeClass: 'bg-blue-600 text-white dark:bg-blue-500 shadow-xs',
    },
  ];

  return (
    <div
      className={cn(
        'flex items-center gap-1 overflow-x-auto p-1 bg-slate-100/80 dark:bg-slate-900/80 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs select-none no-scrollbar',
        className
      )}
    >
      <div className="flex items-center gap-1 px-2 text-slate-400 dark:text-slate-500 shrink-0">
        <Funnel className="w-3.5 h-3.5" />
      </div>

      {facets.map((f) => {
        const isActive = activeFilter === f.id;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onSelectFilter(f.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 cursor-pointer min-h-[32px]',
              isActive
                ? f.activeClass
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
            )}
          >
            <span>{f.label}</span>
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                isActive
                  ? 'bg-white/20 text-current'
                  : 'bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              )}
            >
              {f.count.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
