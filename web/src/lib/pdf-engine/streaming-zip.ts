/**
 * @file streaming-zip.ts
 * @description Client-side streaming ZIP packaging wrapper using client-zip with STORE mode (PRD-CORE-08).
 * @architecture Generates standards-compliant ZIP archives directly in browser memory or streams to disk
 *               via FileSystem Access API with zero server buffering and flat RAM usage.
 */

import { makeZip } from "client-zip";

export interface ZipInputFile {
  name: string;
  input: Uint8Array | ArrayBuffer | Blob | ReadableStream<Uint8Array>;
  lastModified?: Date | number;
  size?: number;
}

/**
 * Creates a streaming ZIP archive from an async (or sync) iterable of input files.
 * Uses client-zip makeZip which operates in STORE mode (compression method 0x0000).
 *
 * @param files Async or sync iterable yielding `{ name, input, lastModified?, size? }`.
 * @returns ReadableStream<Uint8Array> emitting raw ZIP bytes in chunks.
 */
export function createStreamingZip(
  files: AsyncIterable<ZipInputFile> | Iterable<ZipInputFile>
): ReadableStream<Uint8Array> {
  // makeZip takes an iterable or async iterable and returns a ReadableStream<Uint8Array>
  return makeZip(files);
}

/**
 * Saves a ReadableStream directly to disk using the FileSystem Access API (`window.showSaveFilePicker`).
 * Prevents allocating memory for multi-hundred-megabyte or gigabyte archives in browser heap.
 *
 * @param stream ReadableStream of Uint8Array chunks.
 * @param suggestedFilename Default filename proposed in the save file dialog.
 * @param onProgress Optional callback reporting cumulative bytes written.
 * @returns Promise<boolean> true if stream saved successfully, false if unsupported or cancelled by user.
 */
export async function saveZipStreamWithPicker(
  stream: ReadableStream<Uint8Array>,
  suggestedFilename: string,
  onProgress?: (bytesWritten: number) => void
): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !("showSaveFilePicker" in window) ||
    typeof (window as any).showSaveFilePicker !== "function"
  ) {
    return false;
  }

  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: suggestedFilename,
      types: [
        {
          description: "ZIP Archive",
          accept: {
            "application/zip": [".zip"],
          },
        },
      ],
    });

    const writable = await handle.createWritable();
    let totalBytesWritten = 0;

    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.length > 0) {
          await writable.write(value);
          totalBytesWritten += value.length;
          onProgress?.(totalBytesWritten);
        }
      }
      await writable.close();
      return true;
    } catch (writeErr) {
      try {
        await writable.abort();
      } catch {
        // Ignored
      }
      throw writeErr;
    }
  } catch (err: any) {
    if (err?.name === "AbortError") {
      // User cancelled picker dialog
      return false;
    }
    // Re-throw if it wasn't a clean abort
    console.warn("Failed to stream ZIP via FileSystem Access API, falling back:", err);
    return false;
  }
}

/**
 * Progressive fallback: Combines accumulated chunks into a Blob and triggers native browser file download.
 *
 * @param chunks Array of Uint8Array chunks emitted by streaming ZIP generator.
 * @param filename File name for the download anchor.
 */
export function saveZipChunksAsBlob(chunks: Uint8Array[], filename: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const blob = new Blob(chunks as any[], { type: "application/zip" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();

  // Clean up anchor and revoke object URL
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}
