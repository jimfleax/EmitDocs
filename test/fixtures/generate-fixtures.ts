/**
 * @file generate-fixtures.ts
 * @description Generates synthetic PDF test fixtures with tokens, rotation variants, multi-page layouts, valid reference corpora, and unsupported edge cases for the test suite.
 * @architecture Used offline or during test setup to produce binary test PDFs stored in test/fixtures/ consumed by acceptance tests.
 * @agent_note Run via `npx tsx test/fixtures/generate-fixtures.ts` whenever test fixtures need regeneration or new test cases are added.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const requireModule = createRequire(import.meta.url);

/**
 * @desc Helper to resolve pdf-lib module from local or web workspace node_modules.
 * @returns {any} Loaded pdf-lib module export.
 */
function getPdfLib() {
  try {
    return requireModule('pdf-lib');
  } catch {
    const webRequire = createRequire(path.join(__dirname, '../../web/package.json'));
    return webRequire('pdf-lib');
  }
}

const { PDFDocument, StandardFonts, degrees } = getPdfLib();

/**
 * @desc Helper to resolve xlsx module from local or web workspace node_modules.
 * @returns {any} Loaded xlsx module export.
 */
function getXLSX() {
  try {
    return requireModule('xlsx');
  } catch {
    const webRequire = createRequire(path.join(__dirname, '../../web/package.json'));
    return webRequire('xlsx');
  }
}

/**
 * @desc    Generates standard valid and unsupported edge-case fixtures.
 * @returns {Promise<void>} Resolves when all fixture files are written to test/fixtures/
 * @throws  {Error} If file system write operations or PDF generation fail
 */
async function generateFixtures() {
  console.log('Generating test fixtures in test/fixtures/...');

  const validDir = path.join(__dirname, 'valid');
  const unsupportedDir = path.join(__dirname, 'unsupported');

  fs.mkdirSync(validDir, { recursive: true });
  fs.mkdirSync(unsupportedDir, { recursive: true });

  // =========================================================================
  // Standard Root Fixtures (Retained for backwards compatibility)
  // =========================================================================

  // 1. Single Page with Standard Tokens
  const doc1 = await PDFDocument.create();
  const font1 = await doc1.embedFont(StandardFonts.Helvetica);
  const page1 = doc1.addPage([595, 842]);
  page1.drawText('Certificate of Completion', { x: 150, y: 700, size: 24, font: font1 });
  page1.drawText('Presented to: {{fullName}}', { x: 100, y: 550, size: 16, font: font1 });
  page1.drawText('Issued on: {{issueDate}}', { x: 100, y: 450, size: 14, font: font1 });
  const bytes1 = await doc1.save();
  fs.writeFileSync(path.join(__dirname, 'single-page-token.pdf'), bytes1);

  // 2. Fragmented Tokens (split across drawing commands)
  const doc2 = await PDFDocument.create();
  const font2 = await doc2.embedFont(StandardFonts.Helvetica);
  const page2 = doc2.addPage([595, 842]);
  page2.drawText('Order Summary', { x: 200, y: 750, size: 20, font: font2 });
  page2.drawText('Student ID: {{', { x: 100, y: 600, size: 14, font: font2 });
  page2.drawText('student_', { x: 175, y: 600, size: 14, font: font2 });
  page2.drawText('reg_', { x: 230, y: 600, size: 14, font: font2 });
  page2.drawText('number}}', { x: 260, y: 600, size: 14, font: font2 });
  const bytes2 = await doc2.save();
  fs.writeFileSync(path.join(__dirname, 'fragmented-token.pdf'), bytes2);

  // 3. Rotated Pages (0°, 90°, 180°, 270°)
  const doc3 = await PDFDocument.create();
  const font3 = await doc3.embedFont(StandardFonts.Helvetica);

  const p0 = doc3.addPage([595, 842]);
  p0.setRotation(degrees(0));
  p0.drawText('Page 1 - Rotation 0', { x: 100, y: 700, size: 16, font: font3 });

  const p90 = doc3.addPage([595, 842]);
  p90.setRotation(degrees(90));
  p90.drawText('Page 2 - Rotation 90', { x: 100, y: 700, size: 16, font: font3 });

  const p180 = doc3.addPage([595, 842]);
  p180.setRotation(degrees(180));
  p180.drawText('Page 3 - Rotation 180', { x: 100, y: 700, size: 16, font: font3 });

  const p270 = doc3.addPage([595, 842]);
  p270.setRotation(degrees(270));
  p270.drawText('Page 4 - Rotation 270', { x: 100, y: 700, size: 16, font: font3 });

  const bytes3 = await doc3.save();
  fs.writeFileSync(path.join(__dirname, 'rotated-pages.pdf'), bytes3);

  // 4. Multipage PDF
  const doc4 = await PDFDocument.create();
  const font4 = await doc4.embedFont(StandardFonts.Helvetica);
  const mp1 = doc4.addPage([595, 842]);
  mp1.drawText('Page 1: {{pageOneKey}}', { x: 50, y: 500, size: 14, font: font4 });
  const mp2 = doc4.addPage([595, 842]);
  mp2.drawText('Page 2: {{pageTwoKey}}', { x: 50, y: 500, size: 14, font: font4 });
  const mp3 = doc4.addPage([595, 842]);
  mp3.drawText('Page 3: {{pageThreeKey}}', { x: 50, y: 500, size: 14, font: font4 });
  const bytes4 = await doc4.save();
  fs.writeFileSync(path.join(__dirname, 'multipage.pdf'), bytes4);

  // =========================================================================
  // Slice 4: Valid Corpus (test/fixtures/valid/)
  // =========================================================================

  // Valid standard template
  fs.writeFileSync(path.join(validDir, 'standard-template.pdf'), bytes1);

  // Valid recipients CSV
  const validCsvContent = [
    'fullName,issueDate,certificateId',
    'Alice Johnson,2026-10-18,CERT-001',
    'Bob Smith,2026-10-19,CERT-002',
    'Charlie Brown,2026-10-20,CERT-003',
  ].join('\n');
  fs.writeFileSync(path.join(validDir, 'valid-recipients.csv'), validCsvContent);

  // Valid recipients XLSX
  try {
    const XLSX = getXLSX();
    const wb = XLSX.utils.book_new();
    const wsData = [
      ['fullName', 'issueDate', 'certificateId'],
      ['Alice Johnson', '2026-10-18', 'CERT-001'],
      ['Bob Smith', '2026-10-19', 'CERT-002'],
      ['Charlie Brown', '2026-10-20', 'CERT-003'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Recipients');
    const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(path.join(validDir, 'valid-recipients.xlsx'), xlsxBuffer);
  } catch (err) {
    console.warn('Notice: XLSX generation skipped or failed:', err);
  }

  // =========================================================================
  // Slice 4: Unsupported Corpus (test/fixtures/unsupported/)
  // =========================================================================

  // 1. corrupt-header.pdf (invalid magic bytes)
  const corruptHeaderPdf = Buffer.from(
    '%NOT_A_PDF_INVALID_MAGIC_BYTES_12345\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n'
  );
  fs.writeFileSync(path.join(unsupportedDir, 'corrupt-header.pdf'), corruptHeaderPdf);

  // 2. password-encrypted.pdf (encrypted PDF)
  const passwordEncryptedPdf = Buffer.from(
    `%PDF-1.4
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj
2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj
3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 612 792]
>>
endobj
4 0 obj
<<
  /Filter /Standard
  /V 1
  /R 2
  /O <0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef>
  /U <0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef>
  /P -44
>>
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000189 00000 n 
trailer
<<
  /Size 5
  /Root 1 0 R
  /Encrypt 4 0 R
  /ID [<0123456789abcdef0123456789abcdef> <0123456789abcdef0123456789abcdef>]
>>
startxref
340
%%EOF
`
  );
  fs.writeFileSync(path.join(unsupportedDir, 'password-encrypted.pdf'), passwordEncryptedPdf);

  // 3. image-only-scan.pdf (pure image raster, no text layer)
  const imageDoc = await PDFDocument.create();
  // 1x1 base64 transparent PNG
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const pngBytes = Buffer.from(pngBase64, 'base64');
  const embeddedPng = await imageDoc.embedPng(pngBytes);
  const scanPage = imageDoc.addPage([595, 842]);
  scanPage.drawImage(embeddedPng, { x: 0, y: 0, width: 595, height: 842 });
  const scanBytes = await imageDoc.save();
  fs.writeFileSync(path.join(unsupportedDir, 'image-only-scan.pdf'), scanBytes);

  // 4. empty-data.csv (0 bytes / empty)
  fs.writeFileSync(path.join(unsupportedDir, 'empty-data.csv'), Buffer.alloc(0));

  // 5. malformed-columns.csv (ragged columns, broken quotes)
  const malformedCsv = [
    'name,email,role',
    '"Alice",alice@example.com,Admin',
    '"Bob",bob@example.com',
    '"Charlie,"charlie@example.com",Engineer,ExtraColumn1,ExtraColumn2',
    '"David,david@example.com,IncompleteQuote',
    'Eve,eve@example.com,User,"ragged',
  ].join('\n');
  fs.writeFileSync(path.join(unsupportedDir, 'malformed-columns.csv'), malformedCsv);

  // 6. corrupted-zip.xlsx (invalid zip)
  const corruptedZip = Buffer.from(
    'PK\x03\x04\x14\x00\x00\x00\x08\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00INVALID_CORRUPTED_ZIP_ARCHIVE_DATA_TRUNCATED'
  );
  fs.writeFileSync(path.join(unsupportedDir, 'corrupted-zip.xlsx'), corruptedZip);

  console.log('Successfully generated all test fixtures!');
}

generateFixtures().catch((err) => {
  console.error('Fixture generation failed:', err);
  process.exit(1);
});
