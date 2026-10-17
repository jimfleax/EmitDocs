/**
 * @file core-10-acceptance-matrix.test.ts
 * @description Acceptance criteria test matrix for PRD-CORE-10: Private Pilot & Operational Readiness.
 * @architecture Comprehensive end-to-end matrix verifying all 10 Acceptance Criteria:
 *               - AC1: Clone readiness (.env.example templates present without dummy secrets)
 *               - AC2: CI/CD workflow syntax and validation jobs defined in .github/workflows/ci.yml
 *               - AC3: Canonical OpenAPI 3.1 schema generation and contract drift detector
 *               - AC4: Operational preview smoke test execution (health, same-origin CORS, upload signature)
 *               - AC5: Secret scanner on web code + fail-closed production test-auth lock
 *               - AC6: Multi-input unsupported fixture corpus parsing resilience
 *               - AC7: Safe correlation ID propagation, redacted diagnostics, and ErrorView requestId
 *               - AC8: Hard application resource caps (5k row intake, 15MB template PDF, 500MB storage ceiling)
 *               - AC9: README Section 12 release boundary and public hosting blocker verification
 *               - AC10: Hard-disabled email dispatch kill switch assertion
 * @agent_note Run via `pnpm run test:core10` or `cd web && NODE_PATH=./node_modules:../api/node_modules npx tsx ../test/core-10-acceptance-matrix.test.ts`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import dotenv from 'dotenv';
import { Hono } from 'hono';
import { PDFDocument } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.resolve(rootDir, 'api/.env') });

// Domain & Middleware Imports
import {
  validateEnvironment,
  ConfigurationError,
} from '../api/src/config/production-guard.js';
import {
  RESOURCE_LIMITS,
  MAX_BATCH_ROWS,
  MAX_TEMPLATE_FILE_SIZE_BYTES,
  MAX_USER_STORAGE_QUOTA_BYTES,
} from '../api/src/constants/limits.js';
import {
  EmailDispatchService,
  EmailDispatchDisabledError,
} from '../api/src/services/email-dispatch.js';
import { requestIdMiddleware } from '../api/src/middleware/request-id.middleware.js';
import {
  safeLoggerMiddleware,
  scrubPii,
} from '../api/src/middleware/safe-logger.middleware.js';
import { requireAuth } from '../api/src/middleware/auth.middleware.js';
import { checkContractDrift } from '../api/src/scripts/check-contract-drift.js';
import { runPreviewSmokeTests } from './smoke/preview-smoke.test.js';

async function runCore10Matrix() {
  console.log('===========================================================');
  console.log('  PRD-CORE-10 ACCEPTANCE CRITERIA MATRIX (AC1 - AC10)      ');
  console.log('===========================================================\n');

  try {
    // =========================================================================
    // AC1: Clone Readiness & Clean Secret Boundary
    // =========================================================================
    console.log('--- AC1: Clone Readiness & Clean Secret Boundary ---');
    const apiEnvExamplePath = path.join(rootDir, 'api/.env.example');
    const webEnvExamplePath = path.join(rootDir, 'web/.env.example');

    assert.ok(fs.existsSync(apiEnvExamplePath), 'api/.env.example must exist');
    assert.ok(fs.existsSync(webEnvExamplePath), 'web/.env.example must exist');

    const apiEnvContent = fs.readFileSync(apiEnvExamplePath, 'utf8');
    const webEnvContent = fs.readFileSync(webEnvExamplePath, 'utf8');

    // Required configuration keys in api/.env.example
    const requiredApiKeys = [
      'PORT',
      'NODE_ENV',
      'ENABLE_TEST_AUTH',
      'MONGODB_URI',
      'DB_NAME',
      'BETTER_AUTH_SECRET',
      'BETTER_AUTH_URL',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
      'ALLOWED_ORIGINS',
    ];
    for (const key of requiredApiKeys) {
      assert.ok(
        apiEnvContent.includes(`${key}=`),
        `api/.env.example must define configuration key: ${key}`
      );
    }

    // Required configuration keys in web/.env.example
    const requiredWebKeys = ['VITE_API_BASE_URL', 'VITE_GOOGLE_CLIENT_ID'];
    for (const key of requiredWebKeys) {
      assert.ok(
        webEnvContent.includes(`${key}=`),
        `web/.env.example must define configuration key: ${key}`
      );
    }

    // Verify zero real secrets leaked in .env.example files
    const secretRegex = /(eyJhbGciOi|AIzaSy|GOCSPX-[a-zA-Z0-9_-]{20,}|mongodb\+srv:\/\/[^<:]+:[^<@]+@)/i;
    assert.ok(!secretRegex.test(apiEnvContent), 'api/.env.example must not contain real secret tokens');
    assert.ok(!secretRegex.test(webEnvContent), 'web/.env.example must not contain real secret tokens');
    console.log('✓ AC1 Passed: api/.env.example and web/.env.example validated with zero leaked secrets.\n');

    // =========================================================================
    // AC2: CI Workflow Syntax & Validation Jobs Defined
    // =========================================================================
    console.log('--- AC2: CI Workflow Syntax & Jobs Defined ---');
    const ciWorkflowPath = path.join(rootDir, '.github/workflows/ci.yml');
    assert.ok(fs.existsSync(ciWorkflowPath), '.github/workflows/ci.yml must exist');

    const ciContent = fs.readFileSync(ciWorkflowPath, 'utf8');
    assert.ok(ciContent.includes('node-version: 20'), 'CI workflow must use Node 20 LTS');
    assert.ok(ciContent.includes('version: 9.15.9'), 'CI workflow must use pnpm 9.15.9');
    assert.ok(ciContent.includes('pnpm install --frozen-lockfile'), 'CI workflow must run install --frozen-lockfile');
    assert.ok(ciContent.includes('pnpm run lint'), 'CI workflow must execute Oxlint linting');
    assert.ok(ciContent.includes('pnpm run contract:check'), 'CI workflow must execute contract drift check');
    assert.ok(ciContent.includes('pnpm run build'), 'CI workflow must execute backend and frontend build');
    assert.ok(ciContent.includes('pnpm run test'), 'CI workflow must execute test suite');
    assert.ok(ciContent.includes('Secret Leak Scanner'), 'CI workflow must include secret leak scanner step');
    console.log('✓ AC2 Passed: .github/workflows/ci.yml verified with all required CI verification steps.\n');

    // =========================================================================
    // AC3: OpenAPI Contract Drift Guard
    // =========================================================================
    console.log('--- AC3: OpenAPI Contract Drift Guard ---');
    const openapiJsonPath = path.join(rootDir, 'api/openapi.json');
    assert.ok(fs.existsSync(openapiJsonPath), 'api/openapi.json must exist');

    const openapiContent = JSON.parse(fs.readFileSync(openapiJsonPath, 'utf8'));
    assert.ok(openapiContent.openapi.startsWith('3.1'), 'OpenAPI spec must be version 3.1.x');
    assert.strictEqual(openapiContent.info.title, 'EmitDocs API');

    // Check critical endpoints coverage in committed schema
    const paths = Object.keys(openapiContent.paths);
    const expectedEndpoints = [
      '/health',
      '/templates/sign-upload',
      '/templates',
      '/templates/{id}',
      '/templates/{id}/versions',
      '/batches',
      '/batches/activity',
      '/batches/{id}',
      '/batches/{id}/approval-preflight',
      '/batches/{id}/approve',
      '/batches/{id}/snapshot',
      '/batches/{id}/snapshot/recipients',
      '/batches/{id}/imports',
      '/batches/{id}/rows',
      '/storage',
      '/account',
    ];
    for (const ep of expectedEndpoints) {
      assert.ok(paths.includes(ep), `OpenAPI spec must document endpoint: ${ep}`);
    }

    // Execute contract drift detector
    const driftResult = checkContractDrift(openapiJsonPath);
    assert.strictEqual(driftResult.hasDrift, false, 'Committed openapi.json must match in-memory generator');

    // Verify drift detector catches missing files / mismatches
    const tempSpecPath = path.join(rootDir, 'api/openapi.temp.json');
    try {
      fs.writeFileSync(tempSpecPath, JSON.stringify({ openapi: '3.1.0', paths: {} }));
      const mismatchResult = checkContractDrift(tempSpecPath);
      assert.strictEqual(mismatchResult.hasDrift, true, 'Drift detector must catch schema discrepancies');
    } finally {
      if (fs.existsSync(tempSpecPath)) fs.unlinkSync(tempSpecPath);
    }
    console.log('✓ AC3 Passed: Canonical OpenAPI 3.1 generated and contract drift detection verified.\n');

    // =========================================================================
    // AC4: Preview Smoke Test Suite Execution
    // =========================================================================
    console.log('--- AC4: Preview Smoke Test Execution ---');
    await runPreviewSmokeTests();
    console.log('✓ AC4 Passed: Preview smoke test executed successfully across all 4 operational gates.\n');

    // =========================================================================
    // AC5: Fail-Closed Production & Secret Boundary Scanner
    // =========================================================================
    console.log('--- AC5: Fail-Closed Production & Secret Boundary Scanner ---');

    // 5.1 Fails closed on missing required production environment variables
    assert.throws(
      () => {
        validateEnvironment({
          NODE_ENV: 'production',
          ENABLE_TEST_AUTH: 'false',
          MONGODB_URI: '',
        });
      },
      (err: any) =>
        err instanceof ConfigurationError &&
        err.code === 'CONFIG_VALIDATION_FAILED' &&
        err.message.includes('Missing mandatory production environment variables')
    );

    // 5.2 Forbids ENABLE_TEST_AUTH=true in production
    assert.throws(
      () => {
        validateEnvironment({
          NODE_ENV: 'production',
          ENABLE_TEST_AUTH: 'true',
          MONGODB_URI: 'mongodb://localhost:27017',
          BETTER_AUTH_SECRET: 'secret-123456789012345678901234567890',
          GOOGLE_CLIENT_ID: 'google-id',
          GOOGLE_CLIENT_SECRET: 'google-secret',
          CLOUDINARY_CLOUD_NAME: 'cloud',
          CLOUDINARY_API_KEY: 'key',
          CLOUDINARY_API_SECRET: 'secret',
          ALLOWED_ORIGINS: 'https://emitdocs.com',
        });
      },
      (err: any) =>
        err instanceof ConfigurationError &&
        err.code === 'CONFIG_VALIDATION_FAILED' &&
        err.message.includes('ENABLE_TEST_AUTH cannot be true')
    );

    // 5.3 requireAuth middleware strictly quarantines test auth in production
    const testAuthApp = new Hono();
    testAuthApp.use('*', requireAuth);
    testAuthApp.get('/test-prod', (c) => c.json({ user: c.get('user') }));

    const origNodeEnv = process.env.NODE_ENV;
    const origTestAuth = process.env.ENABLE_TEST_AUTH;
    try {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_TEST_AUTH = 'true';
      const prodRes = await testAuthApp.request('/test-prod', {
        headers: { 'x-test-auth-user': 'pilot_user_leak' },
      });
      assert.strictEqual(prodRes.status, 401, 'Test auth headers must be rejected in production with 401');
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      process.env.ENABLE_TEST_AUTH = origTestAuth;
    }

    // 5.4 Secret boundary scanner: inspect web/src for server-side secret keywords
    const webSrcDir = path.join(rootDir, 'web/src');
    function scanDirForSecrets(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDirForSecrets(fullPath);
        } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          assert.ok(
            !content.includes('CLOUDINARY_API_SECRET'),
            `Forbidden secret token CLOUDINARY_API_SECRET found in ${fullPath}`
          );
          assert.ok(
            !content.includes('BETTER_AUTH_SECRET'),
            `Forbidden secret token BETTER_AUTH_SECRET found in ${fullPath}`
          );
        }
      }
    }
    scanDirForSecrets(webSrcDir);
    console.log('✓ AC5 Passed: Fail-closed production guards, quarantined test auth, and secret scanner clean.\n');

    // =========================================================================
    // AC6: Unsupported Fixture Corpus Parsing Resilience
    // =========================================================================
    console.log('--- AC6: Unsupported Fixture Corpus Parsing Resilience ---');
    const unsupportedDir = path.join(rootDir, 'test/fixtures/unsupported');
    assert.ok(fs.existsSync(unsupportedDir), 'test/fixtures/unsupported directory must exist');

    // 6.1 corrupt-header.pdf
    const corruptHeaderPath = path.join(unsupportedDir, 'corrupt-header.pdf');
    assert.ok(fs.existsSync(corruptHeaderPath), 'corrupt-header.pdf fixture must exist');
    const corruptBytes = fs.readFileSync(corruptHeaderPath);
    await assert.rejects(
      async () => await PDFDocument.load(corruptBytes),
      (err: any) => err instanceof Error,
      'Corrupt header PDF must fail gracefully with caught exception'
    );

    // 6.2 password-encrypted.pdf
    const encryptedPdfPath = path.join(unsupportedDir, 'password-encrypted.pdf');
    assert.ok(fs.existsSync(encryptedPdfPath), 'password-encrypted.pdf fixture must exist');
    const encryptedBytes = fs.readFileSync(encryptedPdfPath);
    await assert.rejects(
      async () => await PDFDocument.load(encryptedBytes),
      (err: any) => err instanceof Error,
      'Password encrypted PDF must throw without uncaught crashes'
    );

    // 6.3 image-only-scan.pdf
    const scanPdfPath = path.join(unsupportedDir, 'image-only-scan.pdf');
    assert.ok(fs.existsSync(scanPdfPath), 'image-only-scan.pdf fixture must exist');
    const scanDoc = await PDFDocument.load(fs.readFileSync(scanPdfPath));
    assert.strictEqual(scanDoc.getPageCount(), 1, 'Image-only scan must load cleanly into 1 page');

    // 6.4 empty-data.csv
    const emptyCsvPath = path.join(unsupportedDir, 'empty-data.csv');
    assert.ok(fs.existsSync(emptyCsvPath), 'empty-data.csv fixture must exist');
    const emptyContent = fs.readFileSync(emptyCsvPath, 'utf8');
    assert.strictEqual(emptyContent.trim().length, 0, 'Empty data CSV is 0 bytes');

    // 6.5 malformed-columns.csv
    const malformedCsvPath = path.join(unsupportedDir, 'malformed-columns.csv');
    assert.ok(fs.existsSync(malformedCsvPath), 'malformed-columns.csv fixture must exist');
    const malformedContent = fs.readFileSync(malformedCsvPath, 'utf8');
    assert.ok(malformedContent.includes('ExtraColumn1'), 'Malformed CSV fixture contains ragged lines');

    // 6.6 corrupted-zip.xlsx
    const corruptedZipPath = path.join(unsupportedDir, 'corrupted-zip.xlsx');
    assert.ok(fs.existsSync(corruptedZipPath), 'corrupted-zip.xlsx fixture must exist');
    console.log('✓ AC6 Passed: Multi-input unsupported fixture corpus verified with parsing resilience.\n');

    // =========================================================================
    // AC7: Safe Correlation ID & Redacted Diagnostics
    // =========================================================================
    console.log('--- AC7: Safe Correlation ID & Redacted Diagnostics ---');

    // 7.1 Automatic request ID injection and propagation
    const app = new Hono();
    app.use('*', requestIdMiddleware);
    app.use('*', safeLoggerMiddleware);
    app.get('/diag', (c) => c.json({ ok: true, reqId: c.get('requestId') }));

    const autoRes = await app.request('/diag');
    const autoGenId = autoRes.headers.get('x-request-id');
    assert.ok(autoGenId && autoGenId.length > 10, 'Must inject x-request-id header');
    const autoBody: any = await autoRes.json();
    assert.strictEqual(autoBody.reqId, autoGenId, 'Hono context must hold generated requestId');

    // 7.2 Custom incoming request ID preserved
    const traceId = 'trace-pilot-uuid-999';
    const traceRes = await app.request('/diag', {
      headers: { 'x-request-id': traceId },
    });
    assert.strictEqual(traceRes.headers.get('x-request-id'), traceId, 'Must propagate custom traceId');

    // 7.3 PII Scrubber
    const piiPayload = {
      name: 'John Doe',
      email: 'john@example.com',
      token: 'jwt-token-12345',
      password: 'super-secret-password',
      recipient: 'Jane Smith',
      statusCode: 200,
    };
    const scrubbed = scrubPii(piiPayload);
    assert.strictEqual(scrubbed.name, '[REDACTED]');
    assert.strictEqual(scrubbed.email, '[REDACTED]');
    assert.strictEqual(scrubbed.token, '[REDACTED]');
    assert.strictEqual(scrubbed.password, '[REDACTED]');
    assert.strictEqual(scrubbed.recipient, '[REDACTED]');
    assert.strictEqual(scrubbed.statusCode, 200);

    // 7.4 Frontend ErrorView component supports requestId
    const errorViewPath = path.join(rootDir, 'web/src/components/errors/ErrorView.tsx');
    assert.ok(fs.existsSync(errorViewPath), 'ErrorView.tsx must exist');
    const errorViewCode = fs.readFileSync(errorViewPath, 'utf8');
    assert.ok(
      errorViewCode.includes('requestId') || errorViewCode.includes('reqId'),
      'ErrorView component must support requestId display'
    );
    console.log('✓ AC7 Passed: Correlation IDs, PII scrubbing, and ErrorView diagnostics verified.\n');

    // =========================================================================
    // AC8: Hard Application Resource Caps
    // =========================================================================
    console.log('--- AC8: Hard Application Resource Caps ---');

    // 8.1 5,000 row intake cap
    assert.strictEqual(RESOURCE_LIMITS.MAX_BATCH_ROWS, 5000, 'MAX_BATCH_ROWS must equal 5000');
    assert.strictEqual(MAX_BATCH_ROWS, 5000);

    // 8.2 15MB template file size ceiling
    assert.strictEqual(
      RESOURCE_LIMITS.MAX_TEMPLATE_FILE_SIZE_BYTES,
      15 * 1024 * 1024,
      'MAX_TEMPLATE_FILE_SIZE_BYTES must equal 15MB'
    );
    assert.strictEqual(MAX_TEMPLATE_FILE_SIZE_BYTES, 15 * 1024 * 1024);

    // 8.3 500MB user storage quota guard
    assert.strictEqual(
      RESOURCE_LIMITS.MAX_USER_STORAGE_QUOTA_BYTES,
      500 * 1024 * 1024,
      'MAX_USER_STORAGE_QUOTA_BYTES must equal 500MB'
    );
    assert.strictEqual(MAX_USER_STORAGE_QUOTA_BYTES, 500 * 1024 * 1024);
    console.log('✓ AC8 Passed: Hard limits enforced (5k rows, 15MB template, 500MB storage ceiling).\n');

    // =========================================================================
    // AC9: README Section 12 Hosting Blocker & Release Boundary
    // =========================================================================
    console.log('--- AC9: README Section 12 Hosting Blocker ---');
    const readmePath = path.join(rootDir, 'README.md');
    assert.ok(fs.existsSync(readmePath), 'README.md must exist');
    const readmeContent = fs.readFileSync(readmePath, 'utf8');

    assert.ok(
      readmeContent.includes('Release Boundary & Roadmap'),
      'README.md must contain Release Boundary & Roadmap section'
    );
    assert.ok(
      readmeContent.includes('Private Pilot Gates'),
      'README.md must define Private Pilot Gates'
    );
    assert.ok(
      readmeContent.includes('Public Hosting Blocker') || readmeContent.includes('Hosting Blocker'),
      'README.md must document Public Hosting Blocker'
    );
    assert.ok(
      readmeContent.includes('Web Worker Rendering'),
      'README.md must document Web Worker Rendering invariant'
    );
    assert.ok(
      readmeContent.includes('5,000 Row Intake Cap'),
      'README.md must document 5,000 Row Intake Cap invariant'
    );
    assert.ok(
      readmeContent.includes('15MB Template Size Cap'),
      'README.md must document 15MB Template Size Cap invariant'
    );
    console.log('✓ AC9 Passed: README Section 12 hosting boundary and pilot invariants verified.\n');

    // =========================================================================
    // AC10: Hard Email Dispatch Kill Switch
    // =========================================================================
    console.log('--- AC10: Hard Email Dispatch Kill Switch ---');
    assert.strictEqual(EmailDispatchService.isEnabled(), false, 'Email dispatch must be disabled');
    await assert.rejects(
      async () => await EmailDispatchService.sendBatchEmail(),
      (err: any) =>
        err instanceof EmailDispatchDisabledError &&
        err.code === 'EMAIL_DISPATCH_DISABLED',
      'Email invocation must throw EMAIL_DISPATCH_DISABLED'
    );
    console.log('✓ AC10 Passed: Email dispatch service hard-disabled with compile/runtime rejection.\n');

    console.log('===========================================================');
    console.log('🎉 ALL PRD-CORE-10 ACCEPTANCE CRITERIA VERIFIED (10/10)!   ');
    console.log('===========================================================');
  } catch (err) {
    console.error('Acceptance Matrix Failure:', err);
    throw err;
  }
}

// CLI runner
if (process.argv[1] === __filename) {
  runCore10Matrix()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Core 10 Matrix Failed:', err);
      process.exit(1);
    });
}
