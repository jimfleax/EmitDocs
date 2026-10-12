import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateFixtures() {
  console.log('Generating test PDF fixtures in test/fixtures/...');

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
  // Split "{{student_reg_number}}" across 4 drawing operations
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

  console.log('Successfully generated all test fixtures!');
}

generateFixtures().catch((err) => {
  console.error('Fixture generation failed:', err);
  process.exit(1);
});
