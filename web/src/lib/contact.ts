/**
 * @file contact.ts
 * @description Centralized contact configuration and mailto URL generators for EmitDocs.
 * @architecture Shared utility layer for user inquiries, security reporting, and legal compliance.
 */

export const CONTACT_EMAIL = "reetabrata.bhandari@gmail.com";

/**
 * Generates an RFC-compliant mailto URL with a URI-encoded subject parameter.
 *
 * @param subject - The subject line for the email.
 * @param email - The recipient email address (defaults to CONTACT_EMAIL).
 * @returns Fully formatted `mailto:` URL.
 */
export function getMailtoUrl(
  subject: string,
  email: string = CONTACT_EMAIL,
): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}

export const EMAIL_SUBJECTS = {
  support: "[EmitDocs] Support Request",
  security: "[EmitDocs] Security & Compliance Report",
  privacy: "[EmitDocs] Privacy & Data Protection Inquiry",
  billing: "[EmitDocs] Billing Inquiry",
  legal: "[EmitDocs] Legal Inquiry & Dispute Resolution",
  creator: "[EmitDocs] Developer Inquiry",
} as const;

export const CONTACT_MAILTO = {
  support: getMailtoUrl(EMAIL_SUBJECTS.support),
  security: getMailtoUrl(EMAIL_SUBJECTS.security),
  privacy: getMailtoUrl(EMAIL_SUBJECTS.privacy),
  billing: getMailtoUrl(EMAIL_SUBJECTS.billing),
  legal: getMailtoUrl(EMAIL_SUBJECTS.legal),
  creator: getMailtoUrl(EMAIL_SUBJECTS.creator),
} as const;
