import assert from 'assert';
import { createEditorHistory } from '../useEditorHistory';
import type { IFieldMapping } from '@/components/templates/mapping/types';

function runHistoryTests() {
  console.log('=== RUNNING EDITOR HISTORY UNIT TESTS ===\n');

  const makeField = (id: string, x: number): IFieldMapping => ({
    id,
    key: id,
    type: 'text',
    pageIndex: 0,
    rect: { x, y: 100, width: 100, height: 30 },
    alignment: 'left',
    fontFamily: 'Helvetica',
    fontSize: 12,
    minFontSize: 8,
    maxFontSize: 24,
    color: '#000000',
    fitMode: 'shrink-to-fit',
    maskMode: 'none',
  });

  const h = createEditorHistory<IFieldMapping[]>([makeField('f1', 10)]);

  // Initial state
  console.log('1. Testing Initial State...');
  assert.strictEqual(h.getPresent()[0].rect.x, 10);
  assert.strictEqual(h.canUndo(), false);
  assert.strictEqual(h.canRedo(), false);
  console.log('   ✓ Initial state passed');

  // Push snapshot 1
  console.log('2. Testing Push Snapshot & Undo...');
  h.pushSnapshot([makeField('f1', 20)]);
  assert.strictEqual(h.getPresent()[0].rect.x, 20);
  assert.strictEqual(h.canUndo(), true);
  assert.strictEqual(h.canRedo(), false);

  // Undo
  h.undo();
  assert.strictEqual(h.getPresent()[0].rect.x, 10);
  assert.strictEqual(h.canUndo(), false);
  assert.strictEqual(h.canRedo(), true);
  console.log('   ✓ Undo passed');

  // Redo
  console.log('3. Testing Redo...');
  h.redo();
  assert.strictEqual(h.getPresent()[0].rect.x, 20);
  assert.strictEqual(h.canUndo(), true);
  assert.strictEqual(h.canRedo(), false);
  console.log('   ✓ Redo passed');

  // Push after undo clears future
  console.log('4. Testing Branching Clears Future...');
  h.undo(); // back to 10
  h.pushSnapshot([makeField('f1', 30)]); // branch to 30
  assert.strictEqual(h.getPresent()[0].rect.x, 30);
  assert.strictEqual(h.canRedo(), false);
  h.undo();
  assert.strictEqual(h.getPresent()[0].rect.x, 10);
  console.log('   ✓ Future clearing passed');

  // Max depth capping (50 steps)
  console.log('5. Testing 50-step Max Depth Capping...');
  for (let i = 1; i <= 60; i++) {
    h.pushSnapshot([makeField('f1', i * 10)]);
  }
  assert.strictEqual(h.getPresent()[0].rect.x, 600);
  let undoCount = 0;
  while (h.canUndo()) {
    h.undo();
    undoCount++;
  }
  assert.strictEqual(undoCount, 50, 'Max depth must be clamped to exactly 50 steps');
  assert.strictEqual(h.getPresent()[0].rect.x, 100);
  console.log('   ✓ 50-depth capping passed');

  console.log('\n=== ALL EDITOR HISTORY TESTS PASSED! ===\n');
}

runHistoryTests();
