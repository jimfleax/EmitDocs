/**
 * @file batches.route.ts
 * @description Route definitions and router setup for batch document intake, spreadsheet import pipelines, draft row editing, and re-import reconciliation.
 *
 * @architecture
 * - Sub-router mounted under `/api/batches` in the primary application router.
 * - Secures all routes via `requireAuth` middleware before controller dispatch.
 * - Groups routing into batch CRUD, multi-step import staging (mapping, chunk streaming, finalizing), draft row retrieval/patching, and re-import diff/reconciliation.
 *
 * @agent_note
 * Note the route ordering: `/activity` is defined before `/:id` so that the literal string "activity" is not captured as an `id` parameter.
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  createBatch,
  getBatches,
  getBatchActivity,
  getBatchById,
  createImport,
  updateImportMapping,
  submitRowsChunk,
  finalizeImport,
  getDraftRows,
  patchDraftRow,
  getReimportDiff,
  reconcileReimport,
  deleteBatch,
} from '../controllers/batches.controller.js';

/**
 * Sub-router mounting all batch intake, spreadsheet staging, and draft row manipulation endpoints.
 */
const batchesApp = new Hono();

batchesApp.use('*', requireAuth);

batchesApp.post('/', createBatch);
batchesApp.get('/', getBatches);
batchesApp.get('/activity', getBatchActivity);
batchesApp.get('/:id', getBatchById);
batchesApp.delete('/:id', deleteBatch);

// Import workflows
batchesApp.post('/:id/imports', createImport);
batchesApp.put('/:id/imports/:importId/mapping', updateImportMapping);
batchesApp.post('/:id/imports/:importId/rows', submitRowsChunk);
batchesApp.post('/:id/imports/:importId/finalize', finalizeImport);

// Rows retrieval & mutation
batchesApp.get('/:id/rows', getDraftRows);
batchesApp.patch('/:id/rows/:rowId', patchDraftRow);

// Re-import diff & reconciliation
batchesApp.get('/:id/reimports/:importId/diff', getReimportDiff);
batchesApp.post('/:id/reimports/:importId/reconcile', reconcileReimport);

export default batchesApp;
