# Batch Status Lifecycle & Smart Navigation Implementation Plan

**Goal:** Ensure that clicking a batch in any view (Batches catalog, Dashboard, Template Details) navigates directly to the appropriate workflow step based on the batch's current lifecycle status, especially routing approved/ready batches to the Results & Preview/Download page (`/app/batches/:batchId/results`) rather than Review (`/app/batches/:batchId/review`).

**Architecture:** Create a centralized batch navigation utility (`web/src/lib/batch-navigation.ts`) containing pure mapping functions for destination routes, action labels, and status badges across all 11 `BatchStatus` lifecycle states. Wire this utility into `BatchList.tsx`, `index.tsx` (Dashboard), `TemplateDetails.tsx` (new template batches list), and add an approved-state banner in `DraftReviewWorkspace.tsx`.

**Tech Stack:** React 19, TypeScript, TanStack Router, Phosphor Icons, Tailwind CSS, Node.js `node:assert`.

---

## 1. Batch State to Route Mapping Matrix

| State | Lifecycle Stage | Destination Route | Action Label | Badge Label & Variant |
| :--- | :--- | :--- | :--- | :--- |
| **`draft`** | Inception / Pre-upload | `/app/batches/$batchId/import` | "Continue Import" | Draft (`neutral`) |
| **`importing`** | Ingestion in progress | `/app/batches/$batchId/import` | "Continue Import" | Importing (`warning`) |
| **`review`** | Draft rows review / edit | `/app/batches/$batchId/review` | "Review Data" | In Review (`primary`) |
| **`awaiting_approval`** | Review done, preflight ready | `/app/batches/$batchId/approve` | "Approve Batch" | In Review (`primary`) |
| **`approved`** | Snapshot sealed / ready | `/app/batches/$batchId/results` | "Download & Preview" | Ready (`success`) |
| **`generating`** | Web Worker active | `/app/batches/$batchId/results` | "View Progress" | Generating (`warning`) |
| **`paused`** | Generation paused | `/app/batches/$batchId/results` | "Resume Generation" | Paused (`warning`) |
| **`ready_for_download`** | Artifacts generated | `/app/batches/$batchId/results` | "Download & Preview" | Ready (`success`) |
| **`cancelled`** | User cancelled | `/app/batches/$batchId/results` (if snapshot) else `/review` | "View Batch" | Cancelled (`error`) |
| **`failed`** | Intake / generation error | `/app/batches/$batchId/results` (if snapshot) else `/review` | "View Details" | Failed (`error`) |
| **`deleting`** | Background deletion | `/app/batches` | "Deleting..." | Deleting (`neutral`) |

---

## 2. Step-by-Step Implementation Tasks

### Task 1: Create Unit Test for Batch Navigation Mapping
- **File**: `test/batch-navigation.test.ts`
- **Action**: Test `getBatchDestinationRoute`, `getBatchActionLabel`, and `getBatchStatusBadge` across all 11 batch statuses.
- **Verification**: `npx tsx test/batch-navigation.test.ts` fails before implementation.

### Task 2: Implement Centralized Batch Navigation Helper
- **File**: `web/src/lib/batch-navigation.ts`
- **Action**: Implement pure mapping functions:
  - `getBatchDestinationRoute(batch: { _id: string; status: string; approvedSnapshotId?: string | null })`
  - `getBatchActionLabel(status: string)`
  - `getBatchStatusBadge(status: string)`
- **Verification**: `npx tsx test/batch-navigation.test.ts` passes 100%.

### Task 3: Update Batches List Page (`BatchList.tsx`)
- **File**: `web/src/components/batches/BatchList.tsx`
- **Action**:
  - Import `getBatchDestinationRoute`, `getBatchActionLabel`, and `getBatchStatusBadge`.
  - Replace hardcoded `isImportStage ? import : review` logic on batch name link, action button, and popover "View" button.
- **Verification**: Typecheck and visual code inspection.

### Task 4: Update Dashboard Recent Batches (`index.tsx`)
- **File**: `web/src/routes/_protected/app/index.tsx`
- **Action**:
  - Import `getBatchDestinationRoute` and `getBatchStatusBadge`.
  - Replace hardcoded `isImportStage ? import : review` in the "Batches Processed" column.
- **Verification**: Typecheck and visual code inspection.

### Task 5: Add Template Batches Section to Template Details (`TemplateDetails.tsx`)
- **File**: `web/src/components/templates/TemplateDetails.tsx`
- **Action**:
  - Fetch batches associated with the template: `GET /api/batches`.
  - Render "Batches Using This Template" section with status badges, recipient counts, and smart navigation using `getBatchDestinationRoute`.
  - Provide empty state with "Create Batch" call to action.
- **Verification**: Typecheck and build verification.

### Task 6: Add Sealed Snapshot Banner to Draft Review (`DraftReviewWorkspace.tsx`)
- **File**: `web/src/components/batches/DraftReviewWorkspace.tsx`
- **Action**:
  - When batch status is `approved`, `ready_for_download`, or `generating`, show an immutable snapshot alert banner at the top of the workspace with a direct action button: `"Go to Results & Generation →"`.
  - Update the header actions so the primary button is `"View Results & Generation"` when already approved.
- **Verification**: Typecheck and build verification.

### Task 7: Full Regression Verification & Commit
- **Commands**:
  - `npx tsx test/batch-navigation.test.ts`
  - `pnpm run lint`
  - `pnpm run build`
  - `pnpm test`
- **Git Commit**: `feat(batches): implement smart status-based navigation and template batches integration`
