/**
 * @file RecipientClaimStatusTable.tsx
 * @description Searchable, paginated table of snapshot recipients with status and revoke action.
 * @architecture Data table component in ClaimPortalWorkspace recipients tab tracking individual recipient claim statuses.
 * @agent_note Displays claim timestamps, supports server-side search and status filters, and provides individual revocation modal.
 */

import { useState } from "react";
import {
  MagnifyingGlass,
  Prohibit,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/Spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export interface RecipientClaimStatusRow {
  _id: string;
  recipientKey: string;
  name: string;
  email: string;
  status: "eligible" | "claimed" | "revoked" | "excluded" | "expired";
  firstClaimAt?: string;
  lastClaimAt?: string;
}

export interface RecipientClaimStatusTableProps {
  portalId: string;
  recipients: RecipientClaimStatusRow[];
  totalCount: number;
  page: number;
  limit: number;
  search: string;
  statusFilter: string;
  onPageChange: (page: number) => void;
  onSearchChange: (search: string) => void;
  onStatusFilterChange: (status: string) => void;
  onRevokeRecipient: (recipientId: string) => Promise<void>;
  isLoading?: boolean;
}

/**
 * @component RecipientClaimStatusTable
 * @description Table displaying snapshot recipients, claim timestamps, status badges, and per-recipient credential revocation actions.
 * @param {RecipientClaimStatusTableProps} props - Component properties.
 * @param {string} props.portalId - Unique portal ID.
 * @param {RecipientClaimStatusRow[]} props.recipients - Current page of recipient rows.
 * @param {number} props.totalCount - Total recipient count matching active query.
 * @param {number} props.page - Current 1-based page number.
 * @param {number} props.limit - Rows per page.
 * @param {string} props.search - Active search filter string.
 * @param {string} props.statusFilter - Active status category filter.
 * @param {(page: number) => void} props.onPageChange - Page navigation handler.
 * @param {(search: string) => void} props.onSearchChange - Search input change handler.
 * @param {(status: string) => void} props.onStatusFilterChange - Status dropdown filter handler.
 * @param {(recipientId: string) => Promise<void>} props.onRevokeRecipient - Handler to revoke a specific recipient's claim access.
 * @param {boolean} [props.isLoading=false] - Loading indicator for table data.
 * @state {RecipientClaimStatusRow | null} revokeTarget - Recipient targeted for access revocation.
 * @state {boolean} isRevoking - In-flight state during revocation mutation.
 * @returns {JSX.Element} Paginated recipients management table with filters and revoke confirmation dialog.
 */
export function RecipientClaimStatusTable({
  recipients,
  totalCount,
  page,
  limit,
  search,
  statusFilter,
  onPageChange,
  onSearchChange,
  onStatusFilterChange,
  onRevokeRecipient,
  isLoading = false,
}: RecipientClaimStatusTableProps) {
  const [revokeTarget, setRevokeTarget] =
    useState<RecipientClaimStatusRow | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const handleRevokeConfirm = async () => {
    if (!revokeTarget) return;
    try {
      setIsRevoking(true);
      await onRevokeRecipient(revokeTarget._id);
      setRevokeTarget(null);
    } finally {
      setIsRevoking(false);
    }
  };

  const getStatusBadge = (status: RecipientClaimStatusRow["status"]) => {
    switch (status) {
      case "claimed":
        return (
          <Badge variant="success" size="sm" shape="pill" dot>
            Claimed
          </Badge>
        );
      case "eligible":
        return (
          <Badge variant="neutral" size="sm" shape="pill">
            Unclaimed
          </Badge>
        );
      case "revoked":
        return (
          <Badge variant="error" size="sm" shape="pill">
            Revoked
          </Badge>
        );
      case "excluded":
        return (
          <Badge variant="warning" size="sm" shape="pill">
            Excluded
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" size="sm" shape="pill">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-2xs space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Recipient Claim Log ({totalCount.toLocaleString()})
        </h4>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="h-8 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="eligible">Unclaimed</option>
            <option value="claimed">Claimed</option>
            <option value="revoked">Revoked</option>
            <option value="excluded">Excluded</option>
          </select>

          {/* Search Input */}
          <div className="relative w-48 sm:w-60">
            <MagnifyingGlass className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search recipient..."
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 flex items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-3.5 py-2.5 font-semibold">Row Key</th>
                <th className="px-3.5 py-2.5 font-semibold">Participant</th>
                <th className="px-3.5 py-2.5 font-semibold">Claim Status</th>
                <th className="px-3.5 py-2.5 font-semibold">First Claimed</th>
                <th className="px-3.5 py-2.5 text-right font-semibold">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No recipients found matching query.
                  </td>
                </tr>
              ) : (
                recipients.map((r) => (
                  <tr
                    key={r._id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-3.5 py-2.5 font-mono text-slate-500">
                      {r.recipientKey}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {r.name || "Participant"}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {r.email}
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5">
                      {getStatusBadge(r.status)}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-500">
                      {r.firstClaimAt
                        ? new Date(r.firstClaimAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      {r.status !== "revoked" && (
                        <button
                          type="button"
                          onClick={() => setRevokeTarget(r)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
                        >
                          <Prohibit className="w-3.5 h-3.5" />
                          <span>Revoke</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Bar */}
      <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
        <span>
          Page {page} of {totalPages} ({totalCount} total)
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            className="h-7 px-2 text-xs"
          >
            <CaretLeft className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="h-7 px-2 text-xs"
          >
            <CaretRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Revoke Dialog */}
      <Dialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke Recipient Claim?</DialogTitle>
            <DialogDescription>
              Revoking {revokeTarget?.name || "this participant"} prevents any
              further certificate retrieval or session token issuance.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRevokeTarget(null)}
              disabled={isRevoking}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeConfirm}
              disabled={isRevoking}
            >
              {isRevoking && <Spinner size="sm" />}
              <span>Confirm Revoke</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
