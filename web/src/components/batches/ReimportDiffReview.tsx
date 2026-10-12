import { useState } from 'react';
import type { ReimportDiffResult } from '@/types/diff';

export interface ReimportDiffReviewProps {
  diff: ReimportDiffResult;
  reconciliationKey: string;
}

export function ReimportDiffReview({ diff, reconciliationKey: _reconciliationKey }: ReimportDiffReviewProps) {
  const [activeTab, setActiveTab] = useState<'changed' | 'added' | 'removed' | 'conflicted'>('changed');

  const { summary } = diff;

  return (
    <div className="space-y-4">
      {/* Metric Cards Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Added</p>
          <p className="text-xl font-bold text-emerald-600 mt-0.5">+{summary.addedCount}</p>
        </div>

        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Removed</p>
          <p className="text-xl font-bold text-rose-600 mt-0.5">-{summary.removedCount}</p>
        </div>

        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Changed</p>
          <p className="text-xl font-bold text-blue-600 mt-0.5">{summary.changedCount}</p>
        </div>

        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Unchanged</p>
          <p className="text-xl font-bold text-slate-600 dark:text-slate-400 mt-0.5">{summary.unchangedCount}</p>
        </div>

        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Conflicted</p>
          <p className="text-xl font-bold text-amber-600 mt-0.5">{summary.conflictedCount}</p>
        </div>

        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Ambiguous</p>
          <p className="text-xl font-bold text-rose-600 mt-0.5">{summary.ambiguousCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('changed')}
          className={`px-3.5 py-2 font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'changed'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Changed Fields ({diff.changed.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('added')}
          className={`px-3.5 py-2 font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'added'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Added Rows ({diff.added.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('removed')}
          className={`px-3.5 py-2 font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'removed'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Removed Rows ({diff.removed.length})
        </button>
      </div>

      {/* Tab Panels */}
      <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
        {activeTab === 'changed' && (
          diff.changed.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No cell changes detected.</div>
          ) : (
            diff.changed.map((ch) => (
              <div key={ch.newRowId} className="p-3 text-xs bg-white dark:bg-slate-900 space-y-1">
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 block">
                  Key: {ch.rowKey}
                </span>
                <div className="space-y-1 pl-2">
                  {Object.entries(ch.diffs).map(([field, delta]) => (
                    <div key={field} className="flex items-center gap-2 text-[11px]">
                      <span className="font-semibold text-slate-500 font-mono">{field}:</span>
                      <span className="text-rose-500 line-through">{String(delta.old)}</span>
                      <span>→</span>
                      <span className="text-emerald-600 font-semibold">{String(delta.new)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )
        )}

        {activeTab === 'added' && (
          diff.added.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No new records added.</div>
          ) : (
            diff.added.map((ad) => (
              <div key={ad.newRowId} className="p-3 text-xs bg-white dark:bg-slate-900 flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    Row #{ad.sourceRowNumber} ({ad.rowKey})
                  </span>
                  <p className="text-[11px] text-slate-400 truncate max-w-md">{JSON.stringify(ad.data)}</p>
                </div>
                <span className="text-emerald-600 font-bold text-xs">+NEW</span>
              </div>
            ))
          )
        )}

        {activeTab === 'removed' && (
          diff.removed.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No records removed.</div>
          ) : (
            diff.removed.map((rm) => (
              <div key={rm.oldRowId} className="p-3 text-xs bg-white dark:bg-slate-900 flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    Row #{rm.sourceRowNumber} ({rm.rowKey})
                  </span>
                  <p className="text-[11px] text-slate-400 truncate max-w-md">{JSON.stringify(rm.data)}</p>
                </div>
                <span className="text-rose-600 font-bold text-xs">-REMOVED</span>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
