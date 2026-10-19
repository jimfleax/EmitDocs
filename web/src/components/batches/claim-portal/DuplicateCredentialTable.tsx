/**
 * @file DuplicateCredentialTable.tsx
 * @description Table of duplicate credential collisions blocking portal activation.
 * @architecture Diagnostic table component rendered in ClaimPortalWorkspace when imported credential columns contain collisions.
 * @agent_note Identifies colliding values, duplicate frequencies, and associated recipient rows to guide data remediation.
 */

import { Warning } from "@phosphor-icons/react";

export interface DuplicateCredentialItem {
  value: string;
  count: number;
  recipientKeys?: string[];
}

export interface DuplicateCredentialTableProps {
  collisions: DuplicateCredentialItem[];
}

/**
 * @component DuplicateCredentialTable
 * @description Collapsible table listing duplicate credential values and affected recipient rows blocking portal activation.
 * @param {DuplicateCredentialTableProps} props - Component properties.
 * @param {DuplicateCredentialItem[]} props.collisions - Array of collision records with frequency counts.
 * @returns {JSX.Element | null} Danger alert table showing colliding records, or null if none exist.
 */
export function DuplicateCredentialTable({
  collisions,
}: DuplicateCredentialTableProps) {
  if (!collisions || collisions.length === 0) return null;

  return (
    <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
      <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 flex items-center gap-2">
        <Warning className="w-4 h-4 text-rose-600 shrink-0" weight="fill" />
        <span className="text-xs font-bold text-rose-900 dark:text-rose-200">
          Duplicate Identifier Collisions ({collisions.length} blocking records)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="px-4 py-2.5 font-semibold">
                Normalized Credential Value
              </th>
              <th className="px-4 py-2.5 font-semibold">Duplicates</th>
              <th className="px-4 py-2.5 font-semibold">
                Recipient Rows / Keys
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {collisions.map((item, idx) => (
              <tr key={idx} className="hover:bg-rose-50/30 transition-colors">
                <td className="px-4 py-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                  {item.value}
                </td>
                <td className="px-4 py-2.5 text-rose-600 font-semibold">
                  {item.count} occurrences
                </td>
                <td className="px-4 py-2.5 text-slate-500 font-mono">
                  {item.recipientKeys ? item.recipientKeys.join(", ") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
