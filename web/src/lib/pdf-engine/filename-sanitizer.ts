/**
 * @file filename-sanitizer.ts
 * @description Sanitizes recipient metadata to construct safe, clean document filenames inside ZIP archives (PRD-CORE-08).
 * @architecture Enforces Zip Slip immunity, Windows reserved device name neutrality, 120-character clamp,
 *               and collision-safe recipientKey suffixes.
 * @agent_note Neutralizes illegal path sequences and Windows device names (CON, PRN, etc.) to guarantee safe filesystem writes.
 */

const KNOWN_NAME_KEYS = [
  "name",
  "full_name",
  "fullName",
  "recipient_name",
  "recipientName",
  "student_name",
  "studentName",
  "employee_name",
  "employeeName",
  "attendee_name",
  "attendeeName",
  "first_name",
  "firstName",
  "client_name",
  "clientName",
];

const WINDOWS_RESERVED_PATTERN =
  /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;

/**
 * @desc    Sanitizes a raw name string by normalizing Unicode, stripping directory traversal sequences,
 *          replacing illegal filesystem/control characters, neutralizing Windows device names, and clamping length.
 * @param   {string} rawName - Raw string input to sanitize.
 * @param   {number} [maxLength=120] - Maximum allowed length in characters.
 * @returns {string} Sanitized filesystem-safe name string.
 */
export function sanitizeFilenameBase(rawName: string, maxLength = 120): string {
  if (!rawName || typeof rawName !== "string") {
    return "document";
  }

  // 1. Unicode normalization
  let clean = rawName.normalize("NFC");

  // 2. Remove directory traversal sequences
  clean = clean.replace(/\.{2,}/g, "");

  // 3. Replace path separators & illegal filesystem / control characters
  // Illegal in Windows/POSIX: / \ : * ? " < > | and ASCII 0x00-0x1F, 0x7F-0x9F
  // eslint-disable-next-line no-control-regex
  clean = clean.replace(/[/\\:*?"<>|\x00-\x1f\x7f-\x9f]/g, "_");

  // 4. Collapse spaces and underscores
  clean = clean.replace(/[\s_]+/g, "_");

  // 5. Trim leading and trailing underscores and dots
  clean = clean.replace(/^[._]+|[._]+$/g, "");

  // 6. Handle Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
  if (WINDOWS_RESERVED_PATTERN.test(clean)) {
    clean = `doc_${clean}`;
  }

  // 7. Fallback if empty after sanitization
  if (!clean) {
    clean = "document";
  }

  // 8. Clamp length respecting multi-byte characters
  if (clean.length > maxLength) {
    clean = Array.from(clean)
      .slice(0, maxLength)
      .join("")
      .replace(/[._]+$/, "");
    if (!clean) clean = "document";
  }

  return clean;
}

/**
 * @desc    Auto-detects primary recipient name from effectiveData and constructs
 *          a collision-free, path-safe filename in the format: `[Sanitized_Name]_[recipientKey].pdf`.
 * @param   {Record<string, unknown> | null | undefined} effectiveData - Dictionary of recipient field key-values.
 * @param   {string} recipientKey - Unique identifier for the recipient row.
 * @param   {string} [fallbackDocName="document"] - Fallback base document name if no name property is detected.
 * @returns {string} Path-safe sanitized PDF filename.
 */
export function sanitizeRecipientFilename(
  effectiveData: Record<string, unknown> | null | undefined,
  recipientKey: string,
  fallbackDocName = "document",
): string {
  let detectedName: string | null = null;

  if (effectiveData && typeof effectiveData === "object") {
    // Check known name keys first
    for (const key of KNOWN_NAME_KEYS) {
      const val = effectiveData[key];
      if (typeof val === "string" && val.trim().length > 0) {
        detectedName = val.trim();
        break;
      }
    }

    // If still not found, check case-insensitive match for name keys
    if (!detectedName) {
      for (const [k, v] of Object.entries(effectiveData)) {
        if (typeof v === "string" && v.trim().length > 0 && /name/i.test(k)) {
          detectedName = v.trim();
          break;
        }
      }
    }

    // If still not found, pick first non-empty string property
    if (!detectedName) {
      for (const v of Object.values(effectiveData)) {
        if (typeof v === "string" && v.trim().length > 0) {
          detectedName = v.trim();
          break;
        }
      }
    }
  }

  const baseName = sanitizeFilenameBase(detectedName || fallbackDocName);
  const cleanKey =
    String(recipientKey || "").replace(/[^a-zA-Z0-9_-]/g, "_") || "item";

  return `${baseName}_${cleanKey}.pdf`;
}
