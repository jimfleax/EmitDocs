/**
 * @file limits.ts
 * @description Hard operational resource caps and ceilings for pilot readiness.
 * @architecture Enforces free-tier and operational guardrails across templates, batches, and Cloudinary storage.
 * @agent_note Do not increase ceilings without updating OpenAPI error documentation and pricing tier schemas.
 */

/**
 * @constant {Object} RESOURCE_LIMITS
 * @description Master dictionary of system operational resource caps and quotas.
 */
export const RESOURCE_LIMITS = {
  MAX_BATCH_ROWS: 5000,
  MAX_TEMPLATE_FILE_SIZE_BYTES: 15 * 1024 * 1024, // 15MB
  MAX_USER_STORAGE_QUOTA_BYTES: 500 * 1024 * 1024, // 500MB
  MAX_BATCHES_PER_USER: 100,
  MAX_TEMPLATES_PER_USER: 50,
} as const;

/**
 * @constant {number} MAX_BATCH_ROWS
 * @description Maximum draft spreadsheet rows permitted per batch.
 */
export const MAX_BATCH_ROWS = RESOURCE_LIMITS.MAX_BATCH_ROWS;

/**
 * @constant {number} MAX_TEMPLATE_FILE_SIZE_BYTES
 * @description Maximum PDF template file size allowed for upload (15MB).
 */
export const MAX_TEMPLATE_FILE_SIZE_BYTES = RESOURCE_LIMITS.MAX_TEMPLATE_FILE_SIZE_BYTES;

/**
 * @constant {number} MAX_USER_STORAGE_QUOTA_BYTES
 * @description Maximum storage quota allocated per tenant (500MB free-tier ceiling).
 */
export const MAX_USER_STORAGE_QUOTA_BYTES = RESOURCE_LIMITS.MAX_USER_STORAGE_QUOTA_BYTES;

/**
 * @constant {number} MAX_BATCHES_PER_USER
 * @description Maximum total active batches per user.
 */
export const MAX_BATCHES_PER_USER = RESOURCE_LIMITS.MAX_BATCHES_PER_USER;

/**
 * @constant {number} MAX_TEMPLATES_PER_USER
 * @description Maximum total templates per user.
 */
export const MAX_TEMPLATES_PER_USER = RESOURCE_LIMITS.MAX_TEMPLATES_PER_USER;
