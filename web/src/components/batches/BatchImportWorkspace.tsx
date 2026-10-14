/**
 * @file BatchImportWorkspace.tsx
 * @description Multi-step wizard coordinating spreadsheet upload, column mapping, chunked ingestion, and validation review.
 * @architecture Comprehensive feature container component managing data import lifecycle for a batch.
 * @agent_note Coordinates 4-step wizard: file selection/worksheet picking, column mapping with auto-suggest, 500-row chunked backend upload, and validation results.
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  WarningCircle,
  Check,
  FileCsv,
  FileXls,
} from "@phosphor-icons/react";
import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { BatchImportSkeleton } from "@/components/skeletons/BatchImportSkeleton";
import { toast } from "@/components/ui/toast";
import { DataFilePicker } from "./DataFilePicker";
import { WorksheetSelector } from "./WorksheetSelector";
import { ImportSchemaSummary } from "./ImportSchemaSummary";
import { ColumnMappingTable } from "./ColumnMappingTable";
import { ImportProgress } from "./ImportProgress";
import { ImportValidationSummary } from "./ImportValidationSummary";
import { DuplicateWarning } from "./DuplicateWarning";
import { RowErrorTable, type DisplayDraftRow } from "./RowErrorTable";
import {
  type ParsedSpreadsheetResult,
  parseXlsxBuffer,
} from "@/lib/spreadsheet/spreadsheet-parser";

interface BatchImportWorkspaceProps {
  batchId: string;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * @component BatchImportWorkspace
 * @description Ingestion studio facilitating file parsing, column-to-field matching, chunked upload, and error summaries.
 * @param {BatchImportWorkspaceProps} props - Component properties.
 * @param {string} props.batchId - Target batch ID for importing data.
 * @returns {JSX.Element} Multi-step import workspace with breadcrumb stepper and stage views.
 */
export function BatchImportWorkspace({ batchId }: BatchImportWorkspaceProps) {
  const navigate = useNavigate();

  // Wizard state: 1 (Upload), 2 (Mapping), 3 (Uploading Chunks), 4 (Results/Review)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Batch & Template State
  const [batch, setBatch] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [templateVersion, setTemplateVersion] = useState<any>(null);
  const [isLoadingBatch, setIsLoadingBatch] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // In-flight File & Import State
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [parsedResult, setParsedResult] =
    useState<ParsedSpreadsheetResult | null>(null);
  const [activeImportId, setActiveImportId] = useState<string | null>(null);
  const [isInitializingImport, setIsInitializingImport] = useState(false);
  const [uploadedFileMeta, setUploadedFileMeta] = useState<{
    name: string;
    size: number;
    type: string;
    rowCount?: number;
    worksheet?: string;
  } | null>(null);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [dateHints, setDateHints] = useState<
    Record<string, "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD">
  >({});

  // Ingestion Progress State
  const [uploadProgress, setUploadProgress] = useState({
    currentChunk: 0,
    totalChunks: 0,
    uploadedRows: 0,
    totalRows: 0,
    status: "idle" as
      "idle" | "uploading" | "validating" | "completed" | "error",
    errorMessage: null as string | null,
  });

  // Validation Summary & Draft Rows State
  const [validationSummary, setValidationSummary] = useState<{
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
  } | null>(null);
  const [draftRows, setDraftRows] = useState<DisplayDraftRow[]>([]);
  const [isLoadingDraftRows, setIsLoadingDraftRows] = useState(false);

  const loadRows = useCallback(async () => {
    try {
      setIsLoadingDraftRows(true);
      const res = await fetch(`/api/batches/${batchId}/rows?limit=100`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load draft rows");
      const data = await res.json();
      setDraftRows(data.rows || []);
    } catch (err: any) {
      toast.error(
        "Failed to load draft records",
        err.message || "Error loading rows",
      );
    } finally {
      setIsLoadingDraftRows(false);
    }
  }, [batchId]);

  // Load batch details
  useEffect(() => {
    async function loadBatch() {
      try {
        setIsLoadingBatch(true);
        const res = await fetch(`/api/batches/${batchId}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load batch");
        const data = await res.json();
        setBatch(data.batch);
        setTemplate(data.template);
        setTemplateVersion(data.templateVersion);

        // If batch already has completed import, load draft rows and jump to Step 4
        if (data.currentImport && data.currentImport.status === "completed") {
          setActiveImportId(data.currentImport._id);
          setColumnMap(data.currentImport.columnMap || {});
          if (data.currentImport.dateFormatHints) {
            setDateHints(data.currentImport.dateFormatHints);
          }
          setValidationSummary({
            totalRows: data.currentImport.rowCount || 0,
            validRows: data.currentImport.validCount || 0,
            invalidRows: data.currentImport.invalidCount || 0,
            duplicateRows: data.currentImport.duplicateCount || 0,
          });
          setCurrentStep(4);
          loadRows();
        }

        if (data.currentImport) {
          const isXlsx =
            data.currentImport.sourceFileName?.endsWith(".xlsx") ||
            data.currentImport.sourceFileName?.endsWith(".xls");
          setUploadedFileMeta({
            name: data.currentImport.sourceFileName || "Uploaded Spreadsheet",
            size: data.currentImport.sourceFileSize || 0,
            type: isXlsx ? "xlsx" : "csv",
            rowCount: data.currentImport.rowCount || 0,
            worksheet: data.currentImport.worksheetName,
          });
        }
      } catch (err: any) {
        setApiError(err.message || "Error loading batch");
      } finally {
        setIsLoadingBatch(false);
      }
    }
    loadBatch();
  }, [batchId, loadRows]);

  // Handle client-side file parsed
  const handleFileParsed = async (
    result: ParsedSpreadsheetResult,
    fileMeta: { name: string; size: number; type: string },
    buffer?: ArrayBuffer,
  ) => {
    setParsedResult(result);
    if (buffer) setFileBuffer(buffer);
    setApiError(null);
    setIsInitializingImport(true);

    setUploadedFileMeta({
      name: fileMeta.name,
      size: fileMeta.size,
      type: fileMeta.type,
      rowCount: result.rows.length,
      worksheet: result.selectedWorksheet,
    });

    try {
      // Initialize BatchImport record (AC8 - bumps revision if re-importing)
      const res = await fetch(`/api/batches/${batchId}/imports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sourceFileName: fileMeta.name,
          sourceFileSize: fileMeta.size,
          worksheetName: result.selectedWorksheet,
          availableWorksheets: result.availableWorksheets,
          rawHeaders: result.rawHeaders,
          disambiguatedHeaders: result.disambiguatedHeaders,
          columnMap,
          dateFormatHints: dateHints,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to initialize import");
      }

      const data = await res.json();
      setActiveImportId(data.batchImport._id);
      setCurrentStep(2); // advance to mapping
    } catch (err: any) {
      setApiError(err.message || "Error initializing import");
      toast.error(
        "Import Initialization Failed",
        err.message || "Failed to initialize import session",
      );
    } finally {
      setIsInitializingImport(false);
    }
  };

  // Handle worksheet switch
  const handleSelectWorksheet = (sheetName: string) => {
    if (!fileBuffer || !parsedResult) return;
    try {
      const reParsed = parseXlsxBuffer(fileBuffer, {
        worksheetName: sheetName,
      });
      setParsedResult(reParsed);
      setUploadedFileMeta((prev) =>
        prev
          ? {
              ...prev,
              worksheet: sheetName,
              rowCount: reParsed.rows.length,
            }
          : null,
      );
    } catch (err: any) {
      setApiError(err.message || "Failed to switch worksheet");
      toast.error("Worksheet Selection Failed", err.message || "Failed to switch worksheet");
    }
  };

  // Handle mapping change with auto-persistence and failure reporting (AC2)
  const handleMappingChange = async (newMap: Record<string, string>) => {
    setColumnMap(newMap);
    if (!activeImportId) return;

    try {
      const res = await fetch(
        `/api/batches/${batchId}/imports/${activeImportId}/mapping`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            columnMap: newMap,
            dateFormatHints: dateHints,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.error || "Failed to update mapping";
        setApiError(msg);
        toast.error("Mapping Update Failed", msg);
      }
    } catch (err: any) {
      const msg = err.message || "Failed to update mapping";
      setApiError(msg);
      toast.error("Mapping Update Failed", msg);
    }
  };

  // Handle date format hint change with auto-persistence
  const handleDateHintChange = async (key: string, hint: any) => {
    const newHints = { ...dateHints, [key]: hint };
    setDateHints(newHints);
    if (!activeImportId) return;

    try {
      const res = await fetch(
        `/api/batches/${batchId}/imports/${activeImportId}/mapping`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ columnMap, dateFormatHints: newHints }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.error || "Failed to update date format hints";
        setApiError(msg);
        toast.error("Mapping Update Failed", msg);
      }
    } catch (err: any) {
      const msg = err.message || "Failed to update date format hints";
      setApiError(msg);
      toast.error("Mapping Update Failed", msg);
    }
  };

  // Handle Chunked Upload Execution (AC6, AC7)
  const startChunkedUpload = async () => {
    if (!parsedResult || !activeImportId) return;

    // Persist latest mapping and date hints before streaming chunks
    try {
      const mapRes = await fetch(
        `/api/batches/${batchId}/imports/${activeImportId}/mapping`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ columnMap, dateFormatHints: dateHints }),
        },
      );
      if (!mapRes.ok) {
        const err = await mapRes.json().catch(() => ({}));
        throw new Error(
          err.error || "Failed to save mapping before starting upload",
        );
      }
    } catch (err: any) {
      const msg =
        err.message || "Failed to save mapping before starting upload";
      setApiError(msg);
      toast.error("Mapping Save Failed", msg);
      return;
    }

    const rows = parsedResult.rows;
    const CHUNK_SIZE = 500;
    const totalChunks = Math.ceil(rows.length / CHUNK_SIZE);

    setCurrentStep(3);
    setUploadProgress({
      currentChunk: 0,
      totalChunks,
      uploadedRows: 0,
      totalRows: rows.length,
      status: "uploading",
      errorMessage: null,
    });

    try {
      // Stream bounded chunks sequentially
      for (let i = 0; i < totalChunks; i++) {
        const chunkIndex = i;
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, rows.length);
        const chunkRows = rows.slice(start, end).map((r, idx) => ({
          sourceRowNumber: parsedResult.dataStartRowIndex + start + idx + 1,
          rowKey: `row_${parsedResult.dataStartRowIndex + start + idx + 1}`,
          importedData: r,
        }));

        const chunkId = `${activeImportId}_chunk_${chunkIndex}`;

        setUploadProgress((prev) => ({
          ...prev,
          currentChunk: chunkIndex + 1,
          uploadedRows: end,
        }));

        const res = await fetch(
          `/api/batches/${batchId}/imports/${activeImportId}/rows`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              chunkId,
              chunkIndex,
              totalChunks,
              rows: chunkRows,
            }),
          },
        );

        if (!res.ok) {
          const err = await res.json();
          const msg = `Chunk ${chunkIndex + 1} of ${totalChunks}: ${err.error || "Upload failed"}`;
          toast.error("Chunk Upload Failed", msg);
          throw new Error(err.error || `Failed on chunk ${chunkIndex + 1}`);
        }
      }

      // Finalize import with server count verification (AC7)
      setUploadProgress((prev) => ({ ...prev, status: "validating" }));

      const finalizeRes = await fetch(
        `/api/batches/${batchId}/imports/${activeImportId}/finalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            totalExpectedRows: rows.length,
            totalExpectedChunks: totalChunks,
            columnMap,
            dateFormatHints: dateHints,
          }),
        },
      );

      if (!finalizeRes.ok) {
        const err = await finalizeRes.json();
        throw new Error(
          err.error?.message || err.error || "Finalization count mismatch",
        );
      }

      const finalizeData = await finalizeRes.json();
      setValidationSummary(finalizeData.summary);
      setUploadProgress((prev) => ({ ...prev, status: "completed" }));
      toast.success(
        "Spreadsheet Ingestion Complete",
        `${rows.length.toLocaleString()} rows processed and validated.`,
      );

      // Fetch persisted draft rows
      await loadRows();
      setCurrentStep(4);
    } catch (err: any) {
      setUploadProgress((prev) => ({
        ...prev,
        status: "error",
        errorMessage: err.message || "Upload failed",
      }));
      setApiError(err.message || "Upload pipeline failed");
      toast.error("Import Pipeline Failed", err.message || "Upload failed");
    }
  };

  const fieldMappings = templateVersion?.fieldMappings || [];

  return (
    <PageShell
      title={
        batch ? (
          <span className="flex items-center gap-2.5">
            {batch.name}
            <Badge variant="neutral" size="sm" shape="rounded" mono>
              {batch.status}
            </Badge>
          </span>
        ) : (
          "Batch Import"
        )
      }
      subtitle={
        batch ? (
          <span>
            Template:{" "}
            <span className="text-slate-700 font-semibold">
              {template?.name}
            </span>{" "}
            (v{templateVersion?.version}) · Revision{" "}
            {batch.currentImportRevision || 0}
          </span>
        ) : undefined
      }
      backTo="/app"
      backLabel="Back to Dashboard"
      maxWidth="5xl"
      contentClassName="space-y-6"
      isLoading={isLoadingBatch}
      skeleton={<BatchImportSkeleton />}
      loadingTitle="Loading batch configuration..."
      actions={
        batch ? (
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold">
            {(
              [
                { step: 1, label: "1. File" },
                { step: 2, label: "2. Map" },
                { step: 3, label: "3. Ingest" },
                { step: 4, label: "4. Review" },
              ] as const
            ).map(({ step, label }, idx) => {
              const isActive = currentStep === step;
              const isDone = currentStep > step;
              const canNavigate = isDone && step !== 3;
              return (
                <span key={label} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!canNavigate}
                    onClick={() => {
                      if (canNavigate) setCurrentStep(step as 1 | 2 | 4);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all text-xs font-semibold ${
                      isActive
                        ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/25"
                        : isDone
                          ? "bg-blue-50 text-blue-700 border border-blue-200/80 hover:bg-blue-100 hover:border-blue-300 cursor-pointer shadow-2xs"
                          : "bg-slate-100 text-slate-400 border border-slate-200/60 cursor-default"
                    }`}
                  >
                    {isDone && (
                      <Check
                        className="w-3.5 h-3.5 text-blue-600 stroke-[3]"
                        weight="bold"
                      />
                    )}
                    {label}
                  </button>
                  {idx < 3 && (
                    <span
                      className={`text-xs font-bold transition-colors ${
                        currentStep > step ? "text-blue-400" : "text-slate-300"
                      }`}
                    >
                      →
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        ) : undefined
      }
    >
      {!batch ? (
        <EmptyState
          icon={<WarningCircle size={28} weight="duotone" />}
          title="Batch Not Found"
          description="The requested batch could not be found or you do not have permission to view it."
          variant="solid"
          size="compact"
        />
      ) : (
        <>
          {/* Mobile Step Progress Indicator */}
          <div className="flex sm:hidden items-center justify-between px-3.5 py-2.5 bg-blue-50/70 border border-blue-100 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span className="text-xs font-semibold text-blue-900">
                Step {currentStep} of 4:{" "}
                {
                  [
                    "File Upload",
                    "Column Mapping",
                    "Chunk Ingest",
                    "Validation Review",
                  ][currentStep - 1]
                }
              </span>
            </div>
            <div className="w-20 bg-blue-200/60 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / 4) * 100}%` }}
              />
            </div>
          </div>

          {apiError && <Alert variant="error">{apiError}</Alert>}

          {/* Step 1: Upload File */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <ImportSchemaSummary
                templateName={template?.name}
                version={templateVersion?.version}
                fields={fieldMappings}
              />

              {uploadedFileMeta && (
                <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
                      {uploadedFileMeta.type === "xlsx" ? (
                        <FileXls className="w-5 h-5 text-white" />
                      ) : (
                        <FileCsv className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {uploadedFileMeta.name}
                        </p>
                        <Badge variant="primary" size="sm" shape="pill" dot>
                          Currently Loaded
                        </Badge>
                        {uploadedFileMeta.worksheet && (
                          <Badge variant="neutral" size="sm" shape="pill">
                            Sheet: {uploadedFileMeta.worksheet}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 font-medium">
                        <span>{formatFileSize(uploadedFileMeta.size)}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-blue-700 font-semibold">
                          {uploadedFileMeta.rowCount?.toLocaleString()} rows
                        </span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer select-none"
                  >
                    <span>Continue with this file</span>
                    <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                  </button>
                </div>
              )}

              <DataFilePicker
                onParsed={handleFileParsed}
                isLoading={isInitializingImport}
                loadingText="Initializing batch import & validating headers..."
              />
            </div>
          )}

          {/* Step 2: Worksheet & Column Mapping */}
          {currentStep === 2 && parsedResult && (
            <div className="space-y-6">
              {/* Uploaded File Indicator Card */}
              {uploadedFileMeta && (
                <div className="p-4 rounded-2xl border border-blue-200/90 bg-linear-to-r from-blue-50/80 via-white to-blue-50/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/25">
                      {uploadedFileMeta.type === "xlsx" ? (
                        <FileXls className="w-6 h-6 text-white" />
                      ) : (
                        <FileCsv className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {uploadedFileMeta.name}
                        </p>
                        <Badge variant="success" size="sm" shape="pill" dot>
                          File Ready
                        </Badge>
                        {uploadedFileMeta.worksheet && (
                          <Badge variant="primary" size="sm" shape="pill">
                            Sheet: {uploadedFileMeta.worksheet}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap font-medium">
                        <span>{formatFileSize(uploadedFileMeta.size)}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-blue-700 font-semibold">
                          {(
                            uploadedFileMeta.rowCount ||
                            parsedResult.rows.length
                          ).toLocaleString()}{" "}
                          records detected
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>
                          {parsedResult.disambiguatedHeaders.length} headers
                          parsed
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-semibold transition-all shadow-2xs hover:border-slate-300 cursor-pointer"
                    >
                      Change File
                    </button>
                  </div>
                </div>
              )}

              <WorksheetSelector
                worksheets={parsedResult.availableWorksheets}
                selectedWorksheet={parsedResult.selectedWorksheet}
                onSelectWorksheet={handleSelectWorksheet}
              />

              <ColumnMappingTable
                fields={fieldMappings}
                availableHeaders={parsedResult.disambiguatedHeaders}
                columnMap={columnMap}
                onChangeMapping={handleMappingChange}
                dateHints={dateHints}
                onChangeDateHint={handleDateHintChange}
              />

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600 transition-colors cursor-pointer select-none"
                >
                  Back to File Upload
                </button>

                <button
                  type="button"
                  onClick={startChunkedUpload}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-[0.98] text-xs font-bold text-white shadow-sm shadow-blue-500/20 transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  Upload & Validate {parsedResult.rows.length.toLocaleString()}{" "}
                  Records
                  <ArrowRight className="w-4 h-4" weight="bold" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Chunk Upload Pipeline */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {uploadedFileMeta && (
                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                    {uploadedFileMeta.type === "xlsx" ? (
                      <FileXls className="w-5 h-5 text-white" />
                    ) : (
                      <FileCsv className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {uploadedFileMeta.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatFileSize(uploadedFileMeta.size)} ·{" "}
                      {uploadProgress.totalRows.toLocaleString()} rows
                    </p>
                  </div>
                  <Badge variant="primary" size="sm" shape="pill" dot>
                    Ingesting
                  </Badge>
                </div>
              )}

              <ImportProgress
                currentChunk={uploadProgress.currentChunk}
                totalChunks={uploadProgress.totalChunks}
                uploadedRows={uploadProgress.uploadedRows}
                totalRows={uploadProgress.totalRows}
                status={uploadProgress.status}
                errorMessage={uploadProgress.errorMessage}
              />
            </div>
          )}

          {/* Step 4: Validation Summary & Row Review */}
          {currentStep === 4 && validationSummary && (
            <div className="space-y-6">
              <ImportValidationSummary
                summary={validationSummary}
                onProceed={() =>
                  navigate({
                    to: "/app/batches/$batchId/review",
                    params: { batchId },
                  })
                }
                onReimport={() => setCurrentStep(1)}
              />

              <DuplicateWarning
                duplicateCount={validationSummary.duplicateRows}
              />

              {isLoadingDraftRows ? (
                <div className="p-8 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-xs text-slate-500">
                  <Spinner size="sm" className="mr-2" />
                  <span>Loading draft rows...</span>
                </div>
              ) : (
                <RowErrorTable
                  rows={draftRows}
                  totalRows={validationSummary.totalRows}
                />
              )}
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
