/**
 * @file batch-navigation.test.ts
 * @description Unit tests for batch lifecycle state mapping, destination route resolution, action labels, and status badges.
 * @architecture Validates pure routing logic in web/src/lib/batch-navigation.ts across all 11 BatchStatus states.
 * @agent_note Run via `npx tsx test/batch-navigation.test.ts`.
 */

import assert from 'node:assert';
import {
  getBatchDestinationRoute,
  getBatchActionLabel,
  getBatchStatusBadge,
} from '../web/src/lib/batch-navigation';

console.log('===========================================================');
console.log('  BATCH LIFECYCLE ROUTING & NAVIGATION TEST SUITE');
console.log('===========================================================\n');

// 1. Test getBatchDestinationRoute across all states
console.log('--- Testing getBatchDestinationRoute ---');

// draft & importing -> import workspace
assert.deepStrictEqual(
  getBatchDestinationRoute({ _id: 'b1', status: 'draft' }),
  { to: '/app/batches/$batchId/import', params: { batchId: 'b1' }, path: '/app/batches/b1/import' },
  'draft must route to import workspace'
);

assert.deepStrictEqual(
  getBatchDestinationRoute({ _id: 'b2', status: 'importing' }),
  { to: '/app/batches/$batchId/import', params: { batchId: 'b2' }, path: '/app/batches/b2/import' },
  'importing must route to import workspace'
);

// review -> review workspace
assert.deepStrictEqual(
  getBatchDestinationRoute({ _id: 'b3', status: 'review' }),
  { to: '/app/batches/$batchId/review', params: { batchId: 'b3' }, path: '/app/batches/b3/review' },
  'review must route to review workspace'
);

// awaiting_approval -> approve workspace
assert.deepStrictEqual(
  getBatchDestinationRoute({ _id: 'b4', status: 'awaiting_approval' }),
  { to: '/app/batches/$batchId/approve', params: { batchId: 'b4' }, path: '/app/batches/b4/approve' },
  'awaiting_approval must route to approve workspace'
);

// approved & ready_for_download & generating & paused -> results workspace
assert.deepStrictEqual(
  getBatchDestinationRoute({ _id: 'b5', status: 'approved' }),
  { to: '/app/batches/$batchId/results', params: { batchId: 'b5' }, path: '/app/batches/b5/results' },
  'approved must route to results workspace'
);

assert.deepStrictEqual(
  getBatchDestinationRoute({ _id: 'b6', status: 'ready_for_download' }),
  { to: '/app/batches/$batchId/results', params: { batchId: 'b6' }, path: '/app/batches/b6/results' },
  'ready_for_download must route to results workspace'
);

assert.deepStrictEqual(
  getBatchDestinationRoute({ _id: 'b7', status: 'generating' }),
  { to: '/app/batches/$batchId/results', params: { batchId: 'b7' }, path: '/app/batches/b7/results' },
  'generating must route to results workspace'
);

assert.deepStrictEqual(
  getBatchDestinationRoute({ _id: 'b8', status: 'paused' }),
  { to: '/app/batches/$batchId/results', params: { batchId: 'b8' }, path: '/app/batches/b8/results' },
  'paused must route to results workspace'
);

// cancelled & failed with approvedSnapshotId -> results workspace
assert.deepStrictEqual(
  getBatchDestinationRoute({ _id: 'b9', status: 'cancelled', approvedSnapshotId: 'snap1' }),
  { to: '/app/batches/$batchId/results', params: { batchId: 'b9' }, path: '/app/batches/b9/results' },
  'cancelled with snapshot must route to results workspace'
);

assert.deepStrictEqual(
  getBatchDestinationRoute({ _id: 'b10', status: 'failed', approvedSnapshotId: 'snap2' }),
  { to: '/app/batches/$batchId/results', params: { batchId: 'b10' }, path: '/app/batches/b10/results' },
  'failed with snapshot must route to results workspace'
);

// cancelled & failed without snapshot -> review workspace
assert.deepStrictEqual(
  getBatchDestinationRoute({ _id: 'b11', status: 'cancelled' }),
  { to: '/app/batches/$batchId/review', params: { batchId: 'b11' }, path: '/app/batches/b11/review' },
  'cancelled without snapshot must route to review workspace'
);

assert.deepStrictEqual(
  getBatchDestinationRoute({ _id: 'b12', status: 'failed' }),
  { to: '/app/batches/$batchId/review', params: { batchId: 'b12' }, path: '/app/batches/b12/review' },
  'failed without snapshot must route to review workspace'
);

// deleting -> batches catalog
assert.deepStrictEqual(
  getBatchDestinationRoute({ _id: 'b13', status: 'deleting' }),
  { to: '/app/batches', path: '/app/batches' },
  'deleting must route to batches catalog'
);

// expired -> results workspace
assert.deepStrictEqual(
  getBatchDestinationRoute({ _id: 'b14', status: 'expired' }),
  { to: '/app/batches/$batchId/results', params: { batchId: 'b14' }, path: '/app/batches/b14/results' },
  'expired must route to results workspace'
);

console.log('✓ All destination routes verified.');

// 2. Test getBatchActionLabel
console.log('\n--- Testing getBatchActionLabel ---');
assert.strictEqual(getBatchActionLabel('draft'), 'Continue Import');
assert.strictEqual(getBatchActionLabel('importing'), 'Continue Import');
assert.strictEqual(getBatchActionLabel('review'), 'Review Data');
assert.strictEqual(getBatchActionLabel('awaiting_approval'), 'Approve Batch');
assert.strictEqual(getBatchActionLabel('approved'), 'Download & Preview');
assert.strictEqual(getBatchActionLabel('ready_for_download'), 'Download & Preview');
assert.strictEqual(getBatchActionLabel('generating'), 'View Progress');
assert.strictEqual(getBatchActionLabel('paused'), 'Resume Generation');
assert.strictEqual(getBatchActionLabel('cancelled'), 'View Batch');
assert.strictEqual(getBatchActionLabel('failed'), 'View Details');
assert.strictEqual(getBatchActionLabel('deleting'), 'Deleting...');
assert.strictEqual(getBatchActionLabel('expired'), 'View Expired');
console.log('✓ All action labels verified.');

// 3. Test getBatchStatusBadge
console.log('\n--- Testing getBatchStatusBadge ---');
assert.deepStrictEqual(getBatchStatusBadge('approved'), { label: 'Ready', variant: 'success' });
assert.deepStrictEqual(getBatchStatusBadge('ready_for_download'), { label: 'Ready', variant: 'success' });
assert.deepStrictEqual(getBatchStatusBadge('review'), { label: 'In Review', variant: 'primary' });
assert.deepStrictEqual(getBatchStatusBadge('awaiting_approval'), { label: 'In Review', variant: 'primary' });
assert.deepStrictEqual(getBatchStatusBadge('draft'), { label: 'Draft', variant: 'neutral' });
assert.deepStrictEqual(getBatchStatusBadge('importing'), { label: 'Importing', variant: 'warning' });
assert.deepStrictEqual(getBatchStatusBadge('generating'), { label: 'Generating', variant: 'warning' });
assert.deepStrictEqual(getBatchStatusBadge('paused'), { label: 'Paused', variant: 'warning' });
assert.deepStrictEqual(getBatchStatusBadge('failed'), { label: 'Failed', variant: 'error' });
assert.deepStrictEqual(getBatchStatusBadge('cancelled'), { label: 'Cancelled', variant: 'error' });
assert.deepStrictEqual(getBatchStatusBadge('deleting'), { label: 'Deleting', variant: 'neutral' });
assert.deepStrictEqual(getBatchStatusBadge('expired'), { label: 'Expired', variant: 'error' });
console.log('✓ All status badges verified.');

console.log('\n===========================================================');
console.log('🎉 ALL BATCH NAVIGATION TESTS PASSED SUCCESSFULLY!');
console.log('===========================================================');
