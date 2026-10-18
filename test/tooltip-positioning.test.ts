/**
 * @file tooltip-positioning.test.ts
 * @description Unit tests for Tooltip coordinate calculations, boundary clamping, auto-flipping, and target resolution.
 * @architecture Validates deterministic screen positioning logic used in template editor for suggested placeholder tokens.
 * @agent_note Run via `npx tsx test/tooltip-positioning.test.ts`. Offline mathematical coordinate tests verifying edge clamping and flipping without browser DOM.
 */

import assert from "node:assert";
import {
  calculateTooltipPosition,
  resolveMeasurementTarget,
} from "../web/src/components/ui/tooltip";

console.log("Running Tooltip positioning and target resolution tests...");

// Test 1: Standard top-centered tooltip positioning
{
  const rect = {
    top: 200,
    bottom: 230,
    left: 300,
    right: 420,
    width: 120,
    height: 30,
  };
  const pos = calculateTooltipPosition(rect, {
    side: "top",
    align: "center",
    sideOffset: 4,
    viewportWidth: 1024,
    viewportHeight: 768,
  });

  assert.strictEqual(pos.effectiveSide, "top", "Should stay top when there is clearance");
  assert.strictEqual(pos.top, 196, "Top should be rect.top - sideOffset (200 - 4 = 196)");
  assert.strictEqual(pos.left, 360, "Left should be centered: 300 + 120/2 = 360");
  console.log("✓ Test 1: Standard top-centered tooltip passed");
}

// Test 2: Top start and end alignment
{
  const rect = {
    top: 150,
    bottom: 180,
    left: 200,
    right: 300,
    width: 100,
    height: 30,
  };
  const startPos = calculateTooltipPosition(rect, {
    side: "top",
    align: "start",
  });
  assert.strictEqual(startPos.left, 200, "Start alignment should align to rect.left");

  const endPos = calculateTooltipPosition(rect, {
    side: "top",
    align: "end",
  });
  assert.strictEqual(endPos.left, 300, "End alignment should align to rect.right");
  console.log("✓ Test 2: Top start and end alignment passed");
}

// Test 3: Bottom side positioning
{
  const rect = {
    top: 100,
    bottom: 130,
    left: 400,
    right: 500,
    width: 100,
    height: 30,
  };
  const pos = calculateTooltipPosition(rect, {
    side: "bottom",
    align: "center",
    sideOffset: 6,
  });
  assert.strictEqual(pos.effectiveSide, "bottom");
  assert.strictEqual(pos.top, 136, "Bottom position should be rect.bottom + sideOffset (130 + 6 = 136)");
  assert.strictEqual(pos.left, 450, "Left should be centered: 400 + 100/2 = 450");
  console.log("✓ Test 3: Bottom side positioning passed");
}

// Test 4: Left and Right side positioning
{
  const rect = {
    top: 200,
    bottom: 240,
    left: 300,
    right: 400,
    width: 100,
    height: 40,
  };
  const leftPos = calculateTooltipPosition(rect, {
    side: "left",
    sideOffset: 5,
  });
  assert.strictEqual(leftPos.effectiveSide, "left");
  assert.strictEqual(leftPos.left, 295, "Left position should be rect.left - sideOffset (300 - 5 = 295)");
  assert.strictEqual(leftPos.top, 220, "Top should be vertically centered: 200 + 40/2 = 220");

  const rightPos = calculateTooltipPosition(rect, {
    side: "right",
    sideOffset: 5,
  });
  assert.strictEqual(rightPos.effectiveSide, "right");
  assert.strictEqual(rightPos.left, 405, "Right position should be rect.right + sideOffset (400 + 5 = 405)");
  assert.strictEqual(rightPos.top, 220, "Top should be vertically centered: 200 + 40/2 = 220");
  console.log("✓ Test 4: Left and Right positioning passed");
}

// Test 5: Auto-flip from top to bottom when near top edge of screen
{
  const rectNearTop = {
    top: 20, // Less than 36px clearance
    bottom: 50,
    left: 300,
    right: 400,
    width: 100,
    height: 30,
  };
  const pos = calculateTooltipPosition(rectNearTop, {
    side: "top",
    sideOffset: 4,
    viewportHeight: 800,
  });
  assert.strictEqual(pos.effectiveSide, "bottom", "Should auto-flip to bottom when too close to top edge");
  assert.strictEqual(pos.top, 54, "Top coordinate should be rect.bottom + sideOffset (50 + 4 = 54)");
  console.log("✓ Test 5: Auto-flip from top to bottom passed");
}

// Test 6: Auto-flip from bottom to top when near bottom edge of screen
{
  const rectNearBottom = {
    top: 760,
    bottom: 790,
    left: 300,
    right: 400,
    width: 100,
    height: 30,
  };
  const pos = calculateTooltipPosition(rectNearBottom, {
    side: "bottom",
    sideOffset: 4,
    viewportHeight: 800,
  });
  assert.strictEqual(pos.effectiveSide, "top", "Should auto-flip to top when too close to bottom edge");
  assert.strictEqual(pos.top, 756, "Top coordinate should be rect.top - sideOffset (760 - 4 = 756)");
  console.log("✓ Test 6: Auto-flip from bottom to top passed");
}

// Test 7: Horizontal clamping within viewport
{
  const rectNearLeft = {
    top: 200,
    bottom: 230,
    left: -20,
    right: 10,
    width: 30,
    height: 30,
  };
  const posLeft = calculateTooltipPosition(rectNearLeft, {
    side: "top",
    viewportWidth: 1000,
  });
  assert.ok(posLeft.left >= 12, `Left should be clamped to at least 12px (got ${posLeft.left})`);

  const rectNearRight = {
    top: 200,
    bottom: 230,
    left: 990,
    right: 1050,
    width: 60,
    height: 30,
  };
  const posRight = calculateTooltipPosition(rectNearRight, {
    side: "top",
    viewportWidth: 1000,
  });
  assert.ok(posRight.left <= 988, `Left should be clamped to at most viewportWidth - 12 (got ${posRight.left})`);
  console.log("✓ Test 7: Horizontal clamping passed");
}

// Test 8: Target resolution for collapsed 0x0 wrappers
{
  // Null element
  assert.strictEqual(resolveMeasurementTarget(null), null);

  // Normal element with dimensions
  const normalElement = {
    offsetWidth: 100,
    offsetHeight: 30,
    firstElementChild: null,
  } as unknown as HTMLElement;
  assert.strictEqual(resolveMeasurementTarget(normalElement), normalElement);

  // Collapsed wrapper with a child element (e.g. absolutely positioned placeholder inside a <span>)
  const childElement = {
    offsetWidth: 120,
    offsetHeight: 24,
    tagName: "DIV",
  } as unknown as HTMLElement;

  const collapsedWrapper = {
    offsetWidth: 0,
    offsetHeight: 0,
    firstElementChild: childElement,
  } as unknown as HTMLElement;

  assert.strictEqual(
    resolveMeasurementTarget(collapsedWrapper),
    childElement,
    "Should resolve to child element when wrapper dimensions are 0x0"
  );
  console.log("✓ Test 8: Target resolution for collapsed wrappers passed");
}

console.log("\n===========================================================");
console.log("  ALL TOOLTIP POSITIONING UNIT TESTS PASSED SUCCESSFULLY!  ");
console.log("===========================================================\n");
