/**
 * @file worker-setup.ts
 * @description PDF.js web worker setup and standard font data path configuration.
 * @architecture Sets GlobalWorkerOptions.workerSrc to /pdf.worker.min.mjs and exports configured pdfjsLib.
 * @agent_note Essential for rendering PDF canvases in browser without module-loader bundling failures.
 */

import * as pdfjsLib from "pdfjs-dist";

if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  // Use static file served from public/ to bypass Vite module transformation in workers
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

/**
 * URL prefix for PDF.js standard font data files (Foxit/Liberation families).
 * Required by PDF.js v4 to render standard 14 fonts in re-serialized PDFs.
 * Files are copied from pdfjs-dist/standard_fonts/ to public/standard_fonts/.
 */
export const STANDARD_FONT_DATA_URL = "/standard_fonts/";

export { pdfjsLib };
