/**
 * @file batch-generator.handler.ts
 * @description Core message handler and state machine for deterministic PDF batch generation (PRD-CORE-07).
 * @architecture Shared execution logic used by both the Web Worker and Node.js acceptance tests.
 */

import {
  generatePdfWithOverlay,
  type FieldMappingConfig,
  type EngineWarning,
} from "../lib/pdf-engine/pdf-preview-engine";
import { sanitizeRecipientFilename } from "../lib/pdf-engine/filename-sanitizer";
import { createStreamingZip } from "../lib/pdf-engine/streaming-zip";

export interface RecipientBatchItem {
  recipientKey: string;
  sourceRowNumber: number;
  effectiveData: Record<string, any>;
}

export interface SingleRecipientItem {
  recipientKey: string;
  effectiveData: Record<string, any>;
}

export type WorkerInboundMessage =
  | {
      type: "INIT";
      payload: {
        basePdfBytes: ArrayBuffer;
        fieldMappings: FieldMappingConfig[];
        customFontBytes?: ArrayBuffer;
      };
    }
  | {
      type: "GENERATE_SINGLE";
      payload: {
        recipient: SingleRecipientItem;
        requestId?: string;
      };
    }
  | {
      type: "START_BATCH";
      payload: {
        recipients: RecipientBatchItem[];
        startIndex?: number;
      };
    }
  | {
      type: "START_ZIP_BATCH";
      payload: {
        recipients: RecipientBatchItem[];
        volumeIndex: number;
        totalVolumes: number;
        zipFilename: string;
      };
    }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "CANCEL" };

export type WorkerOutboundMessage =
  | { type: "INIT_READY" }
  | {
      type: "SINGLE_COMPLETE";
      payload: {
        recipientKey: string;
        pdfBytes: Uint8Array;
        warnings: EngineWarning[];
        durationMs: number;
        requestId?: string;
      };
    }
  | {
      type: "PROGRESS";
      payload: {
        current: number;
        total: number;
        percent: number;
        itemsPerSec: number;
        activeRecipientKey: string;
        warningsCount: number;
        elapsedMs: number;
        etaSeconds: number;
      };
    }
  | {
      type: "RECIPIENT_GENERATED";
      payload: {
        recipientKey: string;
        sourceRowNumber: number;
        warnings: EngineWarning[];
        byteLength: number;
      };
    }
  | {
      type: "PAUSED";
      payload: {
        current: number;
        total: number;
      };
    }
  | {
      type: "RESUMED";
      payload: {
        startIndex: number;
      };
    }
  | {
      type: "BATCH_COMPLETE";
      payload: {
        totalGenerated: number;
        totalWarnings: number;
        durationMs: number;
      };
    }
  | {
      type: "ZIP_PROGRESS";
      payload: {
        current: number;
        total: number;
        percent: number;
        itemsPerSec: number;
        elapsedMs: number;
        etaSeconds: number;
        activeRecipientKey: string;
        activeDocName: string;
        bytesEmitted: number;
        volumeIndex: number;
      };
    }
  | {
      type: "ZIP_CHUNK";
      payload: {
        chunk: Uint8Array;
        bytesTotal: number;
        volumeIndex: number;
      };
    }
  | {
      type: "ZIP_COMPLETE";
      payload: {
        volumeIndex: number;
        totalDocuments: number;
        totalBytes: number;
        durationMs: number;
        zipFilename: string;
      };
    }
  | { type: "CANCELLED" }
  | {
      type: "ERROR";
      payload: {
        message: string;
        fatal: boolean;
        recipientKey?: string;
        requestId?: string;
      };
    };

export function toDataRecord(effectiveData: Record<string, any>): Record<string, string> {
  const result: Record<string, string> = {};
  if (effectiveData && typeof effectiveData === "object") {
    for (const [key, val] of Object.entries(effectiveData)) {
      result[key] = val !== null && val !== undefined ? String(val) : "";
    }
  }
  return result;
}

export class BatchGeneratorHandler {
  private cachedBasePdfBytes: Uint8Array | null = null;
  private cachedFieldMappings: FieldMappingConfig[] = [];
  private isGenerating = false;
  private isPaused = false;
  private isCancelled = false;
  private currentRecipients: RecipientBatchItem[] = [];
  private currentIndex = 0;
  private startTime = 0;
  private totalWarnings = 0;
  private pauseStartTime = 0;
  private totalPausedDurationMs = 0;
  private failedCount = 0;

  public onmessage: ((msg: WorkerOutboundMessage) => void) | null = null;

  private postMessageFn?: (
    message: WorkerOutboundMessage,
    transfer?: Transferable[]
  ) => void;

  constructor(
    postMessageFn?: (
      message: WorkerOutboundMessage,
      transfer?: Transferable[]
    ) => void
  ) {
    this.postMessageFn = postMessageFn;
  }

  public emit(msg: WorkerOutboundMessage, transfer?: Transferable[]): void {
    if (this.postMessageFn) {
      this.postMessageFn(msg, transfer);
    }
    if (this.onmessage) {
      this.onmessage(msg);
    }
  }

  public getQueueLength(): number {
    return Math.max(0, this.currentRecipients.length - this.currentIndex);
  }

  public isCancelState(): boolean {
    return this.isCancelled;
  }

  public isPauseState(): boolean {
    return this.isPaused;
  }

  public isGeneratingState(): boolean {
    return this.isGenerating;
  }

  public async postMessage(msg: WorkerInboundMessage): Promise<void> {
    if (!msg || typeof msg !== "object") return;

    switch (msg.type) {
      case "INIT": {
        this.cachedBasePdfBytes = new Uint8Array(msg.payload.basePdfBytes);
        this.cachedFieldMappings = msg.payload.fieldMappings || [];
        this.emit({ type: "INIT_READY" });
        break;
      }

      case "GENERATE_SINGLE": {
        const { recipient: item, requestId } = msg.payload;
        if (!this.cachedBasePdfBytes) {
          this.emit({
            type: "ERROR",
            payload: {
              message: "Worker not initialized with base template",
              fatal: false,
              recipientKey: item.recipientKey,
              requestId,
            },
          });
          return;
        }

        const start = performance.now();

        try {
          const stringData = toDataRecord(item.effectiveData);
          const { pdfBytes, warnings } = await generatePdfWithOverlay(
            this.cachedBasePdfBytes,
            this.cachedFieldMappings,
            stringData,
            { drawDebugBoxes: false }
          );
          const durationMs = performance.now() - start;

          this.emit(
            {
              type: "SINGLE_COMPLETE",
              payload: {
                recipientKey: item.recipientKey,
                pdfBytes,
                warnings,
                durationMs,
                requestId,
              },
            },
            [pdfBytes.buffer as ArrayBuffer]
          );
        } catch (err: any) {
          this.emit({
            type: "ERROR",
            payload: {
              message: err?.message || String(err),
              fatal: false,
              recipientKey: item.recipientKey,
              requestId,
            },
          });
        }
        break;
      }

      case "START_BATCH": {
        if (!this.cachedBasePdfBytes) {
          this.emit({
            type: "ERROR",
            payload: {
              message: "Worker not initialized with base template",
              fatal: true,
            },
          });
          return;
        }

        this.currentRecipients = msg.payload.recipients || [];
        this.currentIndex = msg.payload.startIndex ?? 0;
        this.isGenerating = true;
        this.isPaused = false;
        this.isCancelled = false;
        this.totalWarnings = 0;
        this.pauseStartTime = 0;
        this.totalPausedDurationMs = 0;
        this.failedCount = 0;
        this.startTime = performance.now();

        void this.runBatchLoop();
        break;
      }

      case "START_ZIP_BATCH": {
        if (!this.cachedBasePdfBytes) {
          this.emit({
            type: "ERROR",
            payload: {
              message: "Worker not initialized with base template",
              fatal: true,
            },
          });
          return;
        }

        const { recipients, volumeIndex, totalVolumes, zipFilename } = msg.payload;
        this.isGenerating = true;
        this.isCancelled = false;
        this.isPaused = false;
        this.failedCount = 0;

        void this.runZipExport(recipients, volumeIndex, totalVolumes, zipFilename);
        break;
      }

      case "PAUSE": {
        if (this.isGenerating && !this.isPaused) {
          this.isPaused = true;
        }
        break;
      }

      case "RESUME": {
        if (this.isPaused) {
          if (this.pauseStartTime > 0) {
            this.totalPausedDurationMs += performance.now() - this.pauseStartTime;
            this.pauseStartTime = 0;
          }
          this.isPaused = false;
          this.isGenerating = true;
          this.emit({
            type: "RESUMED",
            payload: { startIndex: this.currentIndex },
          });
          void this.runBatchLoop();
        }
        break;
      }

      case "CANCEL": {
        this.isCancelled = true;
        this.pauseStartTime = 0;
        if (!this.isGenerating) {
          this.currentRecipients = [];
          this.emit({ type: "CANCELLED" });
        }
        break;
      }
    }
  }

  private async runBatchLoop(): Promise<void> {
    while (this.currentIndex < this.currentRecipients.length) {
      if (this.isCancelled) {
        this.isGenerating = false;
        this.currentRecipients = [];
        this.emit({ type: "CANCELLED" });
        return;
      }

      if (this.isPaused) {
        this.isGenerating = false;
        this.pauseStartTime = performance.now();
        this.emit({
          type: "PAUSED",
          payload: {
            current: this.currentIndex,
            total: this.currentRecipients.length,
          },
        });
        return;
      }

      const item = this.currentRecipients[this.currentIndex];

      try {
        const stringData = toDataRecord(item.effectiveData);
        const { pdfBytes, warnings } = await generatePdfWithOverlay(
          this.cachedBasePdfBytes!,
          this.cachedFieldMappings,
          stringData,
          { drawDebugBoxes: false }
        );

        if (warnings.length > 0) {
          this.totalWarnings += warnings.length;
        }

        // Memory dereference: emit byteLength only; let pdfBytes garbage collect immediately
        this.emit({
          type: "RECIPIENT_GENERATED",
          payload: {
            recipientKey: item.recipientKey,
            sourceRowNumber: item.sourceRowNumber,
            warnings,
            byteLength: pdfBytes.byteLength,
          },
        });

        const current = this.currentIndex + 1;
        const total = this.currentRecipients.length;
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        const elapsedMs = Math.max(
          1,
          performance.now() - this.startTime - this.totalPausedDurationMs
        );
        const itemsPerSec = current / (elapsedMs / 1000);
        const remainingItems = total - current;
        const etaSeconds =
          itemsPerSec > 0 ? Math.ceil(remainingItems / itemsPerSec) : 0;

        this.emit({
          type: "PROGRESS",
          payload: {
            current,
            total,
            percent,
            itemsPerSec: Number(itemsPerSec.toFixed(2)),
            activeRecipientKey: item.recipientKey,
            warningsCount: this.totalWarnings,
            elapsedMs: Math.round(elapsedMs),
            etaSeconds,
          },
        });

        this.currentIndex++;
        // Yield macrotask to allow inbound PAUSE/CANCEL message handling
        await new Promise((r) => setTimeout(r, 0));
      } catch (err: any) {
        // Fault isolation (AC7): row failure does not halt whole batch
        this.failedCount++;
        this.emit({
          type: "ERROR",
          payload: {
            message: err?.message || String(err),
            fatal: false,
            recipientKey: item.recipientKey,
          },
        });

        const current = this.currentIndex + 1;
        const total = this.currentRecipients.length;
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        const elapsedMs = Math.max(
          1,
          performance.now() - this.startTime - this.totalPausedDurationMs
        );
        const itemsPerSec = current / (elapsedMs / 1000);
        const remainingItems = total - current;
        const etaSeconds =
          itemsPerSec > 0 ? Math.ceil(remainingItems / itemsPerSec) : 0;

        this.emit({
          type: "PROGRESS",
          payload: {
            current,
            total,
            percent,
            itemsPerSec: Number(itemsPerSec.toFixed(2)),
            activeRecipientKey: item.recipientKey,
            warningsCount: this.totalWarnings,
            elapsedMs: Math.round(elapsedMs),
            etaSeconds,
          },
        });

        this.currentIndex++;
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    this.isGenerating = false;

    if (this.isCancelled) {
      this.currentRecipients = [];
      this.emit({ type: "CANCELLED" });
      return;
    }

    if (this.isPaused) {
      this.isPaused = false;
    }

    const durationMs = Math.round(
      performance.now() - this.startTime - this.totalPausedDurationMs
    );
    this.emit({
      type: "BATCH_COMPLETE",
      payload: {
        totalGenerated: Math.max(
          0,
          this.currentRecipients.length - this.failedCount
        ),
        totalWarnings: this.totalWarnings,
        durationMs,
      },
    });
  }

  private async runZipExport(
    recipients: RecipientBatchItem[],
    volumeIndex: number,
    _totalVolumes: number,
    zipFilename: string
  ): Promise<void> {
    const total = recipients.length;
    const startTime = performance.now();
    let current = 0;
    let totalBytesEmitted = 0;
    const baseBytes = this.cachedBasePdfBytes!;
    const fieldMappings = this.cachedFieldMappings;

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    async function* generateZipEntries() {
      for (let i = 0; i < total; i++) {
        if (self.isCancelled) {
          break;
        }

        const item = recipients[i];
        let pdfBytes: Uint8Array;
        try {
          const stringData = toDataRecord(item.effectiveData);
          const res = await generatePdfWithOverlay(baseBytes, fieldMappings, stringData, {
            drawDebugBoxes: false,
          });
          pdfBytes = res.pdfBytes;
        } catch {
          self.failedCount++;
          continue;
        }

        current++;
        const filename = sanitizeRecipientFilename(item.effectiveData, item.recipientKey);
        const elapsedMs = Math.max(1, performance.now() - startTime);
        const itemsPerSec = Math.round((current / (elapsedMs / 1000)) * 10) / 10;
        const remainingItems = total - current;
        const etaSeconds = itemsPerSec > 0 ? Math.ceil(remainingItems / itemsPerSec) : 0;
        const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

        self.emit({
          type: "ZIP_PROGRESS",
          payload: {
            current,
            total,
            percent,
            itemsPerSec,
            elapsedMs: Math.round(elapsedMs),
            etaSeconds,
            activeRecipientKey: item.recipientKey,
            activeDocName: filename,
            bytesEmitted: totalBytesEmitted,
            volumeIndex,
          },
        });

        // Yield macrotask to allow cancel/pause messages
        await new Promise<void>((resolve) => setTimeout(resolve, 0));

        yield {
          name: filename,
          input: pdfBytes,
          lastModified: new Date(0), // Deterministic timestamp
        };
      }
    }

    try {
      const zipStream = createStreamingZip(generateZipEntries());
      const reader = zipStream.getReader();

      while (true) {
        if (this.isCancelled) {
          await reader.cancel();
          this.isGenerating = false;
          this.emit({ type: "CANCELLED" });
          return;
        }

        const { done, value } = await reader.read();
        if (done) break;

        if (value && value.length > 0) {
          totalBytesEmitted += value.length;
          this.emit(
            {
              type: "ZIP_CHUNK",
              payload: {
                chunk: value,
                bytesTotal: totalBytesEmitted,
                volumeIndex,
              },
            },
            [value.buffer as ArrayBuffer]
          );
        }
      }

      if (this.isCancelled) {
        this.isGenerating = false;
        this.emit({ type: "CANCELLED" });
        return;
      }

      const durationMs = Math.round(performance.now() - startTime);
      this.isGenerating = false;
      this.emit({
        type: "ZIP_COMPLETE",
        payload: {
          volumeIndex,
          totalDocuments: current,
          totalBytes: totalBytesEmitted,
          durationMs,
          zipFilename,
        },
      });
    } catch (err: any) {
      this.isGenerating = false;
      this.emit({
        type: "ERROR",
        payload: {
          message: err?.message || String(err),
          fatal: true,
        },
      });
    }
  }
}
