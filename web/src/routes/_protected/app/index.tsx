/**
 * @file index.tsx
 * @description Main dashboard home overview displaying issuance analytics, recent batches, templates, and storage quotas.
 * @architecture Primary dashboard landing route for authenticated users (/app).
 * @agent_note Fetches batches, templates, and storage metrics (/api/storage/overview); renders timeline charts and quick-action shortcuts.
 */

import { useEffect, useState, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Plus,
  FileText,
  Files,
  Certificate,
  PaperPlaneTilt,
  HardDrives,
  CaretDown,
  CaretUp,
  DotsThreeVertical,
  Eye,
  Trash,
  CircleNotch,
} from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { toast } from "@/components/ui/toast";
import { PwaInstallCard } from "@/components/pwa";

export const Route = createFileRoute("/_protected/app/")({
  component: AppIndexRoute,
});

interface ActivityDay {
  date: string;
  label: string;
  fullDate: string;
  docs: number;
  batches: number;
  height: number;
  isHighlight: boolean;
}

function buildFallbackActivity(
  batches: BatchItem[],
  numDays = 30,
): ActivityDay[] {
  const now = new Date();
  const startDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - (numDays - 1),
    0,
    0,
    0,
    0,
  );
  const dateMap = new Map<string, { docs: number; batches: number }>();

  for (const batch of batches) {
    if (!batch.createdAt) continue;
    const d = new Date(batch.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entry = dateMap.get(key) || { docs: 0, batches: 0 };
    entry.docs += batch.validRows || batch.totalRows || 0;
    entry.batches += 1;
    dateMap.set(key, entry);
  }

  let maxDocs = 0;
  let peakKey = "";
  for (let i = 0; i < numDays; i++) {
    const d = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + i,
    );
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entry = dateMap.get(key) || { docs: 0, batches: 0 };
    if (entry.docs > maxDocs) {
      maxDocs = entry.docs;
      peakKey = key;
    }
  }

  const buckets: ActivityDay[] = [];
  for (let i = 0; i < numDays; i++) {
    const d = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + i,
    );
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entry = dateMap.get(key) || { docs: 0, batches: 0 };
    const dayLabel = d.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
    });
    const fullDate = d.toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    let height = 0;
    if (maxDocs > 0 && entry.docs > 0) {
      height = Math.max(14, Math.round((entry.docs / maxDocs) * 100));
    } else if (entry.batches > 0) {
      height = 8;
    }

    buckets.push({
      date: key,
      label: dayLabel,
      fullDate,
      docs: entry.docs,
      batches: entry.batches,
      height,
      isHighlight: maxDocs > 0 ? key === peakKey : i === numDays - 1,
    });
  }

  return buckets;
}

interface BatchItem {
  _id: string;
  name: string;
  status: string;
  totalRows?: number;
  validRows?: number;
  invalidRows?: number;
  duplicateRows?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface TemplateItem {
  _id: string;
  name: string;
  thumbnailUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface StorageData {
  totalBytes: number;
  formattedTotal: string;
  documentCount: number;
  source: "cloudinary" | "database";
  documents?: Array<{
    id: string;
    name: string;
    bytes: number;
    formattedSize: string;
    format?: string;
    resourceType?: string;
    createdAt?: string;
    isSoftDeleted?: boolean;
  }>;
}

function formatDate(isoString?: string): string {
  if (!isoString) return "";
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

function formatDateTime(): string {
  const now = new Date();
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);
  const date = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(now);
  return `${time} · ${date}`;
}

/**
 * @component AppIndexRoute
 * @description Dashboard home view featuring greeting, issuance metrics, recent batches, and quick action cards.
 * @returns {JSX.Element} Dashboard overview screen.
 */
function AppIndexRoute() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const firstName = session?.user?.name
    ? session.user.name.trim().split(" ")[0]
    : "there";

  const [deleteTargetBatch, setDeleteTargetBatch] = useState<BatchItem | null>(
    null,
  );
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);
  const [formattedDate, setFormattedDate] = useState(formatDateTime);

  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const [activity, setActivity] = useState<ActivityDay[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<ActivityDay | null>(null);

  const [storage, setStorage] = useState<StorageData | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(true);

  // Escape key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && deleteTargetBatch && !isDeletingBatch) {
        setDeleteTargetBatch(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteTargetBatch, isDeletingBatch]);

  const confirmDeleteBatch = async (batchId: string) => {
    if (!deleteTargetBatch) return;

    try {
      setIsDeletingBatch(true);
      const res = await fetch(`/api/batches/${batchId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setBatches((prev) => prev.filter((b) => b._id !== batchId));
        toast.success(
          "Batch deleted",
          `"${deleteTargetBatch.name}" was permanently removed.`,
        );
        setDeleteTargetBatch(null);
      } else {
        const data = await res.json().catch(() => ({}));
        const errorMsg =
          data?.error || data?.message || "Failed to delete batch";
        toast.error("Deletion failed", errorMsg);
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to delete batch";
      toast.error("Deletion failed", errorMsg);
    } finally {
      setIsDeletingBatch(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setFormattedDate(formatDateTime());
    }, 1000 * 30);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function fetchBatches() {
      try {
        setLoadingBatches(true);
        const res = await fetch("/api/batches", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!isCancelled) {
          const list: BatchItem[] = Array.isArray(data)
            ? data
            : Array.isArray(data?.batches)
              ? data.batches
              : [];
          setBatches(list);
        }
      } catch (err) {
        console.error("Failed to fetch batches:", err);
        if (!isCancelled) {
          toast.error(
            "Failed to load batches",
            err instanceof Error ? err.message : "Network error",
          );
        }
      } finally {
        if (!isCancelled) {
          setLoadingBatches(false);
        }
      }
    }

    async function fetchTemplates() {
      try {
        setLoadingTemplates(true);
        const res = await fetch("/api/templates", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!isCancelled) {
          const list: TemplateItem[] = Array.isArray(data)
            ? data
            : Array.isArray(data?.templates)
              ? data.templates
              : [];
          setTemplates(list);
        }
      } catch (err) {
        console.error("Failed to fetch templates:", err);
        if (!isCancelled) {
          toast.error(
            "Failed to load templates",
            err instanceof Error ? err.message : "Network error",
          );
        }
      } finally {
        if (!isCancelled) {
          setLoadingTemplates(false);
        }
      }
    }

    async function fetchActivity() {
      try {
        setLoadingActivity(true);
        const res = await fetch("/api/batches/activity?days=30", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && Array.isArray(data?.activity)) {
            setActivity(data.activity);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to fetch activity:", err);
      } finally {
        if (!isCancelled) {
          setLoadingActivity(false);
        }
      }
    }

    async function fetchStorage() {
      try {
        setLoadingStorage(true);
        const res = await fetch("/api/storage", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && data?.success) {
            setStorage(data);
          }
        }
      } catch (err) {
        console.error("Failed to fetch storage consumption:", err);
      } finally {
        if (!isCancelled) {
          setLoadingStorage(false);
        }
      }
    }

    fetchBatches();
    fetchTemplates();
    fetchActivity();
    fetchStorage();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Use server activity if available, or compute fallback from real batches
  const effectiveActivity = useMemo(() => {
    if (activity.length > 0) return activity;
    return buildFallbackActivity(batches, 30);
  }, [activity, batches]);

  const DEFAULT_VISIBLE_ITEMS = 4;

  const [isBatchesExpanded, setIsBatchesExpanded] = useState(false);
  const [isTemplatesExpanded, setIsTemplatesExpanded] = useState(false);

  const visibleBatches = useMemo(() => {
    return isBatchesExpanded
      ? batches
      : batches.slice(0, DEFAULT_VISIBLE_ITEMS);
  }, [batches, isBatchesExpanded]);

  const visibleTemplates = useMemo(() => {
    return isTemplatesExpanded
      ? templates
      : templates.slice(0, DEFAULT_VISIBLE_ITEMS);
  }, [templates, isTemplatesExpanded]);

  const totalDocsIssued = useMemo(() => {
    return batches.reduce((sum, b) => sum + (b.validRows || 0), 0);
  }, [batches]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 lg:gap-12 xl:gap-14 w-full h-full min-h-0 overflow-hidden">
      {/* ======================================================== */}
      {/* Left Main Column: Title & Two-Column Activity Lists      */}
      {/* ======================================================== */}
      <div className="xl:col-span-8 h-full min-h-0 overflow-y-auto custom-scrollbar space-y-10 sm:space-y-12 min-w-0 pr-2">
        {/* Header: Page Title & Date Range */}
        <div className="space-y-3.5 sm:space-y-4.5 pt-1 sm:pt-2">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Welcome, <span className="text-blue-600">{firstName}</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400 font-medium tracking-wide">
            {formattedDate}
          </p>
        </div>

        {/* ======================================================== */}
        {/* Two-Column Lists: Batches Processed & Templates          */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10 pt-6 sm:pt-8">
          {/* Column 1: Batches Processed */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Batches Processed
                </span>
                {batches.length > 0 && (
                  <Badge variant="neutral" size="sm" shape="pill">
                    {batches.length}
                  </Badge>
                )}
              </div>
              <Link
                to="/app/batches/new"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Plus size={12} weight="bold" />
                <span>New Batch</span>
              </Link>
            </div>

            {loadingBatches ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 bg-white/50"
                  >
                    <div className="flex items-center gap-3.5">
                      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32 rounded-md" />
                        <Skeleton className="h-3 w-20 rounded-md" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : batches.length === 0 ? (
              <EmptyState
                icon={<Files size={24} weight="duotone" />}
                title="No batches yet"
                description="Start issuing documents by creating your first batch."
                size="compact"
                variant="dashed"
                action={
                  <Link
                    to="/app/batches/new"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer select-none"
                  >
                    <Plus size={14} weight="bold" />
                    <span>Create Batch</span>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-2">
                <div className="space-y-2.5">
                  {visibleBatches.map((batch) => {
                    const isImportStage =
                      batch.status === "draft" || batch.status === "importing";
                    const docsCount = batch.validRows || batch.totalRows || 0;

                    return (
                      <div
                        key={batch._id}
                        className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-50/80 transition-colors group"
                      >
                        <Link
                          to={
                            isImportStage
                              ? "/app/batches/$batchId/import"
                              : "/app/batches/$batchId/review"
                          }
                          params={{ batchId: batch._id }}
                          className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer pr-2"
                        >
                          <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center flex-none shadow-xs group-hover:bg-blue-600 transition-colors">
                            <Files size={18} weight="bold" />
                          </div>
                          <div className="min-w-0">
                            <p
                              className="text-sm font-semibold text-slate-900 leading-tight truncate group-hover:text-blue-600 transition-colors"
                              title={batch.name}
                            >
                              {batch.name}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                              {formatDate(batch.createdAt)} ·{" "}
                              {docsCount.toLocaleString()} docs
                            </p>
                          </div>
                        </Link>

                        <div className="shrink-0 pl-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                title="Batch actions"
                                aria-label="Batch actions"
                                className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100/90 flex items-center justify-center transition-colors cursor-pointer select-none"
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
                                onClick={() => setDeleteTargetBatch(batch)}
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

                {batches.length > DEFAULT_VISIBLE_ITEMS && (
                  <button
                    type="button"
                    onClick={() => setIsBatchesExpanded((prev) => !prev)}
                    className="w-full py-2.5 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100/90 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-100 shadow-2xs select-none"
                  >
                    {isBatchesExpanded ? (
                      <>
                        <span>Show less</span>
                        <CaretUp size={13} weight="bold" />
                      </>
                    ) : (
                      <>
                        <span>
                          View more ({batches.length - DEFAULT_VISIBLE_ITEMS}{" "}
                          more)
                        </span>
                        <CaretDown size={13} weight="bold" />
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Column 2: Templates */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Templates
                </span>
                {templates.length > 0 && (
                  <Badge variant="neutral" size="sm" shape="pill">
                    {templates.length}
                  </Badge>
                )}
              </div>
              <Link
                to="/app/templates/new"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Plus size={12} weight="bold" />
                <span>Upload</span>
              </Link>
            </div>

            {loadingTemplates ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 bg-white/50"
                  >
                    <div className="flex items-center gap-3.5">
                      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32 rounded-md" />
                        <Skeleton className="h-3 w-20 rounded-md" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                ))}
              </div>
            ) : templates.length === 0 ? (
              <EmptyState
                icon={<FileText size={24} weight="duotone" />}
                title="No templates yet"
                description="Upload a PDF template to start designing credentials."
                size="compact"
                variant="dashed"
                action={
                  <Link
                    to="/app/templates/new"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer select-none"
                  >
                    <Plus size={14} weight="bold" />
                    <span>Upload Template</span>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-2">
                <div className="space-y-2">
                  {visibleTemplates.map((template) => (
                    <Link
                      key={template._id}
                      to="/app/templates/$templateId"
                      params={{ templateId: template._id }}
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          localStorage.setItem(
                            "emitdocs_active_template_id",
                            template._id,
                          );
                        }
                      }}
                      className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {template.thumbnailUrl ? (
                          <img
                            src={template.thumbnailUrl}
                            alt={template.name}
                            className="object-cover w-10 h-10 rounded-full ring-1 ring-slate-200 flex-none"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center flex-none shadow-xs group-hover:bg-sky-100 transition-colors">
                            <FileText size={18} weight="bold" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p
                            className="text-sm font-semibold text-slate-900 leading-tight truncate group-hover:text-blue-600 transition-colors"
                            title={template.name}
                          >
                            {template.name}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5 truncate">
                            Updated{" "}
                            {formatDate(
                              template.updatedAt || template.createdAt,
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 pl-3">
                        <span className="text-xs font-semibold text-slate-400 group-hover:text-blue-600 flex items-center gap-1 transition-colors">
                          <span>View</span>
                          <span className="transition-transform group-hover:translate-x-0.5">
                            &rarr;
                          </span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>

                {templates.length > DEFAULT_VISIBLE_ITEMS && (
                  <button
                    type="button"
                    onClick={() => setIsTemplatesExpanded((prev) => !prev)}
                    className="w-full py-2.5 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100/90 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-100 shadow-2xs select-none"
                  >
                    {isTemplatesExpanded ? (
                      <>
                        <span>Show less</span>
                        <CaretUp size={13} weight="bold" />
                      </>
                    ) : (
                      <>
                        <span>
                          View more ({templates.length - DEFAULT_VISIBLE_ITEMS}{" "}
                          more)
                        </span>
                        <CaretDown size={13} weight="bold" />
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* Right Column: 4 Metrics Cards, Activity Chart & Promo     */}
      {/* ======================================================== */}
      <div className="xl:col-span-4 h-full min-h-0 overflow-y-auto custom-scrollbar flex flex-col justify-between space-y-8 pt-6 xl:pt-0 xl:border-l xl:border-slate-100/80 xl:pl-10 min-w-0 pr-2">
        {/* 1. 4-Card Metrics Container */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
            {/* Card 1: Total Templates */}
            <div className="rounded-2xl bg-slate-50/80 border border-slate-100 p-4 sm:p-4.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="w-7 h-7 rounded-lg bg-blue-100/70 text-blue-600 flex items-center justify-center">
                  <FileText size={16} weight="duotone" />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">
                  Total Templates
                </p>
                <p className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
                  {loadingTemplates ? "-" : templates.length}
                </p>
              </div>
            </div>

            {/* Card 2: Total Docs Issued */}
            <div className="rounded-2xl bg-slate-50/80 border border-slate-100 p-4 sm:p-4.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="w-7 h-7 rounded-lg bg-emerald-100/70 text-emerald-600 flex items-center justify-center">
                  <Certificate size={16} weight="duotone" />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">
                  Total Docs Issued
                </p>
                <p className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
                  {loadingBatches ? "-" : totalDocsIssued.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Card 3: Emails Sent */}
            <div className="rounded-2xl bg-slate-50/80 border border-slate-100 p-4 sm:p-4.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="w-7 h-7 rounded-lg bg-amber-100/70 text-amber-600 flex items-center justify-center">
                  <PaperPlaneTilt size={16} weight="duotone" />
                </div>
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                  Soon
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">
                  Emails Sent
                </p>
                <p className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
                  0
                </p>
              </div>
            </div>

            {/* Card 4: Storage Consumed */}
            <div className="rounded-2xl bg-slate-50/80 border border-slate-100 p-4 sm:p-4.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="w-7 h-7 rounded-lg bg-purple-100/70 text-purple-600 flex items-center justify-center">
                  <HardDrives size={16} weight="duotone" />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">
                  Storage Consumed
                </p>
                {loadingStorage ? (
                  <Skeleton className="h-6 w-20 rounded-md mt-1" />
                ) : (
                  <>
                    <p className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
                      {storage?.formattedTotal || "0 B"}
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      {storage?.documentCount ?? 0}{" "}
                      {storage?.documentCount === 1 ? "document" : "documents"}{" "}
                      stored
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Activity Bar Chart Card (1-Month Span with Real DB Data) */}
        <div className="rounded-2xl bg-white border border-slate-100 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <h3 className="text-sm font-bold text-slate-900">
                Issuance Activity
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 font-medium truncate">
                {hoveredDay ? (
                  <span className="text-blue-600 font-semibold">
                    {hoveredDay.label}: {hoveredDay.docs.toLocaleString()} docs
                    {hoveredDay.batches > 0
                      ? ` (${hoveredDay.batches} ${hoveredDay.batches === 1 ? "batch" : "batches"})`
                      : ""}
                  </span>
                ) : (
                  <span>
                    30-day volume · {totalDocsIssued.toLocaleString()} docs
                  </span>
                )}
              </p>
            </div>
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100/70 shrink-0">
              1 Month
            </span>
          </div>

          {loadingActivity && effectiveActivity.length === 0 ? (
            <div className="h-20 flex items-end justify-between gap-1 px-1">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 flex items-end justify-center h-full"
                >
                  <div
                    style={{ height: `${20 + (i % 5) * 15}%` }}
                    className="w-full max-w-[6px] rounded-t-xs bg-slate-100 animate-pulse"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div
                className="h-20 flex items-end justify-between gap-0.5 sm:gap-1 px-0.5"
                onMouseLeave={() => setHoveredDay(null)}
              >
                {effectiveActivity.map((bar, i) => (
                  <div
                    key={bar.date || i}
                    onMouseEnter={() => setHoveredDay(bar)}
                    className="flex-1 flex items-end justify-center h-full group cursor-pointer relative"
                    title={`${bar.fullDate}: ${bar.docs.toLocaleString()} docs (${bar.batches} batches)`}
                  >
                    <div
                      style={{
                        height: `${bar.docs > 0 ? bar.height : bar.batches > 0 ? 8 : 4}%`,
                      }}
                      className={`w-full max-w-[6px] sm:max-w-[7px] rounded-t-xs transition-all duration-200 ${
                        bar.isHighlight
                          ? "bg-blue-600 group-hover:bg-blue-700 shadow-xs ring-1 ring-blue-300"
                          : bar.docs > 0
                            ? "bg-blue-400 group-hover:bg-blue-600"
                            : bar.batches > 0
                              ? "bg-blue-200 group-hover:bg-blue-400"
                              : "bg-slate-200/60 group-hover:bg-slate-300"
                      }`}
                    />
                  </div>
                ))}
              </div>

              {/* 30-day Axis Range Indicators */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium px-1 select-none">
                <span>{effectiveActivity[0]?.label || "30d ago"}</span>
                <span>
                  {effectiveActivity[Math.floor(effectiveActivity.length / 2)]
                    ?.label || "15d"}
                </span>
                <span>Today</span>
              </div>
            </div>
          )}
        </div>

        {/* PWA Install Prompt Card (half-height, dismissible with localStorage persistence) */}
        <PwaInstallCard />

        {/* 3. Quick Action Helper Card */}
        <div className="rounded-2xl bg-slate-50/90 border border-slate-100 p-6 sm:p-7 space-y-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100/70 text-blue-600 flex items-center justify-center">
            <Files size={24} weight="duotone" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-900">
              Automate Bulk Issuance
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upload recipient data via CSV and generate individualized
              credentials in minutes.
            </p>
          </div>

          <Link
            to="/app/batches/new"
            className="block w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-900 active:scale-[0.98] text-white font-semibold text-xs tracking-wide text-center transition-all shadow-sm cursor-pointer select-none"
          >
            QUICK START GUIDE
          </Link>
        </div>
      </div>

      {/* Accessible Delete Confirmation Modal */}
      {deleteTargetBatch && (
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
                    "{deleteTargetBatch.name}"
                  </span>
                  ?
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  This will permanently remove the batch and all of its
                  associated draft rows (
                  <span className="font-medium text-slate-700">
                    {(
                      deleteTargetBatch.validRows ||
                      deleteTargetBatch.totalRows ||
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
                onClick={() => setDeleteTargetBatch(null)}
                disabled={isDeletingBatch}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50 select-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteBatch(deleteTargetBatch._id)}
                disabled={isDeletingBatch}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 select-none"
              >
                {isDeletingBatch ? (
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
    </div>
  );
}
