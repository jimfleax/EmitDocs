/**
 * @file ExcludedRecipientReviewTable.tsx
 * @description Table listing recipients excluded from the claim portal with exclusion reason.
 * @architecture Review component in ClaimPortalWorkspace preflight tab explaining why particular recipients cannot claim.
 * @agent_note Includes client-side search filtering by name, email, recipient key, or exclusion rationale.
 */

import { useState } from "react";
import { MagnifyingGlass, CheckCircle } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";

export interface ExcludedRecipientItem {
  recipientKey: string;
  name?: string;
  email?: string;
  reason: string;
}

export interface ExcludedRecipientReviewTableProps {
  excludedRecipients: ExcludedRecipientItem[];
}

/**
 * @component ExcludedRecipientReviewTable
 * @description Searchable table enumerating recipients ineligible for portal claims alongside specific rejection reasons.
 * @param {ExcludedRecipientReviewTableProps} props - Component properties.
 * @param {ExcludedRecipientItem[]} props.excludedRecipients - List of excluded recipient items.
 * @state {string} search - Search query string for filtering excluded rows.
 * @returns {JSX.Element} Table of excluded recipients with search filter or success state if clean.
 */
export function ExcludedRecipientReviewTable({
  excludedRecipients,
}: ExcludedRecipientReviewTableProps) {
  const [search, setSearch] = useState("");

  if (!excludedRecipients || excludedRecipients.length === 0) {
    return (
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" weight="fill" />
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Zero excluded recipients. All snapshot records meet portal eligibility requirements.
        </p>
      </div>
    );
  }

  const filtered = excludedRecipients.filter(
    (r) =>
      r.recipientKey.toLowerCase().includes(search.toLowerCase()) ||
      (r.name && r.name.toLowerCase().includes(search.toLowerCase())) ||
      (r.email && r.email.toLowerCase().includes(search.toLowerCase())) ||
      r.reason.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-2xs space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Excluded Recipients ({excludedRecipients.length})
        </h4>
        <div className="relative w-full sm:w-64">
          <MagnifyingGlass className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search excluded rows..."
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="px-3.5 py-2 font-semibold">Row / Key</th>
              <th className="px-3.5 py-2 font-semibold">Recipient</th>
              <th className="px-3.5 py-2 font-semibold">Exclusion Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.slice(0, 50).map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="px-3.5 py-2 font-mono text-slate-600 dark:text-slate-400">
                  {item.recipientKey}
                </td>
                <td className="px-3.5 py-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {item.name || "—"}
                  </div>
                  {item.email && (
                    <div className="text-[11px] text-slate-400">{item.email}</div>
                  )}
                </td>
                <td className="px-3.5 py-2 text-rose-600 font-medium">
                  {item.reason}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
