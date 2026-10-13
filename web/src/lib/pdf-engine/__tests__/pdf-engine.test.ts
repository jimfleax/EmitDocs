import assert from "assert";
import { PDFDocument } from "pdf-lib";
import { domToPdfRect, pdfToDomRect } from "../coordinate-transforms";
import { detectTokensInTextItems } from "../token-detector";
import { calculateFit, calculateMultiLineWrap } from "../fit-then-flag";
import { validateStandardFontGlyphs } from "../glyph-validator";
import {
  generatePdfWithOverlay,
  FieldMappingConfig,
} from "../pdf-preview-engine";

async function runSlice2Tests() {
  console.log("=== RUNNING SLICE 2 PDF ENGINE UNIT TESTS ===\n");

  // TEST 1: Coordinate Transforms Roundtrip
  console.log(
    "1. Testing Coordinate Transforms Roundtrip (0°, 90°, 180°, 270°)...",
  );
  const rotations = [0, 90, 180, 270];
  const scales = [0.5, 1.0, 1.5, 2.0];
  const testPdfRect = { x: 50, y: 100, width: 200, height: 40 };

  for (const rot of rotations) {
    for (const scale of scales) {
      const isLandscape = rot === 90 || rot === 270;
      const vp = {
        width: isLandscape ? 842 * scale : 595 * scale,
        height: isLandscape ? 595 * scale : 842 * scale,
        scale,
        rotation: rot,
      };

      const domRect = pdfToDomRect(testPdfRect, vp);
      const roundtripPdfRect = domToPdfRect(domRect, vp);

      assert(
        Math.abs(roundtripPdfRect.x - testPdfRect.x) < 0.001,
        `X mismatch at rot=${rot}, scale=${scale}`,
      );
      assert(
        Math.abs(roundtripPdfRect.y - testPdfRect.y) < 0.001,
        `Y mismatch at rot=${rot}, scale=${scale}`,
      );
      assert(
        Math.abs(roundtripPdfRect.width - testPdfRect.width) < 0.001,
        `Width mismatch at rot=${rot}, scale=${scale}`,
      );
      assert(
        Math.abs(roundtripPdfRect.height - testPdfRect.height) < 0.001,
        `Height mismatch at rot=${rot}, scale=${scale}`,
      );
    }
  }
  console.log(
    "   ✓ Coordinate transforms roundtrip identical across all rotations and scales",
  );

  // TEST 2: Token Detector
  console.log(
    "2. Testing Token Detector on intact, split, and multi-pattern tokens...",
  );
  const textItems = [
    // Intact double-brace token
    {
      str: "Hello {{fullName}}, welcome!",
      transform: [1, 0, 0, 12, 50, 700],
      width: 150,
      height: 12,
    },
    // Split token across multiple runs: ["{{", "order", "_id", "}}"]
    {
      str: "Order: {{",
      transform: [1, 0, 0, 12, 50, 650],
      width: 40,
      height: 12,
    },
    { str: "order", transform: [1, 0, 0, 12, 90, 650], width: 30, height: 12 },
    { str: "_id", transform: [1, 0, 0, 12, 120, 650], width: 15, height: 12 },
    {
      str: "}} confirmed",
      transform: [1, 0, 0, 12, 135, 650],
      width: 60,
      height: 12,
    },
    // Multi-pattern tokens: single brace, bracket, angle bracket, dollar
    {
      str: "Contact: {email} | Issue Date: [issueDate]",
      transform: [1, 0, 0, 12, 50, 600],
      width: 220,
      height: 12,
    },
    {
      str: "Status: <statusCode> | Total: $AMOUNT_DUE",
      transform: [1, 0, 0, 12, 50, 550],
      width: 200,
      height: 12,
    },
    // Normal text without tokens
    {
      str: "Terms & Conditions apply.",
      transform: [1, 0, 0, 10, 50, 100],
      width: 120,
      height: 10,
    },
  ];

  const detected = detectTokensInTextItems(textItems, 0);
  assert.strictEqual(
    detected.length,
    6,
    "Should find 6 tokens across all patterns",
  );
  assert.strictEqual(detected[0].key, "fullName");
  assert.strictEqual(detected[0].confidence, "exact");
  assert.strictEqual(detected[1].key, "order_id");
  assert.strictEqual(detected[1].confidence, "split-span");
  assert.strictEqual(detected[2].key, "email");
  assert.strictEqual(detected[3].key, "issueDate");
  assert.strictEqual(detected[4].key, "statusCode");
  assert.strictEqual(detected[5].key, "AMOUNT_DUE");
  assert.ok(
    detected[1].rect.width > 20,
    "Split token union width calculated correctly",
  );
  console.log(
    "   ✓ Token detector correctly extracted multi-pattern tokens ({{}}, {}, [], <>, $)",
  );

  // TEST 3: Fit-Then-Flag Algorithm & Multi-line Wrap
  console.log("3. Testing Fit-Then-Flag Sizing & Multi-line Wrapping...");
  const mockFont = {
    widthOfTextAtSize: (t: string, s: number) => t.length * 6 * (s / 10),
    heightAtSize: (s: number) => s,
  };
  const box = { width: 100, height: 30 };

  // Short text: should stay near maxFontSize (20)
  const fitShort = calculateFit("Bob", mockFont, box, 8, 20, "shrink-to-fit");
  assert.strictEqual(fitShort.isOverflow, false);
  assert.strictEqual(fitShort.status, "fits");
  assert.strictEqual(fitShort.fittedFontSize, 20);

  // Medium text: should scale down without overflow
  const fitMed = calculateFit(
    "Alexander Montgomery",
    mockFont,
    box,
    8,
    20,
    "shrink-to-fit",
  );
  assert.strictEqual(fitMed.isOverflow, false);
  assert.strictEqual(fitMed.status, "clamped");
  assert.ok(fitMed.fittedFontSize < 20 && fitMed.fittedFontSize >= 8);

  // Very long text: exceeds box at minFontSize (8), should flag isOverflow = true
  const veryLong =
    "Very Extremely Exceptionally Long Name That Will Surely Exceed The Box";
  const fitLong = calculateFit(veryLong, mockFont, box, 8, 20, "shrink-to-fit");
  assert.strictEqual(fitLong.isOverflow, true);
  assert.strictEqual(fitLong.status, "overflow");
  assert.strictEqual(fitLong.fittedFontSize, 8);
  assert.ok(fitLong.overflowPixels > 0, "overflowPixels calculated");

  // Multi-line wrap test: paragraph splitting into multiple lines within width
  const paragraph =
    "This is an introductory paragraph that automatically wraps onto multiple distinct lines.";

  // Multi-line wrap test: fits without scaling down
  const tallBox = { width: 120, height: 150 };
  const fitsResult = calculateMultiLineWrap(
    paragraph,
    mockFont,
    tallBox,
    12,
    1.25,
    8,
    16,
  );
  assert.ok(fitsResult.lines.length >= 2, "Should wrap into multiple lines");
  assert.strictEqual(fitsResult.isOverflow, false);
  assert.strictEqual(fitsResult.status, "fits");
  assert.strictEqual(fitsResult.fittedFontSize, 12);

  // Multi-line wrap test: clamped (scales down to fit without overflowing)
  const multiBox = { width: 120, height: 80 };
  const wrapResult = calculateMultiLineWrap(
    paragraph,
    mockFont,
    multiBox,
    12,
    1.25,
    8,
    16,
  );
  assert.ok(wrapResult.lines.length >= 2, "Should wrap into multiple lines");
  assert.strictEqual(
    wrapResult.isOverflow,
    false,
    "Should fit within 80pt box height",
  );
  assert.strictEqual(wrapResult.status, "clamped");
  assert.ok(wrapResult.fittedFontSize < 12 && wrapResult.fittedFontSize >= 8);

  // Multi-line wrap overflow test: small box height
  const tightBox = { width: 120, height: 15 };
  const tightWrap = calculateMultiLineWrap(
    paragraph,
    mockFont,
    tightBox,
    12,
    1.25,
    8,
    16,
  );
  assert.strictEqual(tightWrap.isOverflow, true);
  assert.strictEqual(tightWrap.status, "overflow");
  assert.ok(tightWrap.overflowPixels > 0);
  console.log(
    "   ✓ Fit-then-flag and multi-line wrapping accurately clamp and detect overflow",
  );

  // TEST 4: Glyph Validator
  console.log("4. Testing Glyph Validator (WinAnsi vs Unicode)...");
  const validLatin = validateStandardFontGlyphs("Alice & Bob - 2026 / 100% €");
  assert.strictEqual(validLatin.valid, true);
  assert.strictEqual(validLatin.missingGlyphs.length, 0);

  const invalidUnicode = validateStandardFontGlyphs(
    "Hello 世界, こんにちは, Привет 🚀",
  );
  assert.strictEqual(invalidUnicode.valid, false);
  assert.ok(invalidUnicode.missingGlyphs.includes("世"));
  assert.ok(invalidUnicode.missingGlyphs.includes("П"));
  assert.ok(invalidUnicode.missingGlyphs.includes("🚀"));
  console.log("   ✓ Glyph validator correctly flags non-encodable characters");

  // TEST 5: PDF Preview Generation Pipeline
  console.log("5. Testing PDF Preview Engine with pdf-lib overlay...");
  // Create blank synthetic 1-page PDF
  const baseDoc = await PDFDocument.create();
  baseDoc.addPage([595, 842]);
  const baseBytes = await baseDoc.save();

  const mappings: FieldMappingConfig[] = [
    {
      id: "f1",
      key: "recipient",
      pageIndex: 0,
      rect: { x: 50, y: 500, width: 250, height: 35 },
      alignment: "center",
      fontFamily: "Helvetica-Bold",
      fontSize: 16,
      minFontSize: 10,
      maxFontSize: 24,
      maskMode: "solid-white",
      color: "#1a56db",
    },
    {
      id: "f2",
      key: "certNo",
      pageIndex: 0,
      rect: { x: 50, y: 400, width: 100, height: 20 },
      alignment: "left",
      fontFamily: "Courier",
      fontSize: 12,
      minFontSize: 8,
      maxFontSize: 14,
      maskMode: "none",
      color: "#333333",
    },
    {
      id: "f3",
      key: "address",
      pageIndex: 0,
      rect: { x: 50, y: 250, width: 200, height: 60 },
      alignment: "left",
      fontFamily: "Helvetica",
      fontSize: 12,
      minFontSize: 8,
      maxFontSize: 14,
      fitMode: "multi-line",
      maskMode: "solid-white",
      color: "#111827",
    },
  ];

  const result = await generatePdfWithOverlay(
    baseBytes,
    mappings,
    {
      recipient: "Jane Smith",
      certNo: "CERT-2026-99",
      address: "123 Innovation Boulevard\nSuite 400\nSan Francisco, CA",
    },
    { drawDebugBoxes: true },
  );

  assert.ok(
    result.pdfBytes.length > baseBytes.length,
    "Output PDF must contain overlay bytes",
  );
  assert.strictEqual(
    result.warnings.length,
    0,
    "No warnings for standard valid data",
  );

  // Verify resulting document loads back in pdf-lib
  const verifyDoc = await PDFDocument.load(result.pdfBytes);
  assert.strictEqual(verifyDoc.getPageCount(), 1);
  console.log(
    "   ✓ In-memory preview generator generated valid modified PDF bytes",
  );

  // TEST 6: Glyph Fallback Preserves Formatted & Transformed Text
  console.log(
    "6. Testing Glyph Fallback Preserves Formatted & Transformed Text...",
  );
  const glyphMappings: FieldMappingConfig[] = [
    {
      id: "g1",
      key: "title",
      pageIndex: 0,
      rect: { x: 50, y: 500, width: 250, height: 35 },
      alignment: "left",
      fontFamily: "Helvetica",
      fontSize: 14,
      maskMode: "acroform-field",
      textTransform: "uppercase",
    },
  ];

  const glyphResult = await generatePdfWithOverlay(
    baseBytes,
    glyphMappings,
    { title: "hello world 🚀" },
    { flattenAcroForms: false },
  );

  assert.strictEqual(
    glyphResult.warnings.length,
    1,
    "Should issue warning for unsupported glyph",
  );
  assert.strictEqual(glyphResult.warnings[0].type, "unsupported_glyph");
  assert.strictEqual(glyphResult.warnings[0].fieldKey, "title");
  assert.deepStrictEqual(glyphResult.warnings[0].details?.missingGlyphs, [
    "🚀",
  ]);

  const glyphDoc = await PDFDocument.load(glyphResult.pdfBytes);
  const form = glyphDoc.getForm();
  const field = form.getTextField("title_0_g1");
  assert.strictEqual(
    field.getText(),
    "HELLO WORLD ?",
    "Glyph fallback must preserve uppercase transform from formattedText",
  );
  console.log(
    "   ✓ Glyph fallback preserves text transformation and replaces unsupported glyph with ?",
  );

  console.log("\n=== ALL SLICE 2 UNIT TESTS PASSED SUCCESSFULLY! ===");
}

runSlice2Tests().catch((err) => {
  console.error("Slice 2 test failure:", err);
  process.exit(1);
});
