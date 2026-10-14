/**
 * @file TemplateVersionSummary.tsx
 * @description Card summarizing locked template version, mapping hash, and import revision for batch approval.
 */

import { FilePdf, Hash, GitBranch } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";

interface TemplateVersionSummaryProps {
  templateName?: string;
  templateVersion: {
    id: string;
    version: number;
    mappingHash: string;
    sourceObjectKey?: string;
  };
  importRevision: number;
}

export function TemplateVersionSummary({
  templateName,
  templateVersion,
  importRevision,
}: TemplateVersionSummaryProps) {
  const shortHash = templateVersion.mappingHash
    ? `${templateVersion.mappingHash.slice(0, 10)}...${templateVersion.mappingHash.slice(-6)}`
    : "None";

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
      <div className="flex items-center gap-2 mb-3">
        <FilePdf className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Template & Mapping Immutability
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 dark:text-slate-400">Target Template</span>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
            {templateName || "Active Template"}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-slate-500 dark:text-slate-400">Locked Version & Revision</span>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="primary" size="sm" mono>
              Version {templateVersion.version}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <GitBranch className="w-3.5 h-3.5" />
              <span>Rev {importRevision}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-slate-500 dark:text-slate-400">Canonical Mapping SHA-256</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Hash className="w-3.5 h-3.5 text-slate-400" />
            <code className="text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
              {shortHash}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
