import assert from 'assert';
import { calculateSnapping } from '../alignment-snapper';
import type { DomRect, ViewportConfig } from '../coordinate-transforms';

function runSnapperTests() {
  console.log('=== RUNNING ALIGNMENT SNAPPER UNIT TESTS ===\n');

  const viewport: ViewportConfig = {
    width: 600,
    height: 800,
    scale: 1.0,
    rotation: 0,
  };

  // 1. Page Center Snapping
  console.log('1. Testing Page Center Snapping...');
  const nearCenterExact: DomRect = { x: 247, y: 396, width: 100, height: 40 }; // center is 297 (3px from 300), Y center is 416 (16px from 400)
  
  const snapCenter = calculateSnapping(nearCenterExact, [], viewport, { thresholdPx: 8 });
  // Center X was 297, page center is 300 -> diff 3px <= 8px -> snaps to 300 - 50 = 250
  assert.strictEqual(snapCenter.rect.x, 250, 'Box center X must snap to page center X (300)');
  assert.ok(snapCenter.guides.some((g) => g.type === 'vertical' && g.position === 300), 'Must create vertical guide at page center');
  console.log('   ✓ Page center snapping verified');

  // 2. Sibling Box Edge & Center Snapping
  console.log('2. Testing Sibling Box Alignment...');
  const sibling: DomRect = { x: 100, y: 200, width: 200, height: 50 }; // left: 100, center: 200, right: 300
  const draggingBox: DomRect = { x: 104, y: 350, width: 150, height: 40 }; // left is 104 (4px from sibling left 100)

  const snapSib = calculateSnapping(draggingBox, [sibling], viewport, { thresholdPx: 8 });
  assert.strictEqual(snapSib.rect.x, 100, 'Left edge must snap to sibling left edge (100)');
  assert.ok(snapSib.guides.some((g) => g.type === 'vertical' && g.position === 100), 'Must create guide at sibling left');
  console.log('   ✓ Sibling field edge alignment verified');

  // 3. Alt Key Bypass
  console.log('3. Testing Alt-Key Snapping Bypass...');
  const altSnap = calculateSnapping(nearCenterExact, [], viewport, { thresholdPx: 8, isAltPressed: true });
  assert.strictEqual(altSnap.rect.x, nearCenterExact.x, 'Alt key must bypass snapping completely');
  assert.strictEqual(altSnap.guides.length, 0, 'No guides should be generated when Alt is pressed');
  console.log('   ✓ Alt key bypass verified');

  // 4. Sensitivity Threshold Boundaries
  console.log('4. Testing Sensitivity Thresholds...');
  const boxOutsideThreshold: DomRect = { x: 240, y: 100, width: 100, height: 40 }; // center is 290 (10px from 300)
  const lowSensSnap = calculateSnapping(boxOutsideThreshold, [], viewport, { thresholdPx: 4 });
  assert.strictEqual(lowSensSnap.rect.x, 240, '10px distance must NOT snap when threshold is 4px');

  const highSensSnap = calculateSnapping(boxOutsideThreshold, [], viewport, { thresholdPx: 14 });
  assert.strictEqual(highSensSnap.rect.x, 250, '10px distance MUST snap when threshold is 14px');
  console.log('   ✓ Sensitivity thresholds verified');

  // 5. 8-Point Resize Handle Snapping (East handle)
  console.log('5. Testing 8-Point Resize Snapping...');
  const resizingEast: DomRect = { x: 100, y: 200, width: 195, height: 50 }; // right edge is 295, sibling right is 300 (diff 5px)
  const resizeSnap = calculateSnapping(resizingEast, [sibling], viewport, { thresholdPx: 8, handleType: 'e' });
  assert.strictEqual(resizeSnap.rect.x, 100, 'Left position must not change during East resize');
  assert.strictEqual(resizeSnap.rect.width, 200, 'Width must snap to 200 so right edge aligns with sibling (300)');
  assert.ok(resizeSnap.guides.some((g) => g.type === 'vertical' && g.position === 300), 'Must create guide at right edge');
  console.log('   ✓ 8-Point resize handle snapping verified');

  console.log('\n=== ALL ALIGNMENT SNAPPER UNIT TESTS PASSED! ===');
}

runSnapperTests();
