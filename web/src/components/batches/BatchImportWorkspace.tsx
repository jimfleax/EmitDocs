import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRight, WarningCircle } from '@phosphor-icons/react';
import { PageShell } from '@/components/layout/PageShell';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { DataFilePicker } from './DataFilePicker';
import { WorksheetSelector } from './WorksheetSelector';
import { ImportSchemaSummary } from './ImportSchemaSummary';
import { ColumnMappingTable } from './ColumnMappingTable';
import { ImportProgress } from './ImportProgress';
import { ImportValidationSummary } from './ImportValidationSummary';
import { DuplicateWarning } from './DuplicateWarning';
import { RowErrorTable, type DisplayDraftRow } from './RowErrorTable';
import { type ParsedSpreadsheetResult, parseXlsxBuffer } from '@/lib/spreadsheet/spreadsheet-parser';

interface BatchImportWorkspaceProps {
  batchId: string;
}

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
  const [parsedResult, setParsedResult] = useState<ParsedSpreadsheetResult | null>(null);
  const [activeImportId, setActiveImportId] = useState<string | null>(null);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [dateHints, setDateHints] = useState<Record<string, 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'>>({});

  // Ingestion Progress State
  const [uploadProgress, setUploadProgress] = useState({
    currentChunk: 0,
    totalChunks: 0,
    uploadedRows: 0,
    totalRows: 0,
    status: 'idle' as 'idle' | 'uploading' | 'validating' | 'completed' | 'error',
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

  const loadRows = useCallback(async () => {
    try {
      const res = await fetch(`/api/batches/${batchId}/rows?limit=100`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setDraftRows(data.rows || []);
      }
    } catch {
      // ignore
    }
  }, [batchId]);

  // Load batch details
  useEffect(() => {
    async function loadBatch() {
      try {
        setIsLoadingBatch(true);
        const res = await fetch(`/api/batches/${batchId}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load batch');
        const data = await res.json();
        setBatch(data.batch);
        setTemplate(data.template);
        setTemplateVersion(data.templateVersion);

        // If batch already has completed import, load draft rows and jump to Step 4
        if (data.currentImport && data.currentImport.status === 'completed') {
          setActiveImportId(data.currentImport._id);
          setColumnMap(data.currentImport.columnMap || {});
          setValidationSummary({
            totalRows: data.currentImport.rowCount || 0,
            validRows: data.currentImport.validCount || 0,
            invalidRows: data.currentImport.invalidCount || 0,
            duplicateRows: data.currentImport.duplicateCount || 0,
          });
          setCurrentStep(4);
          loadRows();
        }
      } catch (err: any) {
        setApiError(err.message || 'Error loading batch');
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
    buffer?: ArrayBuffer
  ) => {
    setParsedResult(result);
    if (buffer) setFileBuffer(buffer);
    setApiError(null);

    try {
      // Initialize BatchImport record (AC8 - bumps revision if re-importing)
      const res = await fetch(`/api/batches/${batchId}/imports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sourceFileName: fileMeta.name,
          sourceFileSize: fileMeta.size,
          worksheetName: result.selectedWorksheet,
          availableWorksheets: result.availableWorksheets,
          rawHeaders: result.rawHeaders,
          disambiguatedHeaders: result.disambiguatedHeaders,
          columnMap: {},
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to initialize import');
      }

      const data = await res.json();
      setActiveImportId(data.batchImport._id);
      setCurrentStep(2); // advance to mapping
    } catch (err: any) {
      setApiError(err.message || 'Error initializing import');
    }
  };

  // Handle worksheet switch
  const handleSelectWorksheet = (sheetName: string) => {
    if (!fileBuffer || !parsedResult) return;
    try {
      const reParsed = parseXlsxBuffer(fileBuffer, { worksheetName: sheetName });
      setParsedResult(reParsed);
    } catch (err: any) {
      setApiError(err.message || 'Failed to switch worksheet');
    }
  };

  // Handle mapping change with auto-persistence (AC2)
  const handleMappingChange = async (newMap: Record<string, string>) => {
    setColumnMap(newMap);
    if (!activeImportId) return;

    try {
      await fetch(`/api/batches/${batchId}/imports/${activeImportId}/mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ columnMap: newMap }),
      });
    } catch {
      // Silent retry on background save
    }
  };

  // Handle Chunked Upload Execution (AC6, AC7)
  const startChunkedUpload = async () => {
    if (!parsedResult || !activeImportId) return;

    const rows = parsedResult.rows;
    const CHUNK_SIZE = 500;
    const totalChunks = Math.ceil(rows.length / CHUNK_SIZE);

    setCurrentStep(3);
    setUploadProgress({
      currentChunk: 0,
      totalChunks,
      uploadedRows: 0,
      totalRows: rows.length,
      status: 'uploading',
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

        const res = await fetch(`/api/batches/${batchId}/imports/${activeImportId}/rows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            chunkId,
            chunkIndex,
            totalChunks,
            rows: chunkRows,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `Failed on chunk ${chunkIndex + 1}`);
        }
      }

      // Finalize import with server count verification (AC7)
      setUploadProgress((prev) => ({ ...prev, status: 'validating' }));

      const finalizeRes = await fetch(
        `/api/batches/${batchId}/imports/${activeImportId}/finalize`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            totalExpectedRows: rows.length,
            totalExpectedChunks: totalChunks,
            columnMap,
          }),
        }
      );

      if (!finalizeRes.ok) {
        const err = await finalizeRes.json();
        throw new Error(err.error?.message || err.error || 'Finalization count mismatch');
      }

      const finalizeData = await finalizeRes.json();
      setValidationSummary(finalizeData.summary);
      setUploadProgress((prev) => ({ ...prev, status: 'completed' }));

      // Fetch persisted draft rows
      await loadRows();
      setCurrentStep(4);
    } catch (err: any) {
      setUploadProgress((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: err.message || 'Upload failed',
      }));
      setApiError(err.message || 'Upload pipeline failed');
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
          'Batch Import'
        )
      }
      subtitle={
        batch ? (
          <span>
            Template: <span className="text-slate-700 font-semibold">{template?.name}</span>{' '}
            (v{templateVersion?.version}) · Revision {batch.currentImportRevision || 0}
          </span>
        ) : undefined
      }
      backTo="/app"
      backLabel="Back to Dashboard"
      maxWidth="5xl"
      contentClassName="space-y-6"
      isLoading={isLoadingBatch}
      loadingTitle="Loading batch configuration..."
      actions={
        batch ? (
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold">
            {(['1. File', '2. Map', '3. Ingest', '4. Review'] as const).map((label, idx) => {
              const step = (idx + 1) as 1 | 2 | 3 | 4;
              const isActive = currentStep === step;
              const isDone = currentStep > step;
              return (
                <span key={label} className="flex items-center gap-1.5">
                  <span
                    className={`px-2.5 py-1 rounded-full transition-all ${
                      isActive
                        ? 'bg-slate-950 text-white'
                        : isDone
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {label}
                  </span>
                  {idx < 3 && <span className="text-slate-300">→</span>}
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
          {apiError && (
            <Alert variant="error">
              {apiError}
            </Alert>
          )}

          {/* Step 1: Upload File */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <ImportSchemaSummary
                templateName={template?.name}
                version={templateVersion?.version}
                fields={fieldMappings}
              />
              <DataFilePicker onParsed={handleFileParsed} />
            </div>
          )}

          {/* Step 2: Worksheet & Column Mapping */}
          {currentStep === 2 && parsedResult && (
            <div className="space-y-6">
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
                onChangeDateHint={(key, hint) =>
                  setDateHints((prev) => ({ ...prev, [key]: hint }))
                }
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
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 active:scale-[0.98] text-xs font-semibold text-white shadow-sm transition-all cursor-pointer select-none"
                >
                  Upload & Validate {parsedResult.rows.length.toLocaleString()} Records
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Chunk Upload Pipeline */}
          {currentStep === 3 && (
            <ImportProgress
              currentChunk={uploadProgress.currentChunk}
              totalChunks={uploadProgress.totalChunks}
              uploadedRows={uploadProgress.uploadedRows}
              totalRows={uploadProgress.totalRows}
              status={uploadProgress.status}
              errorMessage={uploadProgress.errorMessage}
            />
          )}

          {/* Step 4: Validation Summary & Row Review */}
          {currentStep === 4 && validationSummary && (
            <div className="space-y-6">
              <ImportValidationSummary
                summary={validationSummary}
                onProceed={() =>
                  navigate({
                    to: '/app/batches/$batchId/review',
                    params: { batchId },
                  })
                }
                onReimport={() => setCurrentStep(1)}
              />

              <DuplicateWarning duplicateCount={validationSummary.duplicateRows} />

              <RowErrorTable rows={draftRows} totalRows={validationSummary.totalRows} />
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
