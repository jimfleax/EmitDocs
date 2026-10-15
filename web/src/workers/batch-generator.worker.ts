/**
 * @file batch-generator.worker.ts
 * @description Dedicated Web Worker for off-main-thread deterministic PDF batch generation (PRD-CORE-07).
 * @architecture Sequential generation loop yielding macrotask between items, zero-copy transferable buffers, zero persistent buffer retention in worker heap.
 */

import {
  BatchGeneratorHandler,
  type WorkerInboundMessage,
} from "./batch-generator.handler";

export * from "./batch-generator.handler";

// Interface fallback to compile clean under DOM lib without touching tsconfig
interface DedicatedWorkerGlobalScope {
  postMessage: (message: any, transfer?: Transferable[]) => void;
  onmessage: ((ev: MessageEvent) => any) | null;
}

if (typeof self !== "undefined") {
  const ctx: DedicatedWorkerGlobalScope = self as any;
  const handler = new BatchGeneratorHandler((msg, transfer) => {
    if (transfer && transfer.length > 0) {
      ctx.postMessage(msg, transfer);
    } else {
      ctx.postMessage(msg);
    }
  });

  ctx.onmessage = (event: MessageEvent<WorkerInboundMessage>) => {
    void handler.postMessage(event.data);
  };
}
