/**
 * @file useBatchGeneratorWorker.ts
 * @description State machine hook encapsulating Web Worker PDF generation lifecycle (PRD-CORE-07).
 * @architecture Manages worker instantiation, typed handshake protocol, fallback Node/SSR execution, and live metrics.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  FieldMappingConfig,
  EngineWarning,
} from "@/lib/pdf-engine/pdf-preview-engine";
import { generatePdfWithOverlay } from "@/lib/pdf-engine/pdf-preview-engine";
import { sanitizeRecipientFilename } from "@/lib/pdf-engine/filename-sanitizer";
import { createStreamingZip, saveZipChunksAsBlob } from "@/lib/pdf-engine/streaming-zip";
import type {
  WorkerInboundMessage,
  WorkerOutboundMessage,
  RecipientBatchItem,
  SingleRecipientItem,
} from "@/workers/batch-generator.worker";

export interface ZipExportProgress {
  current: number;
  total: number;
  percent: number;
  itemsPerSec: number;
  etaSeconds: number;
  elapsedSeconds: number;
  activeRecipientKey: string | null;
  activeDocName: string | null;
  bytesEmitted: number;
  volumeIndex: number;
}

export interface GenerationProgress {
  current: number;
  total: number;
  percent: number;
  itemsPerSec: number;
  etaSeconds: number;
  elapsedSeconds: number;
  activeRecipientKey: string | null;
  warningsCount: number;
}

export type WorkerStatus =
  | "idle"
  | "initializing"
  | "ready"
  | "generating"
  | "paused"
  | "completed"
  | "cancelled"
  | "error";

export interface UseBatchGeneratorWorkerReturn {
  status: WorkerStatus;
  progress: GenerationProgress;
  error: string | null;
  warningsMap: Record<string, EngineWarning[]>;
  generatedMap: Record<string, { byteLength: number; generatedAt: number }>;
  errorsMap: Record<string, string>;
  initializeWorker: (
    basePdfBytes: ArrayBuffer,
    fieldMappings: FieldMappingConfig[],
    customFontBytes?: ArrayBuffer,
  ) => Promise<void>;
  generateSingle: (recipient: SingleRecipientItem) => Promise<{
    pdfBytes: Uint8Array;
    warnings: EngineWarning[];
    durationMs: number;
  }>;
  startBatch: (recipients: RecipientBatchItem[], startIndex?: number) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  reset: () => void;
  isZipping: boolean;
  zipProgress: ZipExportProgress;
  startZipExport: (
    recipients: RecipientBatchItem[],
    volumeIndex?: number,
    totalVolumes?: number,
    zipFilename?: string
  ) => Promise<{ success: boolean; totalBytes: number; durationMs: number }>;
  cancelZipExport: () => void;
}

const initialZipProgress: ZipExportProgress = {
  current: 0,
  total: 0,
  percent: 0,
  itemsPerSec: 0,
  etaSeconds: 0,
  elapsedSeconds: 0,
  activeRecipientKey: null,
  activeDocName: null,
  bytesEmitted: 0,
  volumeIndex: 1,
};

const initialProgress: GenerationProgress = {
  current: 0,
  total: 0,
  percent: 0,
  itemsPerSec: 0,
  etaSeconds: 0,
  elapsedSeconds: 0,
  activeRecipientKey: null,
  warningsCount: 0,
};

export function useBatchGeneratorWorker(): UseBatchGeneratorWorkerReturn {
  const [status, setStatus] = useState<WorkerStatus>("idle");
  const [progress, setProgress] = useState<GenerationProgress>(initialProgress);
  const [error, setError] = useState<string | null>(null);
  const [warningsMap, setWarningsMap] = useState<Record<string, EngineWarning[]>>({});
  const [generatedMap, setGeneratedMap] = useState<
    Record<string, { byteLength: number; generatedAt: number }>
  >({});
  const [errorsMap, setErrorsMap] = useState<Record<string, string>>({});
  const [isZipping, setIsZipping] = useState(false);
  const isZippingRef = useRef(false);
  const [zipProgress, setZipProgress] = useState<ZipExportProgress>(initialZipProgress);

  const zipChunksRef = useRef<Uint8Array[]>([]);
  const zipWritableRef = useRef<any>(null);
  const zipResolverRef = useRef<{
    resolve: (val: { success: boolean; totalBytes: number; durationMs: number }) => void;
    reject: (err: any) => void;
  } | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const pendingInitResolver = useRef<{
    resolve: () => void;
    reject: (err: any) => void;
  } | null>(null);

  const pendingSingleResolvers = useRef<
    Map<
      string,
      {
        resolve: (val: {
          pdfBytes: Uint8Array;
          warnings: EngineWarning[];
          durationMs: number;
        }) => void;
        reject: (err: any) => void;
        timerId: any;
      }
    >
  >(new Map());

  // Fallback state for Node/SSR or worker-unavailable environments
  const fallbackBasePdfBytes = useRef<Uint8Array | null>(null);
  const fallbackFieldMappings = useRef<FieldMappingConfig[]>([]);
  const fallbackIsPaused = useRef<boolean>(false);
  const fallbackIsCancelled = useRef<boolean>(false);
  const fallbackStepRef = useRef<(() => void) | null>(null);

  // Initialize Web Worker instance
  useEffect(() => {
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      return;
    }

    try {
      const worker = new Worker(
        new URL("../workers/batch-generator.worker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent<WorkerOutboundMessage>) => {
        const msg = event.data;
        if (!msg || typeof msg !== "object") return;

        switch (msg.type) {
          case "INIT_READY": {
            setStatus("ready");
            if (pendingInitResolver.current) {
              pendingInitResolver.current.resolve();
              pendingInitResolver.current = null;
            }
            break;
          }

          case "SINGLE_COMPLETE": {
            const { recipientKey, pdfBytes, warnings, durationMs, requestId } = msg.payload;
            const resolverKey = requestId || recipientKey;
            const resolver = pendingSingleResolvers.current.get(resolverKey);
            if (resolver) {
              clearTimeout(resolver.timerId);
              pendingSingleResolvers.current.delete(resolverKey);
              resolver.resolve({ pdfBytes, warnings, durationMs });
            }
            if (warnings && warnings.length > 0) {
              setWarningsMap((prev) => ({ ...prev, [recipientKey]: warnings }));
            }
            break;
          }

          case "PROGRESS": {
            const p = msg.payload;
            setProgress({
              current: p.current,
              total: p.total,
              percent: p.percent,
              itemsPerSec: p.itemsPerSec,
              etaSeconds: p.etaSeconds,
              elapsedSeconds: Math.round(p.elapsedMs / 1000),
              activeRecipientKey: p.activeRecipientKey,
              warningsCount: p.warningsCount,
            });
            break;
          }

          case "RECIPIENT_GENERATED": {
            const r = msg.payload;
            setGeneratedMap((prev) => ({
              ...prev,
              [r.recipientKey]: {
                byteLength: r.byteLength,
                generatedAt: Date.now(),
              },
            }));
            if (r.warnings && r.warnings.length > 0) {
              setWarningsMap((prev) => ({ ...prev, [r.recipientKey]: r.warnings }));
            }
            break;
          }

          case "PAUSED": {
            setStatus("paused");
            break;
          }

          case "RESUMED": {
            setStatus("generating");
            break;
          }

          case "BATCH_COMPLETE": {
            setStatus("completed");
            break;
          }

          case "ZIP_PROGRESS": {
            const p = msg.payload;
            setZipProgress({
              current: p.current,
              total: p.total,
              percent: p.percent,
              itemsPerSec: p.itemsPerSec,
              etaSeconds: p.etaSeconds,
              elapsedSeconds: Math.round(p.elapsedMs / 1000),
              activeRecipientKey: p.activeRecipientKey,
              activeDocName: p.activeDocName,
              bytesEmitted: p.bytesEmitted,
              volumeIndex: p.volumeIndex,
            });
            break;
          }

          case "ZIP_CHUNK": {
            const { chunk } = msg.payload;
            if (zipWritableRef.current) {
              void zipWritableRef.current.write(chunk);
            } else {
              zipChunksRef.current.push(chunk);
            }
            break;
          }

          case "ZIP_COMPLETE": {
            const { totalBytes, durationMs, zipFilename } = msg.payload;
            isZippingRef.current = false;
            setIsZipping(false);
            if (zipWritableRef.current) {
              const writable = zipWritableRef.current;
              zipWritableRef.current = null;
              void (async () => {
                try {
                  await writable.close();
                } catch (e) {
                  console.warn("Failed to close zip stream:", e);
                } finally {
                  zipResolverRef.current?.resolve({ success: true, totalBytes, durationMs });
                  zipResolverRef.current = null;
                }
              })();
            } else {
              saveZipChunksAsBlob(zipChunksRef.current, zipFilename);
              zipChunksRef.current = [];
              zipResolverRef.current?.resolve({ success: true, totalBytes, durationMs });
              zipResolverRef.current = null;
            }
            break;
          }

          case "CANCELLED": {
            setStatus("cancelled");
            isZippingRef.current = false;
            setIsZipping(false);
            if (zipWritableRef.current) {
              try {
                void zipWritableRef.current.abort();
              } catch {
                // Ignored
              }
              zipWritableRef.current = null;
            }
            zipChunksRef.current = [];
            if (zipResolverRef.current) {
              zipResolverRef.current.resolve({ success: false, totalBytes: 0, durationMs: 0 });
              zipResolverRef.current = null;
            }
            break;
          }

          case "ERROR": {
            const { message, fatal, recipientKey, requestId } = msg.payload;
            const resolverKey = requestId || recipientKey;
            if (resolverKey) {
              const resolver = pendingSingleResolvers.current.get(resolverKey);
              if (resolver) {
                clearTimeout(resolver.timerId);
                pendingSingleResolvers.current.delete(resolverKey);
                resolver.reject(new Error(message));
              }
            }
            if (recipientKey) {
              setErrorsMap((prev) => ({ ...prev, [recipientKey]: message }));
            }
            if (fatal) {
              setStatus("error");
              setError(message);
              if (pendingInitResolver.current) {
                pendingInitResolver.current.reject(new Error(message));
                pendingInitResolver.current = null;
              }
            }
            if (isZippingRef.current) {
              isZippingRef.current = false;
              setIsZipping(false);
              if (zipWritableRef.current) {
                try {
                  void zipWritableRef.current.abort();
                } catch {
                  // Ignored
                }
                zipWritableRef.current = null;
              }
              zipChunksRef.current = [];
              if (zipResolverRef.current) {
                zipResolverRef.current.reject(new Error(message));
                zipResolverRef.current = null;
              }
            }
            break;
          }
        }
      };

      worker.onerror = (err) => {
        console.error("Batch generator worker error:", err);
        const errMsg = err.message || "Web Worker execution error";
        setStatus("error");
        setError(errMsg);

        if (pendingInitResolver.current) {
          pendingInitResolver.current.reject(new Error(errMsg));
          pendingInitResolver.current = null;
        }

        for (const [, resolver] of pendingSingleResolvers.current) {
          clearTimeout(resolver.timerId);
          resolver.reject(new Error(errMsg));
        }
        pendingSingleResolvers.current.clear();

        worker.terminate();
        workerRef.current = null;
      };
    } catch (err: any) {
      console.warn("Worker creation failed, fallback mode enabled:", err);
    }

    const resolvers = pendingSingleResolvers.current;
    return () => {
      fallbackStepRef.current = null;
      workerRef.current?.terminate();
      workerRef.current = null;
      for (const [, resolver] of resolvers) {
        clearTimeout(resolver.timerId);
      }
      resolvers.clear();
    };
  }, []);

  const initializeWorker = useCallback(
    async (
      basePdfBytes: ArrayBuffer,
      fieldMappings: FieldMappingConfig[],
      customFontBytes?: ArrayBuffer,
    ): Promise<void> => {
      setStatus("initializing");
      setError(null);

      // Fallback for Node/SSR / Worker unavailable
      if (!workerRef.current) {
        fallbackBasePdfBytes.current = new Uint8Array(basePdfBytes);
        fallbackFieldMappings.current = fieldMappings;
        setStatus("ready");
        return;
      }

      return new Promise<void>((resolve, reject) => {
        pendingInitResolver.current = { resolve, reject };

        const clonedBytes = basePdfBytes.slice(0);
        const msg: WorkerInboundMessage = {
          type: "INIT",
          payload: {
            basePdfBytes: clonedBytes,
            fieldMappings,
            customFontBytes,
          },
        };
        workerRef.current?.postMessage(msg, [clonedBytes]);
      });
    },
    [],
  );

  const generateSingle = useCallback(
    async (recipient: SingleRecipientItem): Promise<{
      pdfBytes: Uint8Array;
      warnings: EngineWarning[];
      durationMs: number;
    }> => {
      // Fallback path
      if (!workerRef.current) {
        if (!fallbackBasePdfBytes.current) {
          throw new Error("Worker not initialized with template");
        }
        const start = performance.now();
        const stringData: Record<string, string> = {};
        if (recipient.effectiveData) {
          for (const [k, v] of Object.entries(recipient.effectiveData)) {
            stringData[k] = v !== null && v !== undefined ? String(v) : "";
          }
        }
        const { pdfBytes, warnings } = await generatePdfWithOverlay(
          fallbackBasePdfBytes.current,
          fallbackFieldMappings.current,
          stringData,
          { drawDebugBoxes: false },
        );
        return {
          pdfBytes,
          warnings,
          durationMs: performance.now() - start,
        };
      }

      return new Promise((resolve, reject) => {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const timerId = setTimeout(() => {
          if (pendingSingleResolvers.current.has(requestId)) {
            pendingSingleResolvers.current.delete(requestId);
            reject(
              new Error(
                `Timeout generating single recipient: ${recipient.recipientKey}`,
              ),
            );
          }
        }, 15000);

        pendingSingleResolvers.current.set(requestId, {
          resolve,
          reject,
          timerId,
        });

        workerRef.current?.postMessage({
          type: "GENERATE_SINGLE",
          payload: { recipient, requestId },
        });
      });
    },
    [],
  );

  const startBatch = useCallback(
    (recipients: RecipientBatchItem[], startIndex = 0): void => {
      if (!workerRef.current) {
        // Fallback simulated execution for headless tests
        setStatus("generating");
        fallbackIsPaused.current = false;
        fallbackIsCancelled.current = false;

        let idx = startIndex;
        const total = recipients.length;
        const startMs = performance.now();

        const step = async () => {
          if (fallbackIsCancelled.current) {
            fallbackStepRef.current = null;
            setStatus("cancelled");
            return;
          }
          if (fallbackIsPaused.current) {
            setStatus("paused");
            return;
          }
          if (idx >= total) {
            fallbackStepRef.current = null;
            setStatus("completed");
            return;
          }

          const r = recipients[idx];
          const stringData: Record<string, string> = {};
          if (r.effectiveData) {
            for (const [k, v] of Object.entries(r.effectiveData)) {
              stringData[k] = v !== null && v !== undefined ? String(v) : "";
            }
          }

          try {
            const { pdfBytes, warnings } = await generatePdfWithOverlay(
              fallbackBasePdfBytes.current!,
              fallbackFieldMappings.current,
              stringData,
              { drawDebugBoxes: false },
            );
            setGeneratedMap((prev) => ({
              ...prev,
              [r.recipientKey]: {
                byteLength: pdfBytes.byteLength,
                generatedAt: Date.now(),
              },
            }));
            if (warnings.length > 0) {
              setWarningsMap((prev) => ({ ...prev, [r.recipientKey]: warnings }));
            }
          } catch (err: any) {
            console.warn("Fallback generation error:", err);
            setErrorsMap((prev) => ({
              ...prev,
              [r.recipientKey]: err?.message || String(err),
            }));
          }

          const current = idx + 1;
          const percent = total > 0 ? Math.round((current / total) * 100) : 0;
          const elapsed = (performance.now() - startMs) / 1000;
          const speed = elapsed > 0 ? current / elapsed : 0;
          const eta = speed > 0 ? Math.ceil((total - current) / speed) : 0;

          setProgress({
            current,
            total,
            percent,
            itemsPerSec: Number(speed.toFixed(2)),
            etaSeconds: eta,
            elapsedSeconds: Math.round(elapsed),
            activeRecipientKey: r.recipientKey,
            warningsCount: 0,
          });

          idx++;
          setTimeout(step, 0);
        };

        fallbackStepRef.current = step;
        void step();
        return;
      }

      setStatus("generating");
      setError(null);
      setProgress((prev) => ({
        ...prev,
        total: recipients.length,
        current: startIndex,
        percent:
          recipients.length > 0
            ? Math.round((startIndex / recipients.length) * 100)
            : 0,
        activeRecipientKey: recipients[startIndex]?.recipientKey ?? null,
      }));

      workerRef.current.postMessage({
        type: "START_BATCH",
        payload: {
          recipients,
          startIndex,
        },
      });
    },
    [],
  );

  const pause = useCallback((): void => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "PAUSE" });
    } else {
      fallbackIsPaused.current = true;
      setStatus("paused");
    }
  }, []);

  const resume = useCallback((): void => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "RESUME" });
    } else {
      fallbackIsPaused.current = false;
      setStatus("generating");
      if (fallbackStepRef.current) {
        void fallbackStepRef.current();
      }
    }
  }, []);

  const cancel = useCallback((): void => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "CANCEL" });
    } else {
      fallbackIsCancelled.current = true;
      fallbackStepRef.current = null;
      setStatus("cancelled");
    }
  }, []);

  const reset = useCallback((): void => {
    fallbackStepRef.current = null;
    setStatus("ready");
    setError(null);
    setProgress(initialProgress);
    setWarningsMap({});
    setGeneratedMap({});
    setErrorsMap({});
    setIsZipping(false);
    setZipProgress(initialZipProgress);
  }, []);

  const startZipExport = useCallback(
    async (
      recipients: RecipientBatchItem[],
      volumeIndex = 1,
      totalVolumes = 1,
      zipFilename = "documents.zip"
    ): Promise<{ success: boolean; totalBytes: number; durationMs: number }> => {
      isZippingRef.current = true;
      setIsZipping(true);
      setZipProgress({
        ...initialZipProgress,
        total: recipients.length,
        volumeIndex,
      });
      zipChunksRef.current = [];
      zipWritableRef.current = null;

      // Check for FileSystem Access API support
      if (
        typeof window !== "undefined" &&
        "showSaveFilePicker" in window &&
        typeof (window as any).showSaveFilePicker === "function"
      ) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: zipFilename,
            types: [
              {
                description: "ZIP Archive",
                accept: { "application/zip": [".zip"] },
              },
            ],
          });
          zipWritableRef.current = await handle.createWritable();
        } catch (err: any) {
          if (err?.name === "AbortError") {
            isZippingRef.current = false;
            setIsZipping(false);
            return { success: false, totalBytes: 0, durationMs: 0 };
          }
          // Fallback to in-memory Blob accumulation
          zipWritableRef.current = null;
        }
      }

      return new Promise((resolve, reject) => {
        zipResolverRef.current = { resolve, reject };

        if (!workerRef.current) {
          // Fallback if running without worker
          void (async () => {
            try {
              const baseBytes = fallbackBasePdfBytes.current;
              const fieldMappings = fallbackFieldMappings.current || [];
              if (!baseBytes) throw new Error("Worker not initialized with template");
              const nonNullBase = baseBytes;

              async function* fallbackEntries() {
                for (const r of recipients) {
                  const stringData: Record<string, string> = {};
                  for (const [k, v] of Object.entries(r.effectiveData || {})) {
                    stringData[k] = v !== null && v !== undefined ? String(v) : "";
                  }
                  const res = await generatePdfWithOverlay(nonNullBase, fieldMappings, stringData, {
                    drawDebugBoxes: false,
                  });
                  const fname = sanitizeRecipientFilename(r.effectiveData, r.recipientKey);
                  yield { name: fname, input: res.pdfBytes };
                }
              }

              const stream = createStreamingZip(fallbackEntries());
              const reader = stream.getReader();
              const chunks: Uint8Array[] = [];
              let totalBytes = 0;
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value && value.length > 0) {
                  chunks.push(value);
                  totalBytes += value.length;
                }
              }

              saveZipChunksAsBlob(chunks, zipFilename);
              setIsZipping(false);
              resolve({ success: true, totalBytes, durationMs: 0 });
            } catch (err) {
              setIsZipping(false);
              reject(err);
            }
          })();
          return;
        }

        workerRef.current.postMessage({
          type: "START_ZIP_BATCH",
          payload: {
            recipients,
            volumeIndex,
            totalVolumes,
            zipFilename,
          },
        });
      });
    },
    [],
  );

  const cancelZipExport = useCallback((): void => {
    if (zipWritableRef.current) {
      try {
        void zipWritableRef.current.abort();
      } catch {
        // Ignored
      }
      zipWritableRef.current = null;
    }
    zipChunksRef.current = [];
    isZippingRef.current = false;
    setIsZipping(false);
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "CANCEL" });
    }
    if (zipResolverRef.current) {
      zipResolverRef.current.resolve({ success: false, totalBytes: 0, durationMs: 0 });
      zipResolverRef.current = null;
    }
  }, []);

  return {
    status,
    progress,
    error,
    warningsMap,
    generatedMap,
    errorsMap,
    initializeWorker,
    generateSingle,
    startBatch,
    pause,
    resume,
    cancel,
    reset,
    isZipping,
    zipProgress,
    startZipExport,
    cancelZipExport,
  };
}
