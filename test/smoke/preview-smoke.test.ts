/**
 * @file preview-smoke.test.ts
 * @description Preview and local operational smoke test suite.
 * @architecture Validates baseline API operational requirements without browser dependencies:
 *               1. Health endpoint response and database connectivity status
 *               2. Same-origin session cookie handling and CORS credentials reflection
 *               3. Authenticated Cloudinary direct-upload signature issuance
 *               4. Fail-safe standardized 404 error responses with x-request-id header propagation
 * @agent_note Run via `pnpm run test:smoke`.
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../api/.env') });

process.env.NODE_ENV = 'test';
process.env.ENABLE_TEST_AUTH = 'true';
process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || 'smoke_better_auth_secret_32_characters_minimum';
process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
process.env.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || 'smoke_test_api_secret_1234567890';
process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || 'smoke_key';
process.env.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'smoke_cloud';

import { honoApp } from '../../api/src/index.js';
import { resolveCorsOrigin } from '../../api/src/lib/origins.js';

export async function runPreviewSmokeTests() {
  console.log('===========================================================');
  console.log('  RUNNING PREVIEW SMOKE TEST SUITE                         ');
  console.log('===========================================================\n');

  try {
    // --- 1. Health & Database Connectivity Check ---
    console.log('--- 1. Testing GET /api/health ---');
    const healthRes = await honoApp.request('/api/health');
    assert.strictEqual(healthRes.status, 200, 'GET /api/health must return HTTP 200');

    const healthBody: any = await healthRes.json();
    assert.strictEqual(healthBody.status, 'ok', "Health payload status must be 'ok'");
    assert.strictEqual(healthBody.success, true, 'Health payload success must be true');
    assert.ok(
      healthBody.database === 'connected' || healthBody.database === 'disconnected',
      `Database status must be connected or disconnected (received: ${healthBody.database})`
    );
    assert.ok(
      typeof healthBody.timestamp === 'string' && !isNaN(Date.parse(healthBody.timestamp)),
      'Health payload must contain valid ISO timestamp'
    );
    console.log(`   ✓ Health endpoint operational (status=${healthBody.status}, db=${healthBody.database})\n`);

    // --- 2. Same-Origin Cookie & CORS Resolution ---
    console.log('--- 2. Testing Same-Origin & CORS Resolution ---');

    // Test CORS resolution function
    const localOrigin = 'http://localhost:5173';
    const resolvedLocal = resolveCorsOrigin(localOrigin);
    assert.strictEqual(resolvedLocal, localOrigin, 'Allowed origin must resolve directly');

    const previewOrigin = 'https://emitdocs-git-preview-myorg.vercel.app';
    const resolvedPreview = resolveCorsOrigin(previewOrigin);
    assert.strictEqual(resolvedPreview, previewOrigin, 'Vercel preview URL must be dynamically allowed');

    const untrustedOrigin = 'https://malicious-site.example.com';
    const resolvedUntrusted = resolveCorsOrigin(untrustedOrigin);
    assert.notStrictEqual(resolvedUntrusted, untrustedOrigin, 'Untrusted origin must not be allowed');

    // Test CORS preflight with credentials
    const preflightRes = await honoApp.request('/api/templates', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
      },
    });
    const allowOrigin = preflightRes.headers.get('access-control-allow-origin');
    const allowCredentials = preflightRes.headers.get('access-control-allow-credentials');
    assert.strictEqual(allowOrigin, 'http://localhost:5173', 'CORS preflight must echo allowed origin');
    assert.strictEqual(allowCredentials, 'true', 'CORS preflight must allow credentials');

    // Test Cookie header handling
    const cookieRes = await honoApp.request('/api/health', {
      headers: {
        Cookie: 'better-auth.session_token=test_smoke_cookie_token_123',
      },
    });
    assert.strictEqual(cookieRes.status, 200, 'Cookie header accepted on health check');
    console.log('   ✓ CORS credentials, origin reflection, and session cookie handling verified\n');

    // --- 3. Cloudinary Upload Signature Issuance ---
    console.log('--- 3. Testing POST /api/templates/sign-upload ---');

    // Unauthenticated request must return 401
    const unauthSignRes = await honoApp.request('/api/templates/sign-upload', {
      method: 'POST',
    });
    assert.strictEqual(unauthSignRes.status, 401, 'Unauthenticated sign-upload must return 401');

    // Authenticated request with test auth
    const testUserId = 'user_smoke_pilot_001';
    const authSignRes = await honoApp.request('/api/templates/sign-upload', {
      method: 'POST',
      headers: {
        'x-test-auth-user': testUserId,
      },
    });
    assert.strictEqual(authSignRes.status, 200, 'Authenticated sign-upload must return 200');

    const signBody: any = await authSignRes.json();
    assert.ok(typeof signBody.signature === 'string' && signBody.signature.length >= 10, 'Must issue valid signature');
    assert.ok(typeof signBody.timestamp === 'number' && signBody.timestamp > 1700000000, 'Must issue valid timestamp');
    assert.strictEqual(signBody.folder, `templates/${testUserId}`, 'Folder must scope to tenant user ID');
    assert.ok(typeof signBody.api_key === 'string' && signBody.api_key.length > 0, 'Must return api_key');
    assert.ok(typeof signBody.cloud_name === 'string' && signBody.cloud_name.length > 0, 'Must return cloud_name');
    console.log(`   ✓ Authenticated upload signature generated (folder=${signBody.folder})\n`);

    // --- 4. Standardized Error JSON & x-request-id Header ---
    console.log('--- 4. Testing Standardized Error JSON & Correlation ID ---');

    // Auto-generated request ID on missing route
    const notFoundRes = await honoApp.request('/api/smoke-missing-route-test');
    assert.strictEqual(notFoundRes.status, 404, 'Non-existent route must return 404');

    const resHeaderId = notFoundRes.headers.get('x-request-id');
    assert.ok(resHeaderId && resHeaderId.length > 10, 'Response must include x-request-id header');

    const errBody: any = await notFoundRes.json();
    assert.strictEqual(errBody.success, false, 'Error response must have success: false');
    assert.ok(errBody.error, 'Error response must have error object');
    assert.strictEqual(errBody.error.code, 'NOT_FOUND', "Error code must be 'NOT_FOUND'");
    assert.strictEqual(errBody.error.requestId, resHeaderId, 'error.requestId must match header x-request-id');
    assert.strictEqual(errBody.error.path, '/api/smoke-missing-route-test', 'error.path must match request path');

    // Propagate custom incoming x-request-id
    const customId = 'smoke-custom-trace-uuid-888';
    const customRes = await honoApp.request('/api/smoke-missing-route-test', {
      headers: { 'x-request-id': customId },
    });
    assert.strictEqual(customRes.headers.get('x-request-id'), customId, 'Must propagate incoming x-request-id header');
    const customErrBody: any = await customRes.json();
    assert.strictEqual(customErrBody.error.requestId, customId, 'Body error.requestId must match propagated header');
    console.log('   ✓ Correlation ID injected, header propagated, and error JSON standardized\n');

    console.log('===========================================================');
    console.log('🎉 PREVIEW SMOKE TEST PASSED ALL 4 CHECKS                   ');
    console.log('===========================================================');
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

// CLI runner
if (process.argv[1] === __filename) {
  runPreviewSmokeTests()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Smoke Test Failed:', err);
      process.exit(1);
    });
}
