import React from 'react';
import type { DetectedToken } from '@/lib/pdf-engine/token-detector';
import type { IFieldMapping } from './types';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { X } from '@phosphor-icons/react';

interface DetectedTokenListProps {
  tokens: DetectedToken[];
  fieldMappings: IFieldMapping[];
  activePageIndex: number;
  onConfirmToken: (token: DetectedToken) => void;
  onDismissToken: (token: DetectedToken) => void;
}

export const DetectedTokenList: React.FC<DetectedTokenListProps> = ({
  tokens,
  fieldMappings,
  activePageIndex,
  onConfirmToken,
  onDismissToken,
}) => {
  // Filter tokens on current page not yet confirmed as fields
  const unconfirmedTokens = tokens.filter(
    (t) =>
      t.pageIndex === activePageIndex &&
      !fieldMappings.some((m) => m.key === t.key && m.pageIndex === activePageIndex)
  );

  if (unconfirmedTokens.length === 0) {
    return (
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-500 text-center">
        No unconfirmed placeholder tokens detected on this page.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
        <span>Suggested Tokens ({unconfirmedTokens.length})</span>
        <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
          Unconfirmed
        </span>
      </div>

      <p className="text-[11px] text-slate-500 leading-tight">
        Detected double-brace tokens. Click <span className="font-semibold text-slate-700">Confirm</span> to create an editable dynamic field.
      </p>

      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {unconfirmedTokens.map((token, idx) => (
          <div
            key={`sug-${token.key}-${idx}`}
            className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded text-xs hover:border-blue-300 transition-colors shadow-2xs"
          >
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-mono text-blue-600 font-medium truncate max-w-[120px]">
                &#123;&#123;{token.key}&#125;&#125;
              </span>
              <Tooltip
                content={token.confidence === 'split-span' ? 'Spanned multiple text runs' : 'Single text item'}
                side="top"
              >
                <span
                  className={`text-[9px] px-1 py-0.2 rounded font-sans ${
                    token.confidence === 'split-span'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {token.confidence === 'split-span' ? 'reconstructed' : 'exact'}
                </span>
              </Tooltip>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="default"
                size="sm"
                onClick={() => onConfirmToken(token)}
                className="h-6 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-medium"
              >
                Confirm
              </Button>
              <Tooltip content="Dismiss suggestion" side="left">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDismissToken(token)}
                  className="h-6 w-6 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X size={12} weight="bold" />
                </Button>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
