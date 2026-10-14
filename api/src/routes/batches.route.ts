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
