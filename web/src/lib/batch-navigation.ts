/**
 * @file batch-navigation.ts
 * @description Centralized batch lifecycle routing, action labels, and status badge resolvers.
 * @architecture Enforces consistent workflow step navigation across dashboard, batch catalog, and template detail views.
 * @agent_note Routes approved/ready batches directly to the results & preview/download workspace (/app/batches/$batchId/results).
 */

export type BatchRoutePath =
  | "/app/batches/$batchId/import"
  | "/app/batches/$batchId/review"
  | "/app/batches/$batchId/approve"
  | "/app/batches/$batchId/results";

export interface BatchRouteTarget {
  to: BatchRoutePath;
  params: { batchId: string };
  path: string;
}

export interface BatchBadgeConfig {
  label: string;
  variant: "success" | "primary" | "warning" | "error" | "neutral";
}

export interface NavigableBatch {
  _id: string;
  status: string;
  approvedSnapshotId?: any;
}

/**
 * Resolves the appropriate workflow destination route for a batch based on its lifecycle status.
 *
 * State Matrix:
 * - draft | importing                     -> /app/batches/$batchId/import
 * - review                                -> /app/batches/$batchId/review
 * - awaiting_approval                     -> /app/batches/$batchId/approve
 * - approved | ready_for_download         -> /app/batches/$batchId/results
 * - generating | paused                   -> /app/batches/$batchId/results
 * - cancelled | failed (with snapshot)    -> /app/batches/$batchId/results
 * - cancelled | failed (without snapshot) -> /app/batches/$batchId/review
 * - default                               -> /app/batches/$batchId/review
 *
 * @param batch Object containing batch ID, status, and optional approvedSnapshotId reference.
 * @returns TanStack Router compatible route target with `to`, `params`, and direct `path`.
 */
export function getBatchDestinationRoute(batch: NavigableBatch): BatchRouteTarget {
  const { _id: batchId, status, approvedSnapshotId } = batch;

  switch (status) {
    case "draft":
    case "importing":
      return {
        to: "/app/batches/$batchId/import",
        params: { batchId },
        path: `/app/batches/${batchId}/import`,
      };

    case "review":
      return {
        to: "/app/batches/$batchId/review",
        params: { batchId },
        path: `/app/batches/${batchId}/review`,
      };

    case "awaiting_approval":
      return {
        to: "/app/batches/$batchId/approve",
        params: { batchId },
        path: `/app/batches/${batchId}/approve`,
      };

    case "approved":
    case "ready_for_download":
    case "generating":
    case "paused":
      return {
        to: "/app/batches/$batchId/results",
        params: { batchId },
        path: `/app/batches/${batchId}/results`,
      };

    case "cancelled":
    case "failed":
      if (approvedSnapshotId) {
        return {
          to: "/app/batches/$batchId/results",
          params: { batchId },
          path: `/app/batches/${batchId}/results`,
        };
      }
      return {
        to: "/app/batches/$batchId/review",
        params: { batchId },
        path: `/app/batches/${batchId}/review`,
      };

    default:
      return {
        to: "/app/batches/$batchId/review",
        params: { batchId },
        path: `/app/batches/${batchId}/review`,
      };
  }
}

/**
 * Returns a human-friendly, contextual action label for primary workflow buttons based on batch status.
 *
 * @param status Batch lifecycle state string.
 * @returns Button label string.
 */
export function getBatchActionLabel(status: string): string {
  switch (status) {
    case "draft":
    case "importing":
      return "Continue Import";
    case "review":
      return "Review Data";
    case "awaiting_approval":
      return "Approve Batch";
    case "approved":
    case "ready_for_download":
      return "Download & Preview";
    case "generating":
      return "View Progress";
    case "paused":
      return "Resume Generation";
    case "cancelled":
      return "View Batch";
    case "failed":
      return "View Details";
    default:
      return "View Documents";
  }
}

/**
 * Resolves the visual badge configuration (label and color variant) for a batch status.
 *
 * @param status Batch lifecycle state string.
 * @returns Badge configuration with label and theme variant.
 */
export function getBatchStatusBadge(status: string): BatchBadgeConfig {
  switch (status) {
    case "ready_for_download":
    case "approved":
      return { label: "Ready", variant: "success" };
    case "review":
    case "awaiting_approval":
      return { label: "In Review", variant: "primary" };
    case "draft":
      return { label: "Draft", variant: "neutral" };
    case "importing":
      return { label: "Importing", variant: "warning" };
    case "generating":
      return { label: "Generating", variant: "warning" };
    case "paused":
      return { label: "Paused", variant: "warning" };
    case "failed":
      return { label: "Failed", variant: "error" };
    case "cancelled":
      return { label: "Cancelled", variant: "error" };
    default:
      return { label: status, variant: "neutral" };
  }
}
