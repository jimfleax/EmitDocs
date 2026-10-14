/**
 * @file BatchList.tsx
 * @description Batches index table displaying imported batches, validation counts, status badges, and action dropdowns.
 * @architecture Top-level dashboard page component for managing certificate issuance batches.
 * @agent_note Fetches batch catalog from /api/batches, supports client-side search filtering, row deletion, and navigation to import or review.
 */

import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  MagnifyingGlass,
  Plus,
  Trash,
  Stack,
  Certificate,
  CalendarBlank,
  DotsThreeVertical,
  Eye,
  ArrowRight,
  CircleNotch,
} from "@phosphor-icons/react";
import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { toast } from "@/components/ui/toast";
import { BatchListSkeleton } from "@/components/skeletons/BatchListSkeleton";

interface TemplateRef {
  _id?: string;
  name?: string;
  thumbnailUrl?: string;
}

interface BatchItem {
  _id: string;
  name: string;
  status: string;
  templateId?: string | TemplateRef;
  templateVersionId?: string;
  totalRows?: number;
  validRows?: number;
  invalidRows?: number;
  duplicateRows?: number;
  createdAt: string;
  updatedAt?: string;
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

function getBatchStatusBadge(status: string) {
  switch (status) {
    case "ready_for_download":
    case "approved":
      return { label: "Ready", variant: "success" as const };
    case "review":
    case "awaiting_approval":
      return { label: "In Review", variant: "primary" as const };
    case "draft":
      return { label: "Draft", variant: "neutral" as const };
    case "importing":
      return { label: "Importing", variant: "warning" as const };
    case "generating":
      return { label: "Generating", variant: "warning" as const };
    case "failed":
    case "cancelled":
      return { label: "Failed", variant: "error" as const };
    default:
      return { label: status, variant: "neutral" as const };
  }
}

type StatusFilterType = "all" | "ready_for_download" | "review" | "draft";

/**
 * @component BatchList
 * @description Main batch inventory view with status badges, validation tallies, search, and context actions.
 * @returns {JSX.Element} Batches listing dashboard.
 */
export function BatchList() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("all");
  const [deleteTarget, setDeleteTarget] = useState<BatchItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    async function fetchBatches() {
      try {
        setLoading(true);
        setError("");
        const url =
          retryCount > 0 ? `/api/batches?_r=${retryCount}` : "/api/batches";
        const res = await fetch(url, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch batches (${res.status})`);
        }
        const data = await res.json();
        if (!isCancelled) {
          const list: BatchItem[] = Array.isArray(data)
            ? data
            : Array.isArray(data?.batches)
              ? data.batches
              : [];
          setBatches(list);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to fetch batches";
          setError(message);
          toast.error("Failed to load batches", message);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    fetchBatches();

    return () => {
      isCancelled = true;
    };
  }, [retryCount]);

  // Keyboard escape listener for delete confirmation modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && deleteTarget && !isDeleting) {
        setDeleteTarget(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteTarget, isDeleting]);

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      // Status filter
      if (statusFilter !== "all" && b.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = b.name.toLowerCase().includes(q);
        const templateName =
          typeof b.templateId === "object" && b.templateId?.name
            ? b.templateId.name.toLowerCase()
            : "";
        const matchesTemplate = templateName.includes(q);
        const matchesStatus = b.status.toLowerCase().includes(q);
        return matchesName || matchesTemplate || matchesStatus;
      }

      return true;
    });
  }, [batches, searchQuery, statusFilter]);

  const confirmDelete = async (id: string) => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/batches/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.error || errData.message || "Failed to delete batch",
        );
      }
      setBatches((prev) => prev.filter((b) => b._id !== id));
      toast.success(
        "Batch deleted",
        `"${deleteTarget.name}" and associated records were deleted.`,
      );
      setDeleteTarget(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Delete failed";
      toast.error("Deletion failed", message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <PageShell
      title="Batches"
      subtitle="Manage, track, and review issued document batches and generation runs"
      backTo="/app"
      backLabel="Back to Dashboard"
      isLoading={loading}
      skeleton={<BatchListSkeleton />}
      loadingTitle="Loading batches..."
      actions={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <MagnifyingGlass
              size={18}
              weight="bold"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search batches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* New Batch CTA Button */}
          <Link
            to="/app/batches/new"
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer select-none text-sm shrink-0"
          >
            <Plus size={16} weight="bold" />
            <span>New Batch</span>
          </Link>
        </div>
      }
    >
      {/* Error Alert */}
      {error && (
        <Alert variant="error" onRetry={() => setRetryCount((c) => c + 1)}>
          {error}
        </Alert>
      )}

      {/* Sub-header Filter Tabs */}
      {!loading && !error && batches.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-semibold text-slate-400 mr-1 shrink-0 select-none">
            Filter:
          </span>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none shrink-0 ${
              statusFilter === "all"
                ? "bg-blue-600 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
            }`}
          >
            All ({batches.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ready_for_download")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none shrink-0 ${
              statusFilter === "ready_for_download"
                ? "bg-blue-600 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
            }`}
          >
            Ready (
            {
              batches.filter(
                (b) =>
                  b.status === "ready_for_download" || b.status === "approved",
              ).length
            }
            )
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("review")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none shrink-0 ${
              statusFilter === "review"
                ? "bg-blue-600 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
            }`}
          >
            In Review (
            {
              batches.filter(
                (b) =>
                  b.status === "review" || b.status === "awaiting_approval",
              ).length
            }
            )
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("draft")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none shrink-0 ${
              statusFilter === "draft"
                ? "bg-blue-600 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
            }`}
          >
            Draft (
            {
              batches.filter(
                (b) => b.status === "draft" || b.status === "importing",
              ).length
            }
            )
          </button>
        </div>
      )}

      {/* Empty State */}
      {!error && filteredBatches.length === 0 && (
        <EmptyState
          icon={<Stack size={28} weight="duotone" />}
          title={
            searchQuery.trim() || statusFilter !== "all"
              ? "No matching batches"
              : "No batches yet"
          }
          description={
            searchQuery.trim() || statusFilter !== "all"
              ? `No batches matched your current filter. Try searching for something else or clearing filters.`
              : "Import data from a spreadsheet or CSV and issue your first batch of documents."
          }
          variant={
            searchQuery.trim() || statusFilter !== "all" ? "solid" : "dashed"
          }
          action={
            searchQuery.trim() || statusFilter !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            ) : (
              <Link
                to="/app/batches/new"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer select-none text-sm"
              >
                <Plus size={16} weight="bold" />
                <span>Create your first batch</span>
              </Link>
            )
          }
        />
      )}

      {/* Batch Card-Row List */}
      {!loading && !error && filteredBatches.length > 0 && (
        <div className="space-y-3">
          {filteredBatches.map((batch) => {
            const isImportStage =
              batch.status === "draft" || batch.status === "importing";
            const docsCount = batch.validRows || batch.totalRows || 0;
            const statusBadge = getBatchStatusBadge(batch.status);
            const templateName =
              typeof batch.templateId === "object" && batch.templateId?.name
                ? batch.templateId.name
                : null;

            return (
              <div
                key={batch._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-white shadow-xs hover:border-slate-300 hover:shadow-md transition-all gap-4 group"
              >
                {/* Left section: Icon + Info */}
                <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 border border-blue-100/80 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-2xs">
                    <Stack size={22} weight="bold" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Link
                        to={
                          isImportStage
                            ? "/app/batches/$batchId/import"
                            : "/app/batches/$batchId/review"
                        }
                        params={{ batchId: batch._id }}
                        className="text-base font-bold text-slate-900 hover:text-blue-600 transition-colors truncate max-w-md cursor-pointer"
                        title={batch.name}
                      >
                        {batch.name}
                      </Link>

                      <Badge
                        variant={statusBadge.variant}
                        size="sm"
                        shape="pill"
                        dot
                      >
                        {statusBadge.label}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-normal">
                      {templateName && (
                        <div className="flex items-center gap-1.5 text-slate-600 font-medium truncate max-w-xs">
                          <Certificate
                            size={14}
                            weight="bold"
                            className="text-blue-500 shrink-0"
                          />
                          <span className="truncate">{templateName}</span>
                        </div>
                      )}

                      {templateName && (
                        <span className="text-slate-300">·</span>
                      )}

                      <div className="flex items-center gap-1.5 text-slate-400">
                        <CalendarBlank
                          size={14}
                          weight="bold"
                          className="shrink-0"
                        />
                        <span>{formatDate(batch.createdAt)}</span>
                      </div>

                      <span className="text-slate-300">·</span>

                      <span className="text-slate-500 font-medium">
                        {docsCount.toLocaleString()}{" "}
                        {docsCount === 1 ? "document" : "documents"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right section: Action Buttons + Popover Menu */}
                <div className="flex items-center justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <Link
                    to={
                      isImportStage
                        ? "/app/batches/$batchId/import"
                        : "/app/batches/$batchId/review"
                    }
                    params={{ batchId: batch._id }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-600 border border-slate-200/80 transition-colors select-none cursor-pointer"
                  >
                    <span>
                      {isImportStage ? "Continue Import" : "View Documents"}
                    </span>
                    <ArrowRight size={13} weight="bold" />
                  </Link>

                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        title="Batch options"
                        aria-label="Batch options"
                        className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer select-none"
                      >
                        <DotsThreeVertical size={18} weight="bold" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-36 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          navigate({
                            to: isImportStage
                              ? "/app/batches/$batchId/import"
                              : "/app/batches/$batchId/review",
                            params: { batchId: batch._id },
                          });
                        }}
                        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer select-none"
                      >
                        <Eye size={14} weight="bold" />
                        <span>View</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(batch)}
                        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer select-none"
                      >
                        <Trash size={14} weight="bold" />
                        <span>Delete</span>
                      </button>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accessible Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 scale-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
                <Trash size={20} weight="bold" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Delete Batch
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-slate-800">
                    "{deleteTarget.name}"
                  </span>
                  ?
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  This will permanently remove the batch and all of its
                  associated draft rows (
                  <span className="font-medium text-slate-700">
                    {(
                      deleteTarget.validRows ||
                      deleteTarget.totalRows ||
                      0
                    ).toLocaleString()}{" "}
                    documents
                  </span>
                  ). This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50 select-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(deleteTarget._id)}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 select-none"
              >
                {isDeleting ? (
                  <>
                    <CircleNotch size={14} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Batch</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
