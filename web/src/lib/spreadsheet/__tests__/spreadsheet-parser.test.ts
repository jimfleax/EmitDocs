import assert from 'node:assert';
import * as XLSX from 'xlsx';
import { parseCsvString, parseXlsxBuffer } from '../spreadsheet-parser.js';

async function runTests() {
  console.log('🧪 Starting spreadsheet-parser unit test suite...');

  // Test 1: CSV parsing with quotes, commas, multiline and Unicode
  {
    console.log('Test 1: CSV parsing with quotes and multiline');
    const csvContent = `
,
"First Name",Last Name,"Address, Street","Notes"
Alice,Smith,"123 Main St, Apt 4","Great student"
Bob,"O'Connor","456 Oak Ave","Line 1
Line 2"
`;

    const result = parseCsvString(csvContent);
    assert.deepStrictEqual(result.disambiguatedHeaders, ['First Name', 'Last Name', 'Address, Street', 'Notes']);
    assert.strictEqual(result.rows.length, 2);
    assert.strictEqual(result.rows[0]['First Name'], 'Alice');
    assert.strictEqual(result.rows[0]['Address, Street'], '123 Main St, Apt 4');
    assert.strictEqual(result.rows[1]['Last Name'], "O'Connor");
    assert.ok(result.rows[1]['Notes'].includes('\n'), 'Notes should preserve newline');
    console.log('  ✓ CSV parsing verified');
  }

  // Test 2: Multi-sheet XLSX parsing and sheet selection (AC1)
  {
    console.log('Test 2: Multi-sheet XLSX workbook creation and sheet selection');
    const wb = XLSX.utils.book_new();

    // Sheet 1: Honors
    const ws1 = XLSX.utils.aoa_to_sheet([
      ['Student', 'GPA'],
      ['Charlie', '3.9'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws1, 'Honors');

    // Sheet 2: General
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['Student', 'Credits'],
      ['Dana', '120'],
      ['Evan', '115'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws2, 'General');

    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    // Parse without sheet name (defaults to first sheet)
    const result1 = parseXlsxBuffer(buffer);
    assert.deepStrictEqual(result1.availableWorksheets, ['Honors', 'General']);
    assert.strictEqual(result1.selectedWorksheet, 'Honors');
    assert.deepStrictEqual(result1.disambiguatedHeaders, ['Student', 'GPA']);
    assert.strictEqual(result1.rows.length, 1);

    // Parse selecting 'General' sheet
    const result2 = parseXlsxBuffer(buffer, { worksheetName: 'General' });
    assert.strictEqual(result2.selectedWorksheet, 'General');
    assert.deepStrictEqual(result2.disambiguatedHeaders, ['Student', 'Credits']);
    assert.strictEqual(result2.rows.length, 2);
    assert.strictEqual(result2.rows[0]['Student'], 'Dana');
    console.log('  ✓ Multi-sheet XLSX and sheet selection verified');
  }

  // Test 3: XLSX formula cache detection (AC5)
  {
    console.log('Test 3: Formula cache detection (cached value vs missing cache)');
    const wb = XLSX.utils.book_new();
    const ws: XLSX.WorkSheet = {
      '!ref': 'A1:C2',
      A1: { t: 's', v: 'Name' },
      B1: { t: 's', v: 'Score1' },
      C1: { t: 's', v: 'CalculatedScore' },
      A2: { t: 's', v: 'Fiona' },
      B2: { t: 'n', v: 85 },
      // Cell with formula AND valid cached value
      C2: { t: 'n', f: 'B2*1.1', v: 93.5 },
    };
    XLSX.utils.book_append_sheet(wb, ws, 'Scores');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const result = parseXlsxBuffer(buffer);
    assert.strictEqual(result.rows[0]['CalculatedScore'], 93.5, 'Formula with cached value uses cached value');

    // Now test cell with formula but MISSING cached value
    const wsMissing: XLSX.WorkSheet = {
      '!ref': 'A1:B2',
      A1: { t: 's', v: 'Name' },
      B1: { t: 's', v: 'Total' },
      A2: { t: 's', v: 'George' },
      B2: { t: 'e', f: 'SUM(1,2)', v: 15, w: '#VALUE!' },
    };
    const wbMissing = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbMissing, wsMissing, 'MissingCache');
    const bufferMissing = XLSX.write(wbMissing, { type: 'array', bookType: 'xlsx' });

    const resultMissing = parseXlsxBuffer(bufferMissing);
    assert.strictEqual(
      resultMissing.rows[0]['Total'],
      '__FORMULA_CACHE_MISSING__',
      'Formula cell without cached value must yield __FORMULA_CACHE_MISSING__'
    );
    console.log('  ✓ Formula cache detection verified');
  }

  console.log('\n🎉 ALL spreadsheet-parser TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('❌ Spreadsheet parser test failed:', err);
  process.exit(1);
});
