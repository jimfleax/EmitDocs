import { useState, useEffect, useRef } from 'react';
import {
  MagnifyingGlass,
  CheckCircle,
  X,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react';
import { FilterByIssue, type FilterFacet, type FilterCounts } from './FilterByIssue';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { DraftGallerySkeleton } from '@/components/skeletons/DraftGallerySkeleton';
import { cn } from '@/lib/utils';
import type { DraftRowItem } from './RowEditor';

export interface DraftGalleryProps {
  batchId: string;
  selectedRowId: string | null;
  onSelectRow: (row: DraftRowItem) => void;
  refreshTrigger: number;
}

export function DraftGallery({
  batchId,
  selectedRowId,
  onSelectRow,
  refreshTrigger,
}: DraftGalleryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterFacet>('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  const [rows, setRows] = useState<DraftRowItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState<FilterCounts>({
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    duplicateRows: 0,
    warningRows: 0,
    overriddenRows: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const isFirstLoadRef = useRef(true);

  // 300ms Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch draft rows from Slice 1 API Seam (mount-safe, no synchronous setState in effect)
  useEffect(() => {
    let isMounted = true;

    const loadRows = async () => {
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          filter: activeFilter,
        });
        if (debouncedQuery.trim().length > 0) {
          params.set('query', debouncedQuery.trim());
        }
        if (refreshTrigger) {
          params.set('_r', String(refreshTrigger));
        }

        const res = await fetch(`/api/batches/${batchId}/rows?${params.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to fetch draft rows');

        const data = await res.json();
        if (!isMounted) return;

        setRows(data.rows || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);

        if (data.summary) {
          setCounts(data.summary);
        }

        // Auto-select first row on initial load if none selected
        if (isFirstLoadRef.current && (data.rows || []).length > 0 && !selectedRowId) {
          isFirstLoadRef.current = false;
          onSelectRow(data.rows[0]);
        }
      } catch (err: any) {
        if (isMounted) {
          setApiError(err.message || 'Error loading draft gallery');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadRows();

    return () => {
      isMounted = false;
    };
  }, [batchId, page, limit, activeFilter, debouncedQuery, selectedRowId, onSelectRow, refreshTrigger]);

  const handleFilterChange = (newFilter: FilterFacet) => {
    setActiveFilter(newFilter);
    setIsLoading(true);
    setPage(1);
  };

  const getPrimaryIdentifier = (row: DraftRowItem) => {
    const data = row.effectiveData || {};
    return (
      data.recipientName ||
      data.studentName ||
      data.name ||
      data.fullName ||
      data.email ||
      row.rowKey
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
      {/* Top Controls Bar */}
      <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 space-y-3 shrink-0">
        {/* Search Input */}
        <div className="relative">
          <MagnifyingGlass className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search drafts by recipient, email, row # or custom key..."
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Issue Facet Filter Pills */}
        <FilterByIssue
          activeFilter={activeFilter}
          onSelectFilter={handleFilterChange}
          counts={counts}
        />
      </div>

      {/* Row List / Table */}
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
        {isLoading && rows.length === 0 ? (
          <DraftGallerySkeleton count={6} />
        ) : apiError ? (
          <div className="p-8 text-center text-rose-500 text-xs">{apiError}</div>
        ) : rows.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={<CheckCircle size={28} className="text-slate-400" />}
              title="No drafts match criteria"
              description="Try adjusting your search query or switching active issue filters."
            />
          </div>
        ) : (
          rows.map((row) => {
            const isSelected = row._id === selectedRowId;
            const primaryName = getPrimaryIdentifier(row);
            const isOverridden = Object.keys(row.overrides || {}).length > 0;

            return (
              <div
                key={row._id}
                onClick={() => onSelectRow(row)}
                className={cn(
                  'group flex items-center justify-between p-3.5 text-xs transition-all cursor-pointer select-none',
                  isSelected
                    ? 'bg-blue-50/70 dark:bg-blue-950/40 border-l-4 border-l-blue-600'
                    : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                )}
              >
                {/* Left: Indicator, Row Number & Name */}
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  {/* Status Dot */}
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      row.status === 'invalid'
                        ? 'bg-rose-500'
                        : row.isDuplicate
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    )}
                  />

                  {/* Row Number */}
                  <span className="font-mono text-slate-400 dark:text-slate-500 shrink-0 font-bold">
                    #{row.sourceRowNumber}
                  </span>

                  {/* Primary text */}
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'font-bold truncate',
                        isSelected
                          ? 'text-blue-900 dark:text-blue-200'
                          : 'text-slate-900 dark:text-slate-100'
                      )}
                    >
                      {primaryName}
                    </p>
                    {row.effectiveData?.email && row.effectiveData.email !== primaryName && (
                      <p className="text-[11px] text-slate-400 truncate">
                        {row.effectiveData.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Badges & Tags */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isOverridden && (
                    <Badge variant="primary" size="sm">
                      Override
                    </Badge>
                  )}

                  {row.isDuplicate && (
                    <Badge variant="warning" size="sm">
                      Duplicate
                    </Badge>
                  )}

                  {row.status === 'invalid' ? (
                    <Badge variant="error" size="sm">
                      {row.errors[0]?.message || 'Invalid'}
                    </Badge>
                  ) : (
                    <Badge variant="success" size="sm">
                      Valid
                    </Badge>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex items-center justify-between text-xs text-slate-500 shrink-0">
        <div>
          Showing {rows.length > 0 ? (page - 1) * limit + 1 : 0}–
          {Math.min(page * limit, total)} of {total.toLocaleString()}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              setIsLoading(true);
              setPage((p) => Math.max(1, p - 1));
            }}
            className="p-1 rounded-md border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Previous page"
          >
            <CaretLeft className="w-3.5 h-3.5" />
          </button>

          <span className="px-2 font-semibold">
            {page} / {totalPages || 1}
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => {
              setIsLoading(true);
              setPage((p) => Math.min(totalPages, p + 1));
            }}
            className="p-1 rounded-md border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Next page"
          >
            <CaretRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
