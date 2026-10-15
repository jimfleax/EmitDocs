/**
 * @file batch-generator.worker.ts
 * @description Dedicated Web Worker for off-main-thread deterministic PDF batch generation (PRD-CORE-07).
 * @architecture Sequential generation loop yielding macrotask between items, zero-copy transferable buffers, zero persistent buffer retention in worker heap.
 */

import {
  generatePdfWithOverlay,
  type FieldMappingConfig,
  type EngineWarning,
} from "../lib/pdf-engine/pdf-preview-engine";

// Interface fallback to compile clean under DOM lib without touching tsconfig
interface DedicatedWorkerGlobalScope {
  postMessage: (message: any, transfer?: Transferable[]) => void;
  onmessage: ((ev: MessageEvent) => any) | null;
}

const ctx: DedicatedWorkerGlobalScope = self as any;

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
      };
    }
  | {
      type: "START_BATCH";
      payload: {
        recipients: RecipientBatchItem[];
        startIndex?: number;
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
  | { type: "CANCELLED" }
  | {
      type: "ERROR";
      payload: {
        message: string;
        fatal: boolean;
        recipientKey?: string;
      };
    };

// Worker isolated state
let cachedBasePdfBytes: Uint8Array | null = null;
let cachedFieldMappings: FieldMappingConfig[] = [];
let isGenerating = false;
let isPaused = false;
let isCancelled = false;
let currentRecipients: RecipientBatchItem[] = [];
let currentIndex = 0;
let startTime = 0;
let totalWarnings = 0;

function toDataRecord(effectiveData: Record<string, any>): Record<string, string> {
  const result: Record<string, string> = {};
  if (effectiveData && typeof effectiveData === "object") {
    for (const [key, val] of Object.entries(effectiveData)) {
      result[key] = val !== null && val !== undefined ? String(val) : "";
    }
  }
  return result;
}

async function runBatchLoop(): Promise<void> {
  while (currentIndex < currentRecipients.length) {
    if (isCancelled) {
      isGenerating = false;
      currentRecipients = [];
      ctx.postMessage({ type: "CANCELLED" });
      return;
    }

    if (isPaused) {
      isGenerating = false;
      ctx.postMessage({
        type: "PAUSED",
        payload: {
          current: currentIndex,
          total: currentRecipients.length,
        },
      });
      return;
    }

    const item = currentRecipients[currentIndex];

    try {
      const stringData = toDataRecord(item.effectiveData);
      const { pdfBytes, warnings } = await generatePdfWithOverlay(
        cachedBasePdfBytes!,
        cachedFieldMappings,
        stringData,
        { drawDebugBoxes: false },
      );

      if (warnings.length > 0) {
        totalWarnings += warnings.length;
      }

      // Memory dereference: emit byteLength only; let pdfBytes garbage collect immediately
      ctx.postMessage({
        type: "RECIPIENT_GENERATED",
        payload: {
          recipientKey: item.recipientKey,
          sourceRowNumber: item.sourceRowNumber,
          warnings,
          byteLength: pdfBytes.byteLength,
        },
      });

      const current = currentIndex + 1;
      const total = currentRecipients.length;
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      const elapsedMs = Math.max(1, performance.now() - startTime);
      const itemsPerSec = current / (elapsedMs / 1000);
      const remainingItems = total - current;
      const etaSeconds =
        itemsPerSec > 0 ? Math.ceil(remainingItems / itemsPerSec) : 0;

      ctx.postMessage({
        type: "PROGRESS",
        payload: {
          current,
          total,
          percent,
          itemsPerSec: Number(itemsPerSec.toFixed(2)),
          activeRecipientKey: item.recipientKey,
          warningsCount: totalWarnings,
          elapsedMs: Math.round(elapsedMs),
          etaSeconds,
        },
      });

      currentIndex++;
      // Yield macrotask to allow inbound PAUSE/CANCEL message handling
      await new Promise((r) => setTimeout(r, 0));
    } catch (err: any) {
      // Fault isolation (AC7): row failure does not halt whole batch
      ctx.postMessage({
        type: "ERROR",
        payload: {
          message: err?.message || String(err),
          fatal: false,
          recipientKey: item.recipientKey,
        },
      });
      currentIndex++;
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  if (!isCancelled && !isPaused) {
    isGenerating = false;
    const durationMs = Math.round(performance.now() - startTime);
    ctx.postMessage({
      type: "BATCH_COMPLETE",
      payload: {
        totalGenerated: currentRecipients.length,
        totalWarnings,
        durationMs,
      },
    });
  }
}

ctx.onmessage = async (event: MessageEvent<WorkerInboundMessage>) => {
  const msg = event.data;
  if (!msg || typeof msg !== "object") return;

  switch (msg.type) {
    case "INIT": {
      cachedBasePdfBytes = new Uint8Array(msg.payload.basePdfBytes);
      cachedFieldMappings = msg.payload.fieldMappings || [];
      ctx.postMessage({ type: "INIT_READY" });
      break;
    }

    case "GENERATE_SINGLE": {
      if (!cachedBasePdfBytes) {
        ctx.postMessage({
          type: "ERROR",
          payload: {
            message: "Worker not initialized with base template",
            fatal: false,
            recipientKey: msg.payload.recipient.recipientKey,
          },
        });
        return;
      }

      const start = performance.now();
      const item = msg.payload.recipient;

      try {
        const stringData = toDataRecord(item.effectiveData);
        const { pdfBytes, warnings } = await generatePdfWithOverlay(
          cachedBasePdfBytes,
          cachedFieldMappings,
          stringData,
          { drawDebugBoxes: false },
        );
        const durationMs = performance.now() - start;

        // Zero-copy transfer single buffer
        ctx.postMessage(
          {
            type: "SINGLE_COMPLETE",
            payload: {
              recipientKey: item.recipientKey,
              pdfBytes,
              warnings,
              durationMs,
            },
          },
          [pdfBytes.buffer as ArrayBuffer],
        );
      } catch (err: any) {
        ctx.postMessage({
          type: "ERROR",
          payload: {
            message: err?.message || String(err),
            fatal: false,
            recipientKey: item.recipientKey,
          },
        });
      }
      break;
    }

    case "START_BATCH": {
      if (!cachedBasePdfBytes) {
        ctx.postMessage({
          type: "ERROR",
          payload: {
            message: "Worker not initialized with base template",
            fatal: true,
          },
        });
        return;
      }

      currentRecipients = msg.payload.recipients || [];
      currentIndex = msg.payload.startIndex ?? 0;
      isGenerating = true;
      isPaused = false;
      isCancelled = false;
      totalWarnings = 0;
      startTime = performance.now();

      void runBatchLoop();
      break;
    }

    case "PAUSE": {
      if (isGenerating && !isPaused) {
        isPaused = true;
      }
      break;
    }

    case "RESUME": {
      if (isPaused) {
        isPaused = false;
        isGenerating = true;
        ctx.postMessage({
          type: "RESUMED",
          payload: { startIndex: currentIndex },
        });
        void runBatchLoop();
      }
      break;
    }

    case "CANCEL": {
      isCancelled = true;
      if (!isGenerating) {
        currentRecipients = [];
        ctx.postMessage({ type: "CANCELLED" });
      }
      break;
    }
  }
};
