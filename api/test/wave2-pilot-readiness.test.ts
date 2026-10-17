/**
 * @file wave2-pilot-readiness.test.ts
 * @description Unit and integration tests verifying PRD-CORE-10 Wave 2 (Slice 2 & Slice 3).
 */

import 'dotenv/config';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { Hono } from 'hono';
import {
  validateEnvironment,
  ConfigurationError,
} from '../src/config/production-guard.js';
import { requestIdMiddleware } from '../src/middleware/request-id.middleware.js';
import { safeLoggerMiddleware, scrubPii } from '../src/middleware/safe-logger.middleware.js';
import { requireAuth } from '../src/middleware/auth.middleware.js';
import {
  RESOURCE_LIMITS,
  MAX_BATCH_ROWS,
  MAX_TEMPLATE_FILE_SIZE_BYTES,
  MAX_USER_STORAGE_QUOTA_BYTES,
} from '../src/constants/limits.js';
import {
  EmailDispatchService,
  EmailDispatchDisabledError,
} from '../src/services/email-dispatch.js';
import { signUploadParams } from '../src/services/template-lifecycle.js';

async function runTests() {
  console.log('===========================================================');
  console.log('  RUNNING PRD-CORE-10 WAVE 2 VERIFICATION TEST SUITE       ');
  console.log('===========================================================\n');

  // --- 1. Production Guard (AC5 & AC7) ---
  console.log('--- 1. Testing Production Guard Environment Validation ---');

  // 1.1 Throws if ENABLE_TEST_AUTH is true in production
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
        ALLOWED_ORIGINS: 'http://localhost:5173',
      });
    },
    (err: any) =>
      err instanceof ConfigurationError &&
      err.code === 'CONFIG_VALIDATION_FAILED' &&
      err.message.includes('ENABLE_TEST_AUTH')
  );
  console.log('   ✓ Rejects ENABLE_TEST_AUTH=true in production');

  // 1.2 Throws if missing required production environment variables
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
  console.log('   ✓ Throws CONFIG_VALIDATION_FAILED on missing production env vars');

  // 1.3 Passes when valid in production
  const prodConfig = validateEnvironment({
    NODE_ENV: 'production',
    ENABLE_TEST_AUTH: 'false',
    MONGODB_URI: 'mongodb://localhost:27017',
    BETTER_AUTH_SECRET: 'secret-123456789012345678901234567890',
    BETTER_AUTH_URL: 'https://emitdocs.com',
    GOOGLE_CLIENT_ID: 'google-id',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    CLOUDINARY_CLOUD_NAME: 'cloud',
    CLOUDINARY_API_KEY: 'key',
    CLOUDINARY_API_SECRET: 'secret',
    ALLOWED_ORIGINS: 'https://emitdocs.com,https://api.emitdocs.com',
  });
  assert.strictEqual(prodConfig.NODE_ENV, 'production');
  assert.strictEqual(prodConfig.ENABLE_TEST_AUTH, false);
  assert.strictEqual(prodConfig.ALLOWED_ORIGINS.length, 2);
  console.log('   ✓ Valid production configuration passes validation');

  // 1.4 Passes with defaults in development
  const devConfig = validateEnvironment({
    NODE_ENV: 'development',
  });
  assert.strictEqual(devConfig.NODE_ENV, 'development');
  assert.strictEqual(devConfig.PORT, 3000);
  console.log('   ✓ Development configuration succeeds with defaults\n');

  // --- 2. Request ID & Safe Logger Middlewares (AC7) ---
  console.log('--- 2. Testing Request ID & Safe Logger Middlewares ---');

  const app = new Hono();
  app.use('*', requestIdMiddleware);
  app.use('*', safeLoggerMiddleware);
  app.get('/test-route', (c) => {
    return c.json({ ok: true, requestId: c.get('requestId') });
  });

  // 2.1 Automatically generates x-request-id if missing
  const res1 = await app.request('/test-route');
  assert.strictEqual(res1.status, 200);
  const genId = res1.headers.get('x-request-id');
  assert.ok(genId && genId.length > 10, 'Must generate valid x-request-id');
  const body1 = await res1.json();
  assert.strictEqual(body1.requestId, genId);
  console.log('   ✓ Automatically generates and returns x-request-id header');

  // 2.2 Propagates incoming x-request-id
  const incomingId = 'custom-correlation-uuid-999';
  const res2 = await app.request('/test-route', {
    headers: { 'x-request-id': incomingId },
  });
  assert.strictEqual(res2.headers.get('x-request-id'), incomingId);
  const body2 = await res2.json();
  assert.strictEqual(body2.requestId, incomingId);
  console.log('   ✓ Preserves and propagates incoming x-request-id header');

  // 2.3 PII Scrubber
  const dirtyData = {
    name: 'Alice Smith',
    email: 'alice@example.com',
    token: 'jwt_12345',
    password: 'super-secret-password',
    status: 200,
    nested: {
      recipient: 'Bob Jones',
      count: 42,
    },
  };
  const cleanData = scrubPii(dirtyData);
  assert.strictEqual(cleanData.name, '[REDACTED]');
  assert.strictEqual(cleanData.email, '[REDACTED]');
  assert.strictEqual(cleanData.token, '[REDACTED]');
  assert.strictEqual(cleanData.password, '[REDACTED]');
  assert.strictEqual(cleanData.nested.recipient, '[REDACTED]');
  assert.strictEqual(cleanData.status, 200);
  assert.strictEqual(cleanData.nested.count, 42);
  console.log('   ✓ PII scrubber recursively redacts sensitive fields\n');

  // --- 3. Test-Auth Header Quarantining (AC5) ---
  console.log('--- 3. Testing Test-Auth Header Quarantining ---');

  const authApp = new Hono();
  authApp.use('*', requireAuth);
  authApp.get('/protected', (c) => c.json({ user: c.get('user') }));

  const savedNodeEnv = process.env.NODE_ENV;
  const savedTestAuth = process.env.ENABLE_TEST_AUTH;

  try {
    // 3.1 In production, reject x-test-auth-user immediately with 401
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_TEST_AUTH = 'true';
    const prodAuthRes = await authApp.request('/protected', {
      headers: { 'x-test-auth-user': 'user_pilot_123' },
    });
    assert.strictEqual(prodAuthRes.status, 401);
    console.log('   ✓ Rejects x-test-auth-user with 401 when NODE_ENV is production');

    // 3.2 In dev, reject if ENABLE_TEST_AUTH is not 'true'
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_TEST_AUTH = 'false';
    const devDisabledRes = await authApp.request('/protected', {
      headers: { 'x-test-auth-user': 'user_pilot_123' },
    });
    assert.strictEqual(devDisabledRes.status, 401);
    console.log('   ✓ Rejects x-test-auth-user with 401 when ENABLE_TEST_AUTH !== true');

    // 3.3 In dev, allow mock user when ENABLE_TEST_AUTH is 'true'
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_TEST_AUTH = 'true';
    const devEnabledRes = await authApp.request('/protected', {
      headers: { 'x-test-auth-user': 'user_pilot_123' },
    });
    assert.strictEqual(devEnabledRes.status, 200);
    const authedBody = await devEnabledRes.json();
    assert.strictEqual(authedBody.user.id, 'user_pilot_123');
    console.log('   ✓ Populates mock user when ENABLE_TEST_AUTH=true in non-production\n');
  } finally {
    process.env.NODE_ENV = savedNodeEnv;
    process.env.ENABLE_TEST_AUTH = savedTestAuth;
  }

  // --- 4. Resource Limits Constants & Caps (AC8) ---
  console.log('--- 4. Testing Resource Limits Constants ---');
  assert.strictEqual(RESOURCE_LIMITS.MAX_BATCH_ROWS, 5000);
  assert.strictEqual(MAX_BATCH_ROWS, 5000);
  assert.strictEqual(RESOURCE_LIMITS.MAX_TEMPLATE_FILE_SIZE_BYTES, 15 * 1024 * 1024);
  assert.strictEqual(MAX_TEMPLATE_FILE_SIZE_BYTES, 15 * 1024 * 1024);
  assert.strictEqual(RESOURCE_LIMITS.MAX_USER_STORAGE_QUOTA_BYTES, 500 * 1024 * 1024);
  assert.strictEqual(MAX_USER_STORAGE_QUOTA_BYTES, 500 * 1024 * 1024);
  console.log('   ✓ Operational limits: 5000 rows, 15MB template, 500MB storage ceiling\n');

  // --- 5. Hard Email Dispatch Kill Switch (AC10) ---
  console.log('--- 5. Testing Hard Email Dispatch Kill Switch ---');
  assert.strictEqual(EmailDispatchService.isEnabled(), false);
  await assert.rejects(
    async () => EmailDispatchService.sendBatchEmail(),
    (err: any) =>
      err instanceof EmailDispatchDisabledError &&
      err.code === 'EMAIL_DISPATCH_DISABLED'
  );
  console.log('   ✓ Email dispatch is hard-disabled and throws EMAIL_DISPATCH_DISABLED\n');

  // --- 6. Template signUploadParams signature & sync/async compatibility ---
  console.log('--- 6. Testing signUploadParams API ---');
  if (process.env.MONGODB_URI && mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'emitdocs_test' });
  }

  const signed = signUploadParams({ ownerId: 'user_test_limits' });
  assert.strictEqual(signed.folder, 'templates/user_test_limits');
  assert.ok(typeof signed.signature === 'string' && signed.signature.length > 0);
  assert.ok(typeof signed.timestamp === 'number');

  // Also verify awaitable
  const awaitedSigned = await signUploadParams({ ownerId: 'user_test_limits' });
  assert.strictEqual(awaitedSigned.folder, 'templates/user_test_limits');
  console.log('   ✓ signUploadParams provides synchronous & async dual interface\n');

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  console.log('===========================================================');
  console.log('🎉 ALL PRD-CORE-10 WAVE 2 ACCEPTANCE CRITERIA VERIFIED!     ');
  console.log('===========================================================');
}

runTests().catch(async (err) => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  console.error('Wave 2 Verification Failed:', err);
  process.exit(1);
});
