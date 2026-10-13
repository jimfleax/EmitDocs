import React, { useState, useRef } from 'react';
import { UploadSimple, FileCsv, FileXls } from '@phosphor-icons/react';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { parseCsvString, parseXlsxBuffer, type ParsedSpreadsheetResult } from '@/lib/spreadsheet/spreadsheet-parser';

interface DataFilePickerProps {
  onParsed: (
    result: ParsedSpreadsheetResult,
    fileMeta: { name: string; size: number; type: string },
    buffer?: ArrayBuffer
  ) => void;
  isLoading?: boolean;
  loadingText?: string;
}

export function DataFilePicker({
  onParsed,
  isLoading = false,
  loadingText,
}: DataFilePickerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = isProcessing || isLoading;

  const processFile = async (file: File) => {
    if (isBusy) return;
    setParsingError(null);
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      setParsingError('Unsupported file type. Please upload a CSV or XLSX spreadsheet.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setParsingError('File exceeds maximum size of 25MB.');
      return;
    }

    setIsProcessing(true);
    try {
      if (ext === 'csv') {
        const text = await file.text();
        const result = parseCsvString(text);
        if (result.rows.length === 0) {
          throw new Error('Spreadsheet has no data rows.');
        }
        onParsed(result, { name: file.name, size: file.size, type: 'csv' });
      } else {
        const buffer = await file.arrayBuffer();
        const result = parseXlsxBuffer(buffer);
        if (result.rows.length === 0) {
          throw new Error('Spreadsheet has no data rows.');
        }
        onParsed(result, { name: file.name, size: file.size, type: 'xlsx' }, buffer);
      }
    } catch (err: any) {
      setParsingError(err.message || 'Failed to parse spreadsheet file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isBusy) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isBusy) return;
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!isBusy) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (!isBusy) fileInputRef.current?.click();
        }}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 ${
          isBusy
            ? 'border-blue-400 bg-blue-50/70 ring-4 ring-blue-500/10 cursor-wait'
            : isDragging
            ? 'border-blue-500 bg-blue-50/80 cursor-copy'
            : 'border-slate-200 hover:border-blue-300 bg-slate-50/60 hover:bg-blue-50/30 cursor-pointer'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          disabled={isBusy}
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
              isBusy
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white border border-slate-200 shadow-xs text-slate-500'
            }`}
          >
            {isBusy ? (
              <Spinner size="lg" variant="current" />
            ) : (
              <UploadSimple className="w-6 h-6 text-slate-600" />
            )}
          </div>

          <div>
            <p
              className={`text-sm font-semibold transition-colors ${
                isBusy ? 'text-blue-900' : 'text-slate-800'
              }`}
            >
              {isProcessing
                ? 'Parsing spreadsheet data...'
                : isLoading
                ? (loadingText || 'Initializing batch import & validating headers...')
                : 'Click to upload or drag & drop'}
            </p>
            <p
              className={`text-xs mt-1 transition-colors ${
                isBusy ? 'text-blue-600 font-medium' : 'text-slate-400'
              }`}
            >
              {isBusy
                ? 'Please wait while file headers and structure are validated...'
                : 'Supports CSV or XLSX up to 25MB (500–5,000 rows)'}
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <FileCsv className="w-4 h-4 text-emerald-500" /> RFC-4180 CSV
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5 font-medium">
              <FileXls className="w-4 h-4 text-blue-500" /> Multi-sheet XLSX
            </span>
          </div>
        </div>
      </div>

      {parsingError && (
        <Alert variant="error" className="mt-3">
          {parsingError}
        </Alert>
      )}
    </div>
  );
}
