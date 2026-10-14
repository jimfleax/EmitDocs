/**
 * @file TemplateLibrary.tsx
 * @description Template library catalog displaying existing PDF templates with search, filtering, and management.
 * @architecture Primary dashboard view for template exploration and batch issuance entry point.
 * @agent_note Supports client-side name search, template deletion with confirmation, and direct routing to mapping or batch issuance.
 */

import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  MagnifyingGlass,
  Plus,
  Trash,
  FilePdf,
  Certificate,
  CheckCircle,
  PlusCircle,
  Warning,
} from "@phosphor-icons/react";
import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/toast";
import { TemplateLibrarySkeleton } from "@/components/skeletons/TemplateLibrarySkeleton";

interface TemplateVersion {
  _id?: string;
  version?: number;
  pageCount?: number;
  bytes?: number;
  sourceObjectKey?: string;
  status?: string;
  fieldMappings?: any[];
}

interface Template {
  _id: string;
  name: string;
  ownerId?: string;
  currentVersionId?: string | TemplateVersion;
  thumbnailUrl?: string;
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

/**
 * @component TemplateCardThumbnail
 * @description Renders template thumbnail preview or fallback document silhouette illustration.
 * @param {Object} props - Component properties.
 * @param {string | null} [props.thumbnailUrl] - Remote thumbnail URL.
 * @param {string} props.name - Template name for accessibility alt text.
 * @returns {JSX.Element} Thumbnail image or placeholder SVG graphic.
 */
function TemplateCardThumbnail({
  thumbnailUrl,
  name,
}: {
  thumbnailUrl?: string | null;
  name: string;
}) {
  const [errorUrl, setErrorUrl] = useState<string | null>(null);
  const hasError = errorUrl === thumbnailUrl;

  if (thumbnailUrl && !hasError) {
    return (
      <img
        src={thumbnailUrl}
        alt={name}
        loading="lazy"
        onError={() => setErrorUrl(thumbnailUrl)}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100/80 p-4 relative group-hover:bg-slate-100/90 transition-colors">
      {/* Document silhouette */}
      <div className="w-3/4 h-4/5 rounded-lg border border-slate-200/70 bg-white shadow-xs p-3 flex flex-col justify-between transition-transform duration-300 group-hover:scale-[1.03]">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <Certificate size={20} weight="duotone" className="text-blue-600" />
          <div className="h-1.5 w-12 bg-slate-200 rounded-full" />
        </div>
        <div className="space-y-1.5 my-auto">
          <div className="h-1.5 w-3/4 bg-slate-200/80 rounded-full" />
          <div className="h-1.5 w-1/2 bg-slate-100 rounded-full" />
          <div className="h-1.5 w-2/3 bg-slate-100 rounded-full" />
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[8px] text-slate-400 font-medium">
          <span>OFFICIAL</span>
          <div className="w-3.5 h-3.5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
            <CheckCircle size={10} weight="bold" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * @component TemplateLibrary
 * @description Main template listing view with quick actions, search bar, empty states, and template grid.
 * @state {Template[]} templates - List of retrieved templates.
 * @state {boolean} loading - Loading indicator state.
 * @state {string} searchQuery - Search query string for filtering templates.
 * @state {string} error - Fetch error message.
 * @api {GET} /api/templates - Fetches template collection.
 * @api {DELETE} /api/templates/:id - Deletes a specified template.
 * @returns {JSX.Element} Template library catalog page.
 */
export function TemplateLibrary() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [cascadeWarning, setCascadeWarning] = useState<{
    count: number;
    batches: Array<{ _id: string; name: string }>;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    async function fetchTemplates() {
      try {
        setLoading(true);
        setError("");
        const url =
          retryCount > 0 ? `/api/templates?_r=${retryCount}` : "/api/templates";
        const res = await fetch(url, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch templates (${res.status})`);
        }
        const data = await res.json();
        if (!isCancelled) {
          const list: Template[] = Array.isArray(data)
            ? data
            : Array.isArray(data?.templates)
              ? data.templates
              : [];
          setTemplates(list);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to fetch templates";
          setError(message);
          toast.error("Failed to load templates", message);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    fetchTemplates();

    return () => {
      isCancelled = true;
    };
  }, [retryCount]);

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase().trim();
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, searchQuery]);

  const confirmDelete = async (id: string, forceCascade = false) => {
    try {
      setIsDeleting(true);
      const url = forceCascade
        ? `/api/templates/${id}?confirmCascade=true`
        : `/api/templates/${id}`;
      const res = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 409) {
        const errData = await res.json().catch(() => ({}));
        if (errData.error === "CASCADE_CONFIRMATION_REQUIRED") {
          setCascadeWarning({
            count: errData.dependentBatchesCount || 0,
            batches: errData.dependentBatches || [],
          });
          return;
        }
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.error || errData.message || "Failed to delete template",
        );
      }
      setTemplates((prev) => prev.filter((t) => t._id !== id));
      toast.success(
        "Template deleted",
        deleteTarget?.name
          ? `"${deleteTarget.name}" was permanently removed.`
          : "The template has been permanently removed.",
      );
      setDeleteTarget(null);
      setCascadeWarning(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Delete failed";
      toast.error("Failed to delete template", message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <PageShell
      title="Template Library"
      subtitle="Manage, preview, and configure certificate & credential templates"
      backTo="/app"
      backLabel="Back to Dashboard"
      isLoading={loading}
      skeleton={<TemplateLibrarySkeleton />}
      loadingTitle="Loading templates..."
      actions={
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <MagnifyingGlass
              size={18}
              weight="bold"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <Link
            to="/app/templates/new"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer select-none text-sm shrink-0"
          >
            <Plus size={16} weight="bold" />
            <span>Add Template</span>
          </Link>
        </div>
      }
    >
      {/* Error State */}
      {error && (
        <Alert variant="error" onRetry={() => setRetryCount((c) => c + 1)}>
          {error}
        </Alert>
      )}

      {/* Empty State */}
      {!error && filteredTemplates.length === 0 && (
        <EmptyState
          icon={<FilePdf size={28} weight="duotone" />}
          title={
            searchQuery.trim() ? "No matching templates" : "No templates yet"
          }
          description={
            searchQuery.trim()
              ? `No templates matched "${searchQuery}". Try a different keyword.`
              : "Upload a PDF document to create your first certificate or credential template."
          }
          variant={searchQuery.trim() ? "solid" : "dashed"}
          action={
            searchQuery.trim() ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              >
                Clear search filter
              </button>
            ) : (
              <Link
                to="/app/templates/new"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold px-4 py-2 rounded-xl shadow-sm shadow-blue-500/20 transition-all cursor-pointer select-none text-sm"
              >
                <Plus size={16} weight="bold" />
                <span>Create your first template</span>
              </Link>
            )
          }
        />
      )}

      {/* Template Card Grid */}
      {!loading && !error && filteredTemplates.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredTemplates.map((template) => {
            const versionObj =
              typeof template.currentVersionId === "object" &&
              template.currentVersionId !== null
                ? template.currentVersionId
                : null;
            const versionText = versionObj?.version
              ? `v${versionObj.version}`
              : "v1";
            const pageCountText = versionObj?.pageCount
              ? `${versionObj.pageCount} ${versionObj.pageCount === 1 ? "Page" : "Pages"}`
              : "1 Page";

            const isMapped = Boolean(
              versionObj?.fieldMappings && versionObj.fieldMappings.length > 0,
            );

            return (
              <div
                key={template._id}
                onClick={() => {
                  if (typeof window !== "undefined") {
                    localStorage.setItem(
                      "emitdocs_active_template_id",
                      template._id,
                    );
                  }
                  navigate({
                    to: "/app/templates/$templateId",
                    params: { templateId: template._id },
                  });
                }}
                className="rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-lg transition-all overflow-hidden group flex flex-col cursor-pointer"
              >
                {/* Thumbnail Area */}
                <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden flex items-center justify-center border-b border-slate-100">
                  {/* Badges Overlay */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10 pointer-events-none">
                    <Badge variant="glass" size="sm" shape="rounded" mono>
                      {versionText}
                    </Badge>
                    <Badge variant="primary" size="sm" shape="rounded" mono>
                      PDF
                    </Badge>
                  </div>
                  <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
                    <Badge variant="glass" size="sm" shape="rounded" mono>
                      {pageCountText}
                    </Badge>
                  </div>

                  <TemplateCardThumbnail
                    thumbnailUrl={template.thumbnailUrl}
                    name={template.name}
                  />
                </div>

                {/* Card Info & Actions */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <h3
                      className="font-bold text-sm sm:text-base text-slate-900 truncate"
                      title={template.name}
                    >
                      {template.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 font-medium">
                      Created {formatDate(template.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100/80">
                    <Link
                      to="/app/templates/$templateId"
                      params={{ templateId: template._id }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (typeof window !== "undefined") {
                          localStorage.setItem(
                            "emitdocs_active_template_id",
                            template._id,
                          );
                        }
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 group/link cursor-pointer"
                    >
                      <span>View Details</span>
                      <span className="transition-transform group-hover/link:translate-x-0.5">
                        &rarr;
                      </span>
                    </Link>

                    <div className="flex items-center gap-1.5">
                      {isMapped && (
                        <Link
                          to="/app/batches/new"
                          search={{ templateId: template._id }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (typeof window !== "undefined") {
                              localStorage.setItem(
                                "emitdocs_active_template_id",
                                template._id,
                              );
                            }
                          }}
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <PlusCircle size={13} weight="bold" />
                          <span>Batch</span>
                        </Link>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCascadeWarning(null);
                          setDeleteTarget(template);
                        }}
                        title="Delete template"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash size={16} weight="bold" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash size={20} weight="bold" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Delete Template
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-slate-700">
                    "{deleteTarget.name}"
                  </span>
                  ? This template will be permanently removed.
                </p>
              </div>
            </div>

            {cascadeWarning && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-amber-900 text-xs font-bold">
                  <Warning size={16} weight="bold" className="text-amber-600 shrink-0" />
                  <span>Orphaned Batches Warning</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  This template is linked to{" "}
                  <strong>{cascadeWarning.count} batch(es)</strong>:{" "}
                  <span className="font-medium text-amber-950">
                    {cascadeWarning.batches.map((b) => b.name).join(", ")}
                  </span>
                  . Deleting this template will also{" "}
                  <strong>permanently delete all associated batches and draft records</strong>.
                </p>
                <p className="text-xs font-semibold text-amber-900">
                  Do you want to proceed and delete the template along with these batches?
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setCascadeWarning(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(deleteTarget._id, Boolean(cascadeWarning))}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting
                  ? "Deleting..."
                  : cascadeWarning
                    ? "Yes, Delete Template & Batches"
                    : "Delete Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
