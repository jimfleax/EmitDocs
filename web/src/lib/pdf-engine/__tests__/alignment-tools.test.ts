import assert from "assert";
import { applyAlignmentToFields } from "../alignment-tools";
import type { IFieldMapping } from "@/components/templates/mapping/types";
import type { ViewportConfig } from "../coordinate-transforms";

function runAlignmentTests() {
  console.log("=== RUNNING ALIGNMENT TOOLS UNIT TESTS ===\n");

  const viewport: ViewportConfig = {
    width: 600,
    height: 800,
    scale: 1.0,
    rotation: 0,
  };
  const pageSize = { width: 600, height: 800 };

  const createField = (
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): IFieldMapping => ({
    id,
    key: id,
    type: "text",
    pageIndex: 0,
    rect: { x, y, width, height },
    alignment: "left",
    fontFamily: "Helvetica",
    fontSize: 12,
    minFontSize: 8,
    maxFontSize: 24,
    color: "#000000",
    fitMode: "shrink-to-fit",
    maskMode: "none",
  });

  console.log("1. Testing Align Left...");
  const f1 = createField("f1", 50, 700, 100, 30);
  const f2 = createField("f2", 120, 600, 80, 30);
  const f3 = createField("f3", 200, 500, 60, 30);

  const alignedLeft = applyAlignmentToFields(
    ["f1", "f2", "f3"],
    [f1, f2, f3],
    "alignLeft",
    viewport,
    pageSize,
  );
  assert.strictEqual(alignedLeft.find((f) => f.id === "f1")!.rect.x, 50);
  assert.strictEqual(alignedLeft.find((f) => f.id === "f2")!.rect.x, 50);
  assert.strictEqual(alignedLeft.find((f) => f.id === "f3")!.rect.x, 50);
  console.log("   ✓ Align Left passed");

  console.log("2. Testing Align Center Horizontal...");
  const alignedCenter = applyAlignmentToFields(
    ["f1", "f2", "f3"],
    [f1, f2, f3],
    "alignCenterH",
    viewport,
    pageSize,
  );
  assert.strictEqual(alignedCenter.find((f) => f.id === "f1")!.rect.x, 105);
  assert.strictEqual(alignedCenter.find((f) => f.id === "f2")!.rect.x, 115);
  assert.strictEqual(alignedCenter.find((f) => f.id === "f3")!.rect.x, 125);
  console.log("   ✓ Align Center Horizontal passed");

  console.log("3. Testing Center On Page Horizontal...");
  const centeredPage = applyAlignmentToFields(
    ["f1", "f2", "f3"],
    [f1, f2, f3],
    "centerOnPageH",
    viewport,
    pageSize,
  );
  assert.strictEqual(centeredPage.find((f) => f.id === "f1")!.rect.x, 195);
  assert.strictEqual(centeredPage.find((f) => f.id === "f2")!.rect.x, 265);
  assert.strictEqual(centeredPage.find((f) => f.id === "f3")!.rect.x, 345);
  console.log("   ✓ Center On Page Horizontal passed");

  console.log("4. Testing Distribute Horizontally...");
  const d1 = createField("d1", 0, 700, 100, 30);
  const d2 = createField("d2", 150, 700, 100, 30);
  const d3 = createField("d3", 500, 700, 100, 30);

  const distributed = applyAlignmentToFields(
    ["d1", "d2", "d3"],
    [d1, d2, d3],
    "distributeH",
    viewport,
    pageSize,
  );
  assert.strictEqual(distributed.find((f) => f.id === "d1")!.rect.x, 0);
  assert.strictEqual(distributed.find((f) => f.id === "d2")!.rect.x, 250);
  assert.strictEqual(distributed.find((f) => f.id === "d3")!.rect.x, 500);
  console.log("   ✓ Distribute Horizontally passed");

  console.log("\n=== ALL ALIGNMENT TOOLS TESTS PASSED! ===\n");
}

runAlignmentTests();
