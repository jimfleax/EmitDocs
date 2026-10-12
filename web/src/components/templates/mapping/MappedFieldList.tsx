import React from 'react';
import type { IFieldMapping } from './types';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { Trash } from '@phosphor-icons/react';

interface MappedFieldListProps {
  fields: IFieldMapping[];
  activePageIndex: number;
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  onDeleteField: (id: string) => void;
}

export const MappedFieldList: React.FC<MappedFieldListProps> = ({
  fields,
  activePageIndex,
  selectedFieldId,
  onSelectField,
  onDeleteField,
}) => {
  const pageFields = fields.filter((f) => f.pageIndex === activePageIndex);

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
        <span>Mapped Fields ({fields.length})</span>
        <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
          {pageFields.length} on Page {activePageIndex + 1}
        </span>
      </div>

      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
        {fields.map((field) => {
          const isSelected = field.id === selectedFieldId;
          const isCurrentPage = field.pageIndex === activePageIndex;

          return (
            <div
              key={field.id}
              onClick={() => onSelectField(field.id)}
              className={`p-2 rounded border text-xs cursor-pointer transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50/80 ring-1 ring-blue-500 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isSelected ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  />
                  <span className="font-mono text-xs font-semibold text-slate-800 truncate">
                    &#123;&#123;{field.key}&#125;&#125;
                  </span>
                  {!isCurrentPage && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                      p.{field.pageIndex + 1}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-slate-400 capitalize">
                    {field.type}
                  </span>
                  <Tooltip content="Remove field" side="left">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteField(field.id);
                      }}
                      className="h-5 w-5 text-slate-400 hover:text-red-600 transition-colors p-0"
                    >
                      <Trash size={12} weight="bold" />
                    </Button>
                  </Tooltip>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 pl-3.5">
                <span>{field.fontFamily || 'Helvetica'}</span>
                <span>•</span>
                <span>{field.fontSize || 12}pt</span>
                {field.fitMode === 'multi-line' && (
                  <>
                    <span>•</span>
                    <span className="text-[9px] bg-purple-50 text-purple-700 px-1 py-0.2 rounded border border-purple-200">
                      wrap
                    </span>
                  </>
                )}
                <span>•</span>
                <span className="truncate max-w-[100px] text-slate-400">
                  {field.label || 'No label'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
