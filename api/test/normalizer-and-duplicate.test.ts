import assert from 'node:assert';
import mongoose from 'mongoose';
import { TemplateVersion } from '../src/models/TemplateVersion.js';
import { BatchImport } from '../src/models/BatchImport.js';
import { normalizeNumberValue } from '../src/services/spreadsheet/data-normalizer.js';
import { detectDuplicatesAcrossRows, RowWarning } from '../src/services/spreadsheet/duplicate-detector.js';

async function runTests() {
  console.log('🧪 Starting Backend Engineer Unit & Verification Test Suite...\n');

  // =========================================================================
  // 1. TemplateVersion: lineHeight should not default to 1.2
  // =========================================================================
  console.log('1. Testing TemplateVersion lineHeight default behavior...');
  const tvUnset = new TemplateVersion({
    templateId: new mongoose.Types.ObjectId(),
    ownerId: 'test_owner',
    version: 1,
    sourceObjectKey: 'test.pdf',
    bytes: 1024,
    pageCount: 1,
    fieldMappings: [
      {
        id: 'f1',
        key: 'testField',
        pageIndex: 0,
        rect: { x: 10, y: 10, width: 100, height: 20 },
      },
    ],
  });

  assert.strictEqual(
    tvUnset.fieldMappings[0].lineHeight,
    undefined,
    'Unset lineHeight must remain undefined instead of defaulting to 1.2'
  );

  const tvExplicit = new TemplateVersion({
    templateId: new mongoose.Types.ObjectId(),
    ownerId: 'test_owner',
    version: 1,
    sourceObjectKey: 'test.pdf',
    bytes: 1024,
    pageCount: 1,
    fieldMappings: [
      {
        id: 'f2',
        key: 'testField2',
        pageIndex: 0,
        rect: { x: 10, y: 10, width: 100, height: 20 },
        lineHeight: 1.5,
      },
    ],
  });

  assert.strictEqual(
    tvExplicit.fieldMappings[0].lineHeight,
    1.5,
    'Explicit lineHeight must be preserved'
  );
  console.log('   ✓ TemplateVersion lineHeight leaves unset values undefined\n');

  // =========================================================================
  // 2. BatchImport: dateFormatHints interface and schema
  // =========================================================================
  console.log('2. Testing BatchImport dateFormatHints schema definition...');
  const biDefault = new BatchImport({
    batchId: new mongoose.Types.ObjectId(),
    ownerId: 'test_owner',
    revision: 1,
    sourceFileName: 'test.xlsx',
    sourceFileSize: 2048,
  });
  assert.deepStrictEqual(
    biDefault.dateFormatHints,
    {},
    'BatchImport.dateFormatHints should default to an empty object'
  );

  const biWithHints = new BatchImport({
    batchId: new mongoose.Types.ObjectId(),
    ownerId: 'test_owner',
    revision: 1,
    sourceFileName: 'test.xlsx',
    sourceFileSize: 2048,
    dateFormatHints: { issueDate: 'DD/MM/YYYY', expiryDate: 'YYYY-MM-DD' },
  });
  assert.strictEqual(biWithHints.dateFormatHints?.issueDate, 'DD/MM/YYYY');
  assert.strictEqual(biWithHints.dateFormatHints?.expiryDate, 'YYYY-MM-DD');
  console.log('   ✓ BatchImport dateFormatHints accepts and stores date format hints\n');

  // =========================================================================
  // 3. data-normalizer: normalizeNumberValue ambiguity and locale handling
  // =========================================================================
  console.log('3. Testing normalizeNumberValue number parsing & ambiguity checks...');

  // 3.1 Single comma with 3 digits -> AMBIGUOUS_NUMBER
  const amb1 = normalizeNumberValue('1,000');
  assert.strictEqual(amb1.error?.code, 'AMBIGUOUS_NUMBER', '1,000 must be ambiguous');

  const amb2 = normalizeNumberValue('12,345');
  assert.strictEqual(amb2.error?.code, 'AMBIGUOUS_NUMBER', '12,345 must be ambiguous');

  const amb3 = normalizeNumberValue('$ 100,000');
  assert.strictEqual(amb3.error?.code, 'AMBIGUOUS_NUMBER', '$ 100,000 must be ambiguous');

  const amb4 = normalizeNumberValue('1,250');
  assert.strictEqual(amb4.error?.code, 'AMBIGUOUS_NUMBER', '1,250 must be ambiguous');

  // 3.2 Preserve decimal commas (not 3 trailing digits)
  const dec1 = normalizeNumberValue('3,5');
  assert.strictEqual(dec1.value, 3.5, '3,5 must parse to 3.5');

  const dec2 = normalizeNumberValue('1250,50');
  assert.strictEqual(dec2.value, 1250.5, '1250,50 must parse to 1250.5');

  const dec3 = normalizeNumberValue('0,05');
  assert.strictEqual(dec3.value, 0.05, '0,05 must parse to 0.05');

  const dec4 = normalizeNumberValue('€ 99,9');
  assert.strictEqual(dec4.value, 99.9, '€ 99,9 must parse to 99.9');

  // 3.3 Single dot with 3 digits in EU locale -> AMBIGUOUS_NUMBER
  const euAmb1 = normalizeNumberValue('1.000', 'de-DE');
  assert.strictEqual(euAmb1.error?.code, 'AMBIGUOUS_NUMBER', '1.000 in de-DE must be ambiguous');

  const euAmb2 = normalizeNumberValue('12.345', { locale: 'FR' });
  assert.strictEqual(euAmb2.error?.code, 'AMBIGUOUS_NUMBER', '12.345 in FR must be ambiguous');

  const euAmb3 = normalizeNumberValue('100.000', 'ES');
  assert.strictEqual(euAmb3.error?.code, 'AMBIGUOUS_NUMBER', '100.000 in ES must be ambiguous');

  const euAmb4 = normalizeNumberValue('1.000', 'it-IT');
  assert.strictEqual(euAmb4.error?.code, 'AMBIGUOUS_NUMBER', '1.000 in it-IT must be ambiguous');

  const euAmb5 = normalizeNumberValue('1.250', 'EU');
  assert.strictEqual(euAmb5.error?.code, 'AMBIGUOUS_NUMBER', '1.250 in EU must be ambiguous');

  // 3.4 Single dot in EU locale but NOT 3 digits -> parses as decimal point
  const euDec1 = normalizeNumberValue('3.5', 'de-DE');
  assert.strictEqual(euDec1.value, 3.5, '3.5 in de-DE must parse to 3.5');

  const euDec2 = normalizeNumberValue('1250.50', 'de-DE');
  assert.strictEqual(euDec2.value, 1250.5, '1250.50 in de-DE must parse to 1250.5');

  // 3.5 Single dot in US/non-EU locale -> parses as standard decimal point
  const usDec1 = normalizeNumberValue('1.000', 'en-US');
  assert.strictEqual(usDec1.value, 1, '1.000 in en-US parses as 1');

  const defaultDec1 = normalizeNumberValue('1.000');
  assert.strictEqual(defaultDec1.value, 1, '1.000 without locale parses as 1');

  const usDec2 = normalizeNumberValue('1250.50');
  assert.strictEqual(usDec2.value, 1250.5, '1250.50 parses as 1250.5');

  console.log('   ✓ normalizeNumberValue handles decimal commas and EU dot ambiguity accurately\n');

  // =========================================================================
  // 4. duplicate-detector: filter out stale DUPLICATE_ROW warnings
  // =========================================================================
  console.log('4. Testing detectDuplicatesAcrossRows stale warning filtering...');

  // Row 2 previously had DUPLICATE_ROW warning, but is now unique
  const rows: Array<{
    sourceRowNumber: number;
    effectiveData: Record<string, any>;
    warnings: RowWarning[];
  }> = [
    {
      sourceRowNumber: 1,
      effectiveData: { id: 'STU-001', name: 'Alice' },
      warnings: [],
    },
    {
      sourceRowNumber: 2,
      effectiveData: { id: 'STU-002', name: 'Bob' }, // Unique now
      warnings: [
        {
          code: 'CUSTOM_OTHER_WARNING',
          message: 'Other warning to preserve',
        },
        {
          code: 'DUPLICATE_ROW',
          message: 'Stale duplicate warning from previous run',
          referenceRowNumbers: [1],
        },
      ],
    },
    {
      sourceRowNumber: 3,
      effectiveData: { id: 'STU-001', name: 'Alice' }, // Duplicate of Row 1
      warnings: [
        {
          code: 'DUPLICATE_ROW',
          message: 'Stale duplicate warning',
          referenceRowNumbers: [1],
        },
      ],
    },
  ];

  const results = detectDuplicatesAcrossRows(rows);

  // Row 1: unique
  assert.strictEqual(results[0].isDuplicate, false);
  assert.strictEqual(results[0].warnings.length, 0);

  // Row 2: was given stale DUPLICATE_ROW, but data is unique now
  assert.strictEqual(results[1].isDuplicate, false);
  assert.strictEqual(results[1].warnings.length, 1, 'Stale DUPLICATE_ROW must be removed');
  assert.strictEqual(
    results[1].warnings[0].code,
    'CUSTOM_OTHER_WARNING',
    'Non-duplicate warnings must be preserved'
  );

  // Row 3: duplicate of Row 1; must have exactly ONE DUPLICATE_ROW warning, not stacked
  assert.strictEqual(results[2].isDuplicate, true);
  assert.strictEqual(results[2].warnings.length, 1, 'Must have exactly 1 DUPLICATE_ROW warning');
  assert.strictEqual(results[2].warnings[0].code, 'DUPLICATE_ROW');
  assert.deepStrictEqual(results[2].warnings[0].referenceRowNumbers, [1]);

  console.log('   ✓ detectDuplicatesAcrossRows filters out existing DUPLICATE_ROW warnings correctly\n');

  console.log('🎉 ALL BACKEND UNIT & VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Tests failed:', err);
  process.exit(1);
});
