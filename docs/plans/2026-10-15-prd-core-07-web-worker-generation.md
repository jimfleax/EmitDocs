# PRD-CORE-07: On-Demand Web Worker PDF Generation & Single Recipient Delivery Plan

**Feature:** On-Demand Web Worker PDF Generation and Single Recipient Delivery  
**Target Milestone:** PRD-CORE-07 (Core MVP · P0)  
**Parent Document:** `docs/bulk-document-issuance-prd-pack-v1.0/PRD-CORE-07-RESUMABLE-PDF-GENERATION.md`  
**Related Plans:** `docs/plans/2026-10-15-on-demand-generation-streaming-zip.md` (PRD-CORE-08 streaming ZIP)  

---

## 1. Executive Summary & Design Principles

### 1.1 Objective
PRD-CORE-07 establishes client-side, on-demand deterministic PDF generation directly from frozen MongoDB records (`ApprovedSnapshot`, `ApprovedRecipient`) using an off-main-thread Web Worker. It eliminates individual PDF cloud storage (Cloudinary/R2), delivers instant (<20ms) single-recipient preview and download, and maintains non-blocking 60fps UI responsiveness during bulk generation.

### 1.2 Core Architectural Invariants
1. **Zero Recipient Cloud Storage**: Recipient PDFs are never stored in Cloudinary or R2. Only base template PDFs are stored. Recipient PDFs exist purely on-the-go in browser client memory.
2. **Non-Locking Batch Lifecycle**: The batch remains in `approved` status in MongoDB throughout generation. Pausing, resuming, reloading, or cancelling does not alter the batch state in MongoDB.
3. **Strict Determinism**: Re-generating any recipient from identical base template bytes, field mappings, and effective data produces identical SHA-256 byte output at any time $t$.
4. **Fault Isolation**: Glyph validation errors or text overflows on individual recipient rows emit non-blocking warnings and never abort ongoing batch generation.
5. **Memory Bounded Execution**: The Web Worker dereferences generated documents immediately after completion, keeping client RAM flat (<150MB) even across thousands of rows.

---

## 2. Architecture Breakdown

```
[Main Thread UI]
  │
  ├── ResultsWorkspace.tsx
  │     │── Data Fetching:
  │     │     GET /api/batches/:id/snapshot
  │     │     GET /api/templates/:id/versions/:v/file
  │     │     GET /api/batches/:id/snapshot/recipients
  │     │
  │     ├── GenerationProgressCard.tsx (Live stats, speed, ETA, progress bar)
  │     ├── GenerationControls.tsx (Start, Pause, Resume, Cancel)
  │     ├── RecipientStatusTable.tsx (Paginated list, status badges)
  │     │     └── SingleRecipientAction.tsx (Instant Preview <20ms, Direct Download)
  │     └── SinglePdfPreviewModal.tsx (Rendered canvas preview + diagnostics)
  │
  └── useBatchGeneratorWorker.ts (Hook & state machine)
        │ PostMessage API
        ▼
[Web Worker: batch-generator.worker.ts]
  ├── Cached Base PDF ArrayBuffer
  ├── FieldMappingConfig[]
  ├── Execution Loop: Sequential generatePdfWithOverlay()
  └── Emits: PROGRESS, SINGLE_COMPLETE, PAUSED, CANCELLED, BATCH_COMPLETE
```

### 2.1 Web Worker: `web/src/workers/batch-generator.worker.ts`
Runs completely isolated from the main thread. Responsible for caching base template assets and executing `generatePdfWithOverlay` in a controllable, resumable loop.

#### 2.1.1 Typed Message Protocol
```typescript
// Inbound Messages (Main Thread -> Worker)
export type WorkerInboundMessage =
  | {
      type: 'INIT';
      payload: {
        basePdfBytes: ArrayBuffer;
        fieldMappings: FieldMappingConfig[];
        customFontBytes?: ArrayBuffer;
      };
    }
  | {
      type: 'GENERATE_SINGLE';
      payload: {
        recipient: {
          recipientKey: string;
          effectiveData: Record<string, any>;
        };
      };
    }
  | {
      type: 'START_BATCH';
      payload: {
        recipients: Array<{
          recipientKey: string;
          sourceRowNumber: number;
          effectiveData: Record<string, any>;
        }>;
        startIndex?: number;
      };
    }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'CANCEL' };

// Outbound Messages (Worker -> Main Thread)
export type WorkerOutboundMessage =
  | { type: 'INIT_READY' }
  | {
      type: 'SINGLE_COMPLETE';
      payload: {
        recipientKey: string;
        pdfBytes: Uint8Array;
        warnings: EngineWarning[];
        durationMs: number;
      };
    }
  | {
      type: 'PROGRESS';
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
      type: 'RECIPIENT_GENERATED';
      payload: {
        recipientKey: string;
        sourceRowNumber: number;
        warnings: EngineWarning[];
        byteLength: number;
      };
    }
  | {
      type: 'PAUSED';
      payload: {
        current: number;
        total: number;
      };
    }
  | {
      type: 'RESUMED';
      payload: {
        startIndex: number;
      };
    }
  | {
      type: 'BATCH_COMPLETE';
      payload: {
        totalGenerated: number;
        totalWarnings: number;
        durationMs: number;
      };
    }
  | { type: 'CANCELLED' }
  | {
      type: 'ERROR';
      payload: {
        message: string;
        fatal: boolean;
        recipientKey?: string;
      };
    };
```

#### 2.1.2 Internal Worker State & Loop Mechanics
- **Cached Assets:**
  - `cachedBasePdfBytes: Uint8Array | null`
  - `fieldMappings: FieldMappingConfig[]`
- **Execution Flags:**
  - `isGenerating: boolean`
  - `isPaused: boolean`
  - `isCancelled: boolean`
  - `currentIndex: number`
  - `recipientsQueue: RecipientItem[]`
  - `startTime: number`
  - `warningsCount: number`
- **Yielding & Non-blocking Check:**
  - After processing each recipient, the worker executes `await new Promise((r) => setTimeout(r, 0))` or a microtask turn. This allows the worker's event loop to consume incoming `PAUSE` or `CANCEL` events cleanly between recipient boundaries.
  - Intermediate output buffers are immediately dereferenced, allowing the garbage collector to reclaim heap memory.

---

### 2.2 Client Hook & State Machine: `web/src/hooks/useBatchGeneratorWorker.ts`
Encapsulates worker creation, message listeners, lifecycle cleanup, and reactive status.

#### 2.2.1 State Representation
```typescript
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
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'generating'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'error';

export interface UseBatchGeneratorWorkerReturn {
  status: WorkerStatus;
  progress: GenerationProgress;
  error: string | null;
  warningsMap: Record<string, EngineWarning[]>;
  generatedMap: Record<string, { byteLength: number; generatedAt: number }>;
  initializeWorker: (basePdfBytes: ArrayBuffer, fieldMappings: FieldMappingConfig[]) => Promise<void>;
  generateSingle: (recipient: { recipientKey: string; effectiveData: Record<string, any> }) => Promise<{
    pdfBytes: Uint8Array;
    warnings: EngineWarning[];
  }>;
  startBatch: (recipients: Array<{ recipientKey: string; sourceRowNumber: number; effectiveData: Record<string, any> }>, startIndex?: number) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  reset: () => void;
}
```

#### 2.2.2 Key Methods & Logic
- **Worker Instantiation:**
  Uses Vite's standard module worker constructor:
  `new Worker(new URL('../workers/batch-generator.worker.ts', import.meta.url), { type: 'module' })`.
- **Single Generation Handshake:**
  Uses pending promise lookup `pendingSingleResolvers.set(recipientKey, { resolve, reject })`.
- **Cleanup on Unmount:**
  Terminates active worker and revokes any cached object URLs.

---

### 2.3 UI Routes & Components

#### 2.3.1 Route: `web/src/routes/_protected/app/batches/$batchId_.results.tsx`
- Registered with TanStack Router under `/_protected/app/batches/$batchId_/results`.
- Extracts `batchId` route parameter.
- Renders `ResultsWorkspace`.

#### 2.3.2 Workspace & Subcomponents (`web/src/components/batches/results/`)
1. **`ResultsWorkspace.tsx`**:
   - Master orchestrator component for the generation stage.
   - Fetches snapshot (`GET /api/batches/:id/snapshot`), template version metadata (`GET /api/templates/:id/versions/:v`), template base PDF stream (`GET /api/templates/:id/versions/:v/file`), and initial page of recipients (`GET /api/batches/:id/snapshot/recipients`).
   - Automatically initializes worker once base template binary and mappings are fetched.
   - Displays header banner: Batch Name, Snapshot ID, Total Recipients, Expiration Countdown, and Canonical SHA-256 Digest badge.
   - Integrates `GenerationProgressCard`, `GenerationControls`, and `RecipientStatusTable`.
2. **`GenerationProgressCard.tsx`**:
   - Visual progress card with dynamic fill bar (`transition-all duration-300`).
   - Metrics tiles:
     - Processed count: `{current} / {total}` ({percent}%)
     - Throughput: `{itemsPerSec.toFixed(1)} docs/sec`
     - ETA: `{etaSeconds}s remaining`
     - Warnings: `{warningsCount} flagged`
3. **`GenerationControls.tsx`**:
   - Action buttons with state machine guardrails:
     - **Start Generation**: Active when `status === 'ready'` or `'completed'`.
     - **Pause**: Active when `status === 'generating'`.
     - **Resume**: Active when `status === 'paused'`.
     - **Cancel**: Active when `status === 'generating' || status === 'paused'`.
4. **`RecipientStatusTable.tsx`**:
   - Paginated, searchable listing of all approved recipients.
   - Columns: Row `#`, Recipient Key, Effective Data summary, Generation Status (Pending / Ready / Warned), and Actions.
   - Includes real-time search filter by recipient key or name value.
5. **`SinglePdfPreviewModal.tsx`**:
   - Modal dialog rendered when user clicks "Preview" on a recipient row.
   - Embeds high-fidelity PDF renderer (via blob URL object / canvas).
   - Displays recipient key, diagnostic warnings (glyph fallback, overflow pixels), and "Download PDF" action.
6. **`SingleRecipientAction.tsx`**:
   - Compact button group for table rows:
     - **Preview** (Eye icon): Executes `generateSingle` (<20ms) and opens `SinglePdfPreviewModal`.
     - **Download** (Download icon): Executes `generateSingle`, creates a Blob object URL, and triggers an instant native browser download (`[Name]_[recipientKey].pdf`).

#### 2.3.3 Approval Flow Integration (`ApprovalWorkspace.tsx`)
- Update `ApprovalWorkspace.tsx`:
  - When snapshot has been frozen or batch is already approved, change primary action from `"View Batches Dashboard"` to `"Proceed to Results & Generation"`, navigating directly to `/app/batches/${batchId}/results`.

---

## 3. TDD Acceptance Matrix Test Suite (`test/core-07-acceptance-matrix.test.ts`)

The test suite validates criteria **AC1 through AC8** against both database integrity and engine performance.

| Criterion | Target Behavior | Verification Mechanism |
|---|---|---|
| **AC1** | Single recipient PDF render & download <20ms | Benchmark `generatePdfWithOverlay` with realistic base PDF and 6-field layout. Assert execution time < 20ms and verify output has valid `%PDF-1.` header. |
| **AC2** | Web Worker off-main-thread execution & responsive UI | Verify worker message protocol handles INIT, GENERATE_SINGLE, and START_BATCH asynchronously without blocking node/browser event loop. |
| **AC3** | Accurate real-time progress metrics | Simulate batch run of 10 recipients. Collect `PROGRESS` messages. Assert monotonic `current` counter, `percent` calculation, positive `itemsPerSec`, and calculated `etaSeconds`. |
| **AC4** | Clean pause at boundary & seamless resume | Issue `PAUSE` at recipient index 3. Verify worker finishes item 3 and halts with `PAUSED { current: 3 }`. Verify no further items generated while paused. Send `RESUME`, verify generation picks up from index 4 to 10 without restarting from 0. |
| **AC5** | Immediate cancellation & memory release | Send `CANCEL` at recipient index 2. Verify worker transitions to `CANCELLED`, ceases processing immediately, and drains internal queues. |
| **AC6** | Batch remains in approved status across reload/return | Check MongoDB `Batch.status` and `ApprovedSnapshot.status`. Verify batch remains `'approved'` and snapshot remains `'ready'` throughout and after generation cycles (no locking state). |
| **AC7** | Recipient overflow/glyph warning isolation | Provide recipient data with >100 character overflow and non-WinAnsi emojis/Cyrillic characters. Verify warnings emitted (`overflow`, `unsupported_glyph`) without failing or aborting subsequent recipient generations. |
| **AC8** | Deterministic byte output parity (SHA-256) | Run two independent generations for the same recipient with identical base bytes and field mappings. Calculate `crypto.createHash('sha256')` of output byte arrays. Assert exact 100% hash match. |

---

## 4. Implementation Phases & Test Gates

### Phase 1: Web Worker Engine & Message Protocol
- **Target Files:**
  - `web/src/workers/batch-generator.worker.ts`
- **Tasks:**
  1. Implement typed inbound/outbound message handlers (`INIT`, `GENERATE_SINGLE`, `START_BATCH`, `PAUSE`, `RESUME`, `CANCEL`).
  2. Implement sequential processing loop with asynchronous microtask yielding between recipients.
  3. Wire in `generatePdfWithOverlay` with font and base template caching.
  4. Ensure immediate buffer dereference for memory cleanliness.
- **Verification Gate:**
  - TypeScript build succeeds: `pnpm --filter emitdocs-web exec tsc --noEmit`.

---

### Phase 2: Web Worker Client Hook & State Machine
- **Target Files:**
  - `web/src/hooks/useBatchGeneratorWorker.ts`
- **Tasks:**
  1. Implement worker instantiation, termination, and message event listeners.
  2. Track reactive states: `status`, `progress`, `warningsMap`, `generatedMap`.
  3. Expose asynchronous `initializeWorker`, `generateSingle`, `startBatch`, `pause`, `resume`, `cancel`, `reset`.
  4. Support fallback / test harness execution for headless/Node environments.
- **Verification Gate:**
  - Unit verification of hook state transitions and message handling.

---

### Phase 3: Single Recipient Actions & Fast Preview Modal
- **Target Files:**
  - `web/src/components/batches/results/SingleRecipientAction.tsx`
  - `web/src/components/batches/results/SinglePdfPreviewModal.tsx`
- **Tasks:**
  1. Build `SingleRecipientAction` with "Preview" and "Download" buttons and loading spinners.
  2. Implement direct browser file download trigger (`URL.createObjectURL(blob)`).
  3. Build `SinglePdfPreviewModal` showing PDF view, recipient metadata, and warning badges.
- **Verification Gate:**
  - Verify render and click handlers trigger on-demand generation in <20ms.

---

### Phase 4: Results Workspace, Route & Approval Transition
- **Target Files:**
  - `web/src/components/batches/results/GenerationProgressCard.tsx`
  - `web/src/components/batches/results/GenerationControls.tsx`
  - `web/src/components/batches/results/RecipientStatusTable.tsx`
  - `web/src/components/batches/results/ResultsWorkspace.tsx`
  - `web/src/routes/_protected/app/batches/$batchId_.results.tsx`
  - `web/src/components/batches/approval/ApprovalWorkspace.tsx`
- **Tasks:**
  1. Build `GenerationProgressCard` with animated progress bar, throughput metrics, and ETA counter.
  2. Build `GenerationControls` with Pause/Resume/Cancel state guards.
  3. Build `RecipientStatusTable` with pagination, search, and recipient row actions.
  4. Assemble `ResultsWorkspace` integrating data fetching and worker state.
  5. Mount route `/_protected/app/batches/$batchId_/results`.
  6. Update `ApprovalWorkspace` to link approved batches to `/app/batches/${batchId}/results`.
- **Verification Gate:**
  - Full frontend type-check and Vite build: `pnpm run build:web`.

---

### Phase 5: Acceptance Matrix Test Suite & E2E Validation
- **Target Files:**
  - `test/core-07-acceptance-matrix.test.ts`
  - `package.json` (add `"test:core07"` script)
- **Tasks:**
  1. Implement AC1-AC8 end-to-end acceptance tests.
  2. Verify execution time (<20ms), progress monotonicity, pause/resume continuity, cancellation cleanup, non-locking DB status, warning isolation, and SHA-256 byte determinism.
- **Verification Gate:**
  - `pnpm run test:core07` passes 8/8 test criteria cleanly.
  - Overall test suite `pnpm run test` passes without regression.

---

## 5. File Manifest Summary

| File Path | Action | Description |
|---|---|---|
| `web/src/workers/batch-generator.worker.ts` | **Create** | Dedicated Web Worker for off-main-thread PDF generation. |
| `web/src/hooks/useBatchGeneratorWorker.ts` | **Create** | React state machine hook managing worker lifecycle and progress. |
| `web/src/components/batches/results/SingleRecipientAction.tsx` | **Create** | Table row actions: <20ms Instant Preview and Direct Download. |
| `web/src/components/batches/results/SinglePdfPreviewModal.tsx` | **Create** | High-fidelity preview modal with diagnostics and download button. |
| `web/src/components/batches/results/GenerationProgressCard.tsx` | **Create** | Visual progress bar, throughput meter, and ETA countdown. |
| `web/src/components/batches/results/GenerationControls.tsx` | **Create** | Start, Pause, Resume, and Cancel button controls. |
| `web/src/components/batches/results/RecipientStatusTable.tsx` | **Create** | Paginated recipient list with search and warning indicators. |
| `web/src/components/batches/results/ResultsWorkspace.tsx` | **Create** | Master container for `/app/batches/:id/results`. |
| `web/src/routes/_protected/app/batches/$batchId_.results.tsx` | **Create** | TanStack route definition for results view. |
| `web/src/components/batches/approval/ApprovalWorkspace.tsx` | **Modify** | Route approved batches to `/app/batches/:batchId/results`. |
| `test/core-07-acceptance-matrix.test.ts` | **Create** | Complete TDD Acceptance Matrix test suite (AC1–AC8). |
| `package.json` | **Modify** | Add `"test:core07"` script to project runner. |
