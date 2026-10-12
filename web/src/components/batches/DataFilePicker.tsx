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
}

export function DataFilePicker({ onParsed, isLoading = false }: DataFilePickerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-slate-200 hover:border-slate-300 bg-slate-50/60 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-500">
            {isProcessing || isLoading ? (
              <Spinner size="lg" />
            ) : (
              <UploadSimple className="w-6 h-6" />
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-800">
              {isProcessing ? 'Parsing spreadsheet data...' : 'Click to upload or drag & drop'}
            </p>
            <p className="text-xs text-slate-400 mt-1">Supports CSV or XLSX up to 25MB (500–5,000 rows)</p>
          </div>

          <div className="flex items-center gap-3 pt-1 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <FileCsv className="w-4 h-4 text-emerald-500" /> RFC-4180 CSV
            </span>
            <span className="text-slate-200">•</span>
            <span className="flex items-center gap-1.5">
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
