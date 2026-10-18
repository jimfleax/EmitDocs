/**
 * @file NewBatchForm.tsx
 * @description Batch creation form enabling template selection, version locking, and batch name configuration.
 * @architecture Inception workflow component rendered under the batches new route.
 * @agent_note Fetches available templates, formats automatic default batch names, and creates batch via POST /api/batches.
 */

import { useState, useEffect } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { FilePdf, ArrowRight, Clock } from "@phosphor-icons/react";
import { PageShell } from "@/components/layout/PageShell";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/toast";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { NewBatchFormSkeleton } from "@/components/skeletons/NewBatchFormSkeleton";

interface TemplateVersion {
  _id: string;
  version: number;
  pageCount?: number;
  bytes?: number;
  fieldMappings?: Array<{ id: string; key: string }>;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Template {
  _id: string;
  name: string;
  currentVersionId?: string | TemplateVersion;
  thumbnailUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface NewBatchFormProps {
  initialTemplateId?: string;
}

function formatDefaultBatchName(templateName: string): string {
  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${templateName} — ${dateStr}`;
}

function formatReadableTimestamp(isoString?: string): string {
  if (!isoString) return "Recently modified";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Recently modified";
    const datePart = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timePart = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `Modified ${datePart} at ${timePart}`;
  } catch {
    return "Recently modified";
  }
}

function getMappedFieldsCount(tmpl: Template): number {
  if (!tmpl.currentVersionId || typeof tmpl.currentVersionId !== "object")
    return 0;
  return Array.isArray(tmpl.currentVersionId.fieldMappings)
    ? tmpl.currentVersionId.fieldMappings.length
    : 0;
}

function isTemplateMapped(tmpl: Template): boolean {
  return getMappedFieldsCount(tmpl) > 0;
}

function BatchTemplateThumbnail({ url }: { url?: string }) {
  const [errorUrl, setErrorUrl] = useState<string | null>(null);
  const hasError = errorUrl === url;

  if (url && !hasError) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setErrorUrl(url)}
        className="w-full h-full object-cover"
      />
    );
  }
  return <FilePdf className="w-5 h-5 text-blue-500" />;
}

/**
 * @component NewBatchForm
 * @description Creation form for initiating a certificate batch from an existing template.
 * @param {NewBatchFormProps} [props={}] - Component properties.
 * @param {string} [props.initialTemplateId] - Pre-selected template ID from route parameters.
 * @state {Template[]} templates - List of user templates available for batch issuance.
 * @state {string} selectedTemplateId - Currently chosen template identifier.
 * @state {string} batchName - Name configured for the new batch.
 * @state {boolean} isLoadingTemplates - Loading flag while retrieving template list.
 * @state {boolean} isSubmitting - In-flight state during batch creation request.
 * @state {string | null} error - Form error message string.
 * @api {GET} /api/templates - Fetches available templates for selection.
 * @api {POST} /api/batches - Creates a new batch record with locked template version.
 * @returns {JSX.Element} Interactive batch creation form.
 */
export function NewBatchForm({ initialTemplateId }: NewBatchFormProps = {}) {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [batchName, setBatchName] = useState<string>("");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isPreselected = Boolean(
    initialTemplateId ||
    (typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("templateId")),
  );
  const [isChangingTemplate, setIsChangingTemplate] = useState<boolean>(false);
  const selectedTemplate =
    templates.find((t) => t._id === selectedTemplateId) || null;

  useEffect(() => {
    let isCancelled = false;

    async function fetchTemplates() {
      try {
        setIsLoadingTemplates(true);
        const res = await fetch("/api/templates?mappedOnly=true", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load templates");
        const data = await res.json();
        const rawList: Template[] = data.templates || [];

        // Strictly filter to templates that have mapped fields
        const mappedList = rawList.filter(isTemplateMapped);

        if (isCancelled) return;
        setTemplates(mappedList);

        if (mappedList.length > 0) {
          const urlParam =
            typeof window !== "undefined"
              ? new URLSearchParams(window.location.search).get("templateId")
              : null;
          const storedId =
            typeof window !== "undefined"
              ? localStorage.getItem("emitdocs_active_template_id")
              : null;

          // Target template priority: route initialTemplateId -> URL param -> stored active template -> first mapped template
          const targetId =
            [initialTemplateId, urlParam, storedId].find(
              (id) => id && mappedList.some((t) => t._id === id),
            ) || mappedList[0]._id;

          const chosen =
            mappedList.find((t) => t._id === targetId) || mappedList[0];
          setSelectedTemplateId(chosen._id);
          setBatchName(formatDefaultBatchName(chosen.name));

          if (typeof window !== "undefined") {
            localStorage.setItem("emitdocs_active_template_id", chosen._id);
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || "Error fetching templates");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingTemplates(false);
        }
      }
    }

    fetchTemplates();

    return () => {
      isCancelled = true;
    };
  }, [initialTemplateId]);

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const tmpl = templates.find((t) => t._id === id);
    if (tmpl) {
      setBatchName(formatDefaultBatchName(tmpl.name));
      if (typeof window !== "undefined") {
        localStorage.setItem("emitdocs_active_template_id", id);
      }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateId || !batchName.trim()) {
      setError("Please choose a template and specify a batch name.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: batchName.trim(),
          templateId: selectedTemplateId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create batch");
      }

      const { batch } = await res.json();
      toast.success(
        "Batch created",
        `"${batchName.trim()}" is ready for data import.`,
      );
      navigate({
        to: "/app/batches/$batchId/import",
        params: { batchId: batch._id },
      });
    } catch (err: any) {
      const message = err.message || "Error creating batch";
      setError(message);
      toast.error("Failed to create batch", message);
      setIsSubmitting(false);
    }
  };

  return (
    <PageShell
      title="Start New Issuance Batch"
      subtitle={
        isPreselected && selectedTemplate && !isChangingTemplate
          ? `Configure batch name for ${selectedTemplate.name} to begin spreadsheet data import.`
          : "Select a mapped template and configure batch settings to begin spreadsheet data import."
      }
      backTo="/app"
      backLabel="Back to Dashboard"
      maxWidth="2xl"
      isLoading={isLoadingTemplates}
      skeleton={<NewBatchFormSkeleton />}
      loadingTitle="Loading mapped templates..."
      actions={
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            Step 1 of 4: Setup Batch
          </span>
        </div>
      }
    >
      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      {templates.length === 0 ? (
        <EmptyState
          icon={<FilePdf size={28} weight="duotone" />}
          title="No Mapped Templates Available"
          description="You must configure and map fields on at least one template before creating an issuance batch. Unmapped templates cannot be used for batch data import."
          variant="solid"
          action={
            <Link
              to="/app/templates"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-xs font-semibold text-white transition-all shadow-sm shadow-blue-500/20 cursor-pointer select-none"
            >
              Go to Template Library
            </Link>
          }
        />
      ) : (
        <form onSubmit={handleCreate} className="space-y-6">
          {/* Step Progress Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-xs">
                1
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Batch Configuration
                </p>
                <p className="text-[11px] text-slate-400">
                  Step 1 of 4 · Setup details before spreadsheet upload
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                1. Setup
              </span>
              <span className="text-slate-300">→</span>
              <span>2. Upload</span>
              <span className="text-slate-300">→</span>
              <span>3. Map</span>
              <span className="text-slate-300">→</span>
              <span>4. Review</span>
            </div>
          </div>
          {/* Confirmed Selected Template Card (when already chosen via query params) */}
          {isPreselected && selectedTemplate && !isChangingTemplate ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Target Template
                </label>
                <button
                  type="button"
                  onClick={() => setIsChangingTemplate(true)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer transition-colors"
                >
                  Change template
                </button>
              </div>

              <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 shadow-xs flex items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-12 rounded-lg bg-white flex items-center justify-center shrink-0 overflow-hidden border border-slate-200 shadow-2xs">
                    <BatchTemplateThumbnail
                      url={selectedTemplate.thumbnailUrl}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {selectedTemplate.name}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-medium">
                      <Clock
                        size={12}
                        weight="bold"
                        className="text-slate-400 shrink-0"
                      />
                      <span className="truncate">
                        {formatReadableTimestamp(
                          selectedTemplate.updatedAt ||
                            selectedTemplate.createdAt ||
                            (typeof selectedTemplate.currentVersionId ===
                            "object"
                              ? selectedTemplate.currentVersionId?.updatedAt
                              : undefined),
                        )}
                      </span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Badge variant="primary" size="sm" shape="pill" mono>
                        v
                        {typeof selectedTemplate.currentVersionId === "object"
                          ? selectedTemplate.currentVersionId?.version
                          : 1}
                      </Badge>
                      <Badge variant="success" size="sm" shape="pill">
                        {getMappedFieldsCount(selectedTemplate)}{" "}
                        {getMappedFieldsCount(selectedTemplate) === 1
                          ? "field"
                          : "fields"}{" "}
                        mapped
                      </Badge>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsChangingTemplate(true)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-2xs"
                >
                  Change
                </button>
              </div>
            </div>
          ) : (
            /* Template Selection (shown when no template is preselected or user clicks Change) */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Select Mapped Template
                </label>
                <div className="flex items-center gap-2">
                  {isPreselected && (
                    <button
                      type="button"
                      onClick={() => setIsChangingTemplate(false)}
                      className="text-xs text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                  <span className="text-[11px] text-slate-400 font-medium">
                    {templates.length}{" "}
                    {templates.length === 1
                      ? "mapped template"
                      : "mapped templates"}{" "}
                    available
                  </span>
                </div>
              </div>

              {/* Dropdown Select Menu */}
              <Select
                value={selectedTemplateId}
                onValueChange={(id) => {
                  handleSelectTemplate(id);
                  if (isChangingTemplate) setIsChangingTemplate(false);
                }}
              >
                <SelectTrigger className="h-11 rounded-xl bg-white border border-slate-200 px-3.5 text-sm font-semibold text-slate-900 shadow-xs hover:border-slate-300">
                  <SelectValue placeholder="Choose a mapped template...">
                    {templates.find((t) => t._id === selectedTemplateId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {templates.map((tmpl) => {
                    const fieldCount = getMappedFieldsCount(tmpl);
                    const ver =
                      typeof tmpl.currentVersionId === "object"
                        ? tmpl.currentVersionId?.version
                        : 1;
                    const timestampStr = formatReadableTimestamp(
                      tmpl.updatedAt ||
                        tmpl.createdAt ||
                        (typeof tmpl.currentVersionId === "object"
                          ? tmpl.currentVersionId?.updatedAt
                          : undefined),
                    );
                    return (
                      <SelectItem
                        key={tmpl._id}
                        value={tmpl._id}
                        textValue={tmpl.name}
                      >
                        <div className="flex items-center justify-between w-full gap-3 py-0.5">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900 truncate">
                              {tmpl.name}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {timestampStr}
                            </p>
                          </div>
                          <span className="text-[10px] text-blue-600 font-mono font-semibold shrink-0 bg-blue-50 px-1.5 py-0.5 rounded">
                            v{ver} · {fieldCount}{" "}
                            {fieldCount === 1 ? "field" : "fields"}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {/* Visual Template Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1 pt-1">
                {templates.map((tmpl) => {
                  const isSelected = tmpl._id === selectedTemplateId;
                  const fieldCount = getMappedFieldsCount(tmpl);
                  const ver =
                    typeof tmpl.currentVersionId === "object"
                      ? tmpl.currentVersionId?.version
                      : 1;
                  const timestampStr = formatReadableTimestamp(
                    tmpl.updatedAt ||
                      tmpl.createdAt ||
                      (typeof tmpl.currentVersionId === "object"
                        ? tmpl.currentVersionId?.updatedAt
                        : undefined),
                  );

                  return (
                    <div
                      key={tmpl._id}
                      onClick={() => {
                        handleSelectTemplate(tmpl._id);
                        if (isChangingTemplate) setIsChangingTemplate(false);
                      }}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? "bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/30 shadow-xs"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden border border-slate-200">
                          <BatchTemplateThumbnail url={tmpl.thumbnailUrl} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {tmpl.name}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                            <Clock
                              size={12}
                              weight="bold"
                              className="text-slate-400 shrink-0"
                            />
                            <span className="truncate">{timestampStr}</span>
                          </p>
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <Badge
                              variant="primary"
                              size="sm"
                              shape="pill"
                              mono
                            >
                              v{ver}
                            </Badge>
                            <Badge variant="success" size="sm" shape="pill">
                              {fieldCount}{" "}
                              {fieldCount === 1 ? "field" : "fields"} mapped
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Batch Name */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Batch Name
            </label>
            <input
              type="text"
              required
              autoFocus
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="e.g. Summer 2026 Certificates"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all shadow-xs"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !selectedTemplateId}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-xs font-bold text-white shadow-sm shadow-blue-500/20 transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" variant="current" />
                  <span>Creating Batch & Preparing Workspace...</span>
                </>
              ) : (
                <>
                  <span>Continue to File Import</span>
                  <ArrowRight className="w-4 h-4" weight="bold" />
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </PageShell>
  );
}
