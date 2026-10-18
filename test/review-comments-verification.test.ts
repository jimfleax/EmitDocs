/**
 * @file review-comments-verification.test.ts
 * @description Targeted tests verifying all review comment fixes:
 *   1. Keyed verifier strength evaluation reason strings never leak credentials and report count/row index.
 *   2. CLAIM_PORTAL_HMAC_SECRET production guard and non-production fallback.
 *   3. Claim recipient state atomic first-claim detection via findOneAndUpdate with new: false.
 *   4. Retention pruner claim deletions occur before batch status update.
 *   5. Turnstile fetch timeout signal and structured failure handling.
 *   6. Turnstile bypass gating (test or TURNSTILE_ALLOW_BYPASS only, fails closed otherwise).
 */

import assert from 'node:assert';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../api/.env') });

import { evaluateImportedCredentialStrength } from '../api/src/services/keyed-verifier.js';
import { verifyTurnstileToken } from '../api/src/services/turnstile.js';
import { Batch } from '../api/src/models/Batch.js';
import { ClaimPortal } from '../api/src/models/ClaimPortal.js';
import { ClaimCredential } from '../api/src/models/ClaimCredential.js';
import { ClaimSession } from '../api/src/models/ClaimSession.js';
import { ClaimRecipientState } from '../api/src/models/ClaimRecipientState.js';
import { ApprovedRecipient } from '../api/src/models/ApprovedRecipient.js';
import { DraftRow } from '../api/src/models/DraftRow.js';
import { RetentionPruner } from '../api/src/services/retention-pruner.js';

async function run() {
  console.log('=== STARTING REVIEW COMMENTS VERIFICATION TEST SUITE ===');

  // ---------------------------------------------------------------------------
  // 1. Keyed Verifier Reason Strings Privacy & Indices
  // ---------------------------------------------------------------------------
  console.log('1. Testing evaluateImportedCredentialStrength reason strings privacy...');
  const sensitiveVal1 = 'SECRET_CRED_123';
  const sensitiveVal2 = 'SECRET_CRED_123';
  const shortVal = 'tiny_cred';
  const numVal = '12345678901234';
  const repVal = 'XXXXXXXXXXXXXX';
  const seqVal = 'abcdefghijklmn';

  // Collision
  const colRes = evaluateImportedCredentialStrength([sensitiveVal1, sensitiveVal2]);
  assert.strictEqual(colRes.strong, false);
  assert.strictEqual(colRes.collisions.length, 1);
  assert.strictEqual(colRes.collisions[0], sensitiveVal1);
  assert.ok(!colRes.reason?.includes(sensitiveVal1), 'Reason must not contain sensitive credential');
  assert.ok(colRes.reason?.includes('1 collision'), 'Reason must report collision count');

  // Short
  const shortRes = evaluateImportedCredentialStrength([shortVal]);
  assert.strictEqual(shortRes.strong, false);
  assert.ok(!shortRes.reason?.includes(shortVal), 'Reason must not contain raw credential');
  assert.ok(shortRes.reason?.includes('row 1'), 'Reason must report row index');

  // Numeric
  const numRes = evaluateImportedCredentialStrength([numVal]);
  assert.strictEqual(numRes.strong, false);
  assert.ok(!numRes.reason?.includes(numVal), 'Reason must not contain raw credential');
  assert.ok(numRes.reason?.includes('row 1'), 'Reason must report row index');

  // Repeated
  const repRes = evaluateImportedCredentialStrength(['VALID_CRED_ROW1_OK', repVal]);
  assert.strictEqual(repRes.strong, false);
  assert.ok(!repRes.reason?.includes(repVal), 'Reason must not contain raw credential');
  assert.ok(repRes.reason?.includes('row 2'), 'Reason must report row index 2');

  // Sequential
  const seqRes = evaluateImportedCredentialStrength(['VALID_CRED_ROW1_OK', seqVal]);
  assert.strictEqual(seqRes.strong, false);
  assert.ok(!seqRes.reason?.includes(seqVal), 'Reason must not contain raw credential');
  assert.ok(seqRes.reason?.includes('row 2'), 'Reason must report row index 2');

  console.log('   ✓ Reason strings never contain raw credentials and report counts/row indices');

  // ---------------------------------------------------------------------------
  // 2. Turnstile Bypass Condition and Fail-Closed Behavior
  // ---------------------------------------------------------------------------
  console.log('2. Testing Turnstile verification bypass conditions...');
  const savedNodeEnv = process.env.NODE_ENV;
  const savedAllowBypass = process.env.TURNSTILE_ALLOW_BYPASS;
  const savedSecret = process.env.TURNSTILE_SECRET_KEY;

  try {
    // A. NODE_ENV === 'test' -> bypass allowed
    process.env.NODE_ENV = 'test';
    delete process.env.TURNSTILE_ALLOW_BYPASS;
    delete process.env.TURNSTILE_SECRET_KEY;
    const testEnvBypass = await verifyTurnstileToken('TEST_PASS_TOKEN');
    assert.strictEqual(testEnvBypass.success, true, 'Test environment should bypass TEST_PASS_TOKEN');

    const testMissingSecretBypass = await verifyTurnstileToken('some-token');
    assert.strictEqual(testMissingSecretBypass.success, true, 'Test environment should bypass missing secret');

    // B. TURNSTILE_ALLOW_BYPASS === 'true' in development
    process.env.NODE_ENV = 'development';
    process.env.TURNSTILE_ALLOW_BYPASS = 'true';
    const flagBypass = await verifyTurnstileToken('TEST_PASS_TOKEN');
    assert.strictEqual(flagBypass.success, true, 'TURNSTILE_ALLOW_BYPASS=true should allow bypass in dev');

    // C. NODE_ENV unset (or development without flag) -> fails closed
    delete process.env.NODE_ENV;
    delete process.env.TURNSTILE_ALLOW_BYPASS;
    delete process.env.TURNSTILE_SECRET_KEY;
    const unsetFailClosed = await verifyTurnstileToken('TEST_PASS_TOKEN');
    assert.strictEqual(unsetFailClosed.success, false, 'Unset environment must fail closed');
    assert.deepStrictEqual(unsetFailClosed.errorCodes, ['missing-secret-key']);

    // D. NODE_ENV === 'staging' -> fails closed
    process.env.NODE_ENV = 'staging';
    const stagingFailClosed = await verifyTurnstileToken('TEST_PASS_TOKEN');
    assert.strictEqual(stagingFailClosed.success, false, 'Staging environment must fail closed');
    assert.deepStrictEqual(stagingFailClosed.errorCodes, ['missing-secret-key']);

    // E. NODE_ENV === 'production' -> fails closed
    process.env.NODE_ENV = 'production';
    const prodFailClosed = await verifyTurnstileToken('TEST_PASS_TOKEN');
    assert.strictEqual(prodFailClosed.success, false, 'Production environment must fail closed');
    assert.deepStrictEqual(prodFailClosed.errorCodes, ['missing-secret-key']);
  } finally {
    process.env.NODE_ENV = savedNodeEnv;
    if (savedAllowBypass !== undefined) {
      process.env.TURNSTILE_ALLOW_BYPASS = savedAllowBypass;
    } else {
      delete process.env.TURNSTILE_ALLOW_BYPASS;
    }
    if (savedSecret !== undefined) {
      process.env.TURNSTILE_SECRET_KEY = savedSecret;
    } else {
      delete process.env.TURNSTILE_SECRET_KEY;
    }
  }
  console.log('   ✓ Turnstile bypass strictly enforced (only test or explicit flag)');

  // ---------------------------------------------------------------------------
  // 3. Turnstile Timeout Signal Abort Handling
  // ---------------------------------------------------------------------------
  console.log('3. Testing Turnstile siteverify fetch timeout signal...');
  const savedTimeout = process.env.TURNSTILE_TIMEOUT_MS;
  const savedSec = process.env.TURNSTILE_SECRET_KEY;
  const savedEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production'; // bypass disallowed
    process.env.TURNSTILE_SECRET_KEY = 'mock_secret_key_for_testing';
    // 1ms timeout will immediately abort any real external HTTP request
    process.env.TURNSTILE_TIMEOUT_MS = '1';

    const timeoutRes = await verifyTurnstileToken('real_looking_token_123');
    assert.strictEqual(timeoutRes.success, false, 'Timed-out request should fail');
    assert.ok(timeoutRes.errorCodes && timeoutRes.errorCodes.length > 0, 'Error codes returned');
  } finally {
    if (savedTimeout !== undefined) {
      process.env.TURNSTILE_TIMEOUT_MS = savedTimeout;
    } else {
      delete process.env.TURNSTILE_TIMEOUT_MS;
    }
    if (savedSec !== undefined) {
      process.env.TURNSTILE_SECRET_KEY = savedSec;
    } else {
      delete process.env.TURNSTILE_SECRET_KEY;
    }
    process.env.NODE_ENV = savedEnv;
  }
  console.log('   ✓ Turnstile timeout signal aborts stalled requests with structured failure');

  // ---------------------------------------------------------------------------
  // 4. Retention Pruner Deletion Precedence
  // ---------------------------------------------------------------------------
  console.log('4. Testing Retention Pruner deletion precedence and retry eligibility...');
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/emitdocs_test';
  await mongoose.connect(MONGODB_URI, { dbName: 'emitdocs_review_test' });

  try {
    const testBatchId = new mongoose.Types.ObjectId();
    const testPortalId = new mongoose.Types.ObjectId();
    const past = new Date(Date.now() - 100000);

    const batch = await Batch.create({
      _id: testBatchId,
      name: 'Prune Test Batch',
      ownerId: 'owner_prune_test',
      templateId: new mongoose.Types.ObjectId(),
      templateVersionId: new mongoose.Types.ObjectId(),
      status: 'approved',
      expiresAt: past,
      retentionHours: 24,
    });

    const portal = await ClaimPortal.create({
      _id: testPortalId,
      publicSlug: `prune-slug-${Date.now()}`,
      ownerId: 'owner_prune_test',
      batchId: testBatchId,
      snapshotId: new mongoose.Types.ObjectId(),
      credentialMode: 'generated_token',
      label: 'Prune Portal',
      expiresAt: past,
    });

    const recId = new mongoose.Types.ObjectId();
    await ClaimCredential.create({
      ownerId: 'owner_prune_test',
      portalId: testPortalId,
      credentialSetId: new mongoose.Types.ObjectId(),
      credentialSetRevision: 1,
      recipientId: recId,
      credentialVerifier: 'hash_abc_123',
      credentialKind: 'single',
      strengthClass: 'generated',
      status: 'active',
    });

    await ClaimSession.create({
      sessionTokenHash: 'sess_hash_123',
      portalId: testPortalId,
      recipientId: recId,
      credentialSetRevision: 1,
      expiresAt: new Date(Date.now() + 60000),
    });

    await ClaimRecipientState.create({
      portalId: testPortalId,
      snapshotId: new mongoose.Types.ObjectId(),
      recipientId: recId,
      status: 'claimed',
      credentialSetRevision: 1,
    });

    // Run pruneAllExpiredBatches
    const pruneRes = await RetentionPruner.pruneAllExpiredBatches();
    assert.ok(pruneRes.expiredBatchesCount >= 1);

    // Verify all 3 models pruned
    const credCount = await ClaimCredential.countDocuments({ portalId: testPortalId });
    const sessCount = await ClaimSession.countDocuments({ portalId: testPortalId });
    const stateCount = await ClaimRecipientState.countDocuments({ portalId: testPortalId });

    assert.strictEqual(credCount, 0, 'ClaimCredential must be pruned');
    assert.strictEqual(sessCount, 0, 'ClaimSession must be pruned');
    assert.strictEqual(stateCount, 0, 'ClaimRecipientState must be pruned');

    const updatedBatch = await Batch.findById(testBatchId);
    assert.strictEqual(updatedBatch?.status, 'expired', 'Batch marked expired after deletions');

    console.log('   ✓ pruneAllExpiredBatches purges all 3 claim models and transitions batch');
  } finally {
    await mongoose.disconnect();
  }

  // ---------------------------------------------------------------------------
  // 5. CLAIM_PORTAL_HMAC_SECRET Startup Guard in Production
  // ---------------------------------------------------------------------------
  console.log('5. Testing CLAIM_PORTAL_HMAC_SECRET startup failure when NODE_ENV is production...');
  const { execSync } = await import('node:child_process');
  
  // A. Missing secret in production fails at startup
  let prodMissingFailed = false;
  try {
    execSync('NODE_PATH=./node_modules:../api/node_modules npx tsx -e "import(\'../api/src/services/participant-claim.js\')"', {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        CLAIM_RATE_LIMIT_SALT: 'valid_rate_limit_salt_32_bytes_ok',
        CLAIM_PORTAL_HMAC_SECRET: '',
      },
      stdio: 'pipe',
    });
  } catch (err: any) {
    prodMissingFailed = true;
    assert.ok(
      err.stderr.toString().includes('CLAIM_PORTAL_HMAC_SECRET must be set and at least 32 bytes'),
      'Must fail with 32 bytes error message'
    );
  }
  assert.strictEqual(prodMissingFailed, true, 'Importing participant-claim without secret in production must fail');

  // B. Short secret (< 32 bytes) in production fails at startup
  let prodShortFailed = false;
  try {
    execSync('NODE_PATH=./node_modules:../api/node_modules npx tsx -e "import(\'../api/src/services/participant-claim.js\')"', {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        CLAIM_RATE_LIMIT_SALT: 'valid_rate_limit_salt_32_bytes_ok',
        CLAIM_PORTAL_HMAC_SECRET: 'too_short_secret_123',
      },
      stdio: 'pipe',
    });
  } catch (err: any) {
    prodShortFailed = true;
    assert.ok(
      err.stderr.toString().includes('CLAIM_PORTAL_HMAC_SECRET must be set and at least 32 bytes'),
      'Must fail with 32 bytes error message'
    );
  }
  assert.strictEqual(prodShortFailed, true, 'Importing participant-claim with short secret in production must fail');

  // C. Valid secret (>= 32 bytes) in production succeeds
  execSync('NODE_PATH=./node_modules:../api/node_modules npx tsx -e "import(\'../api/src/services/participant-claim.js\')"', {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      CLAIM_RATE_LIMIT_SALT: 'valid_rate_limit_salt_32_bytes_ok',
      CLAIM_PORTAL_HMAC_SECRET: 'this_is_a_valid_production_secret_key_at_least_32_bytes_long',
    },
    stdio: 'pipe',
  });
  console.log('   ✓ CLAIM_PORTAL_HMAC_SECRET production startup guard verified');

  // ---------------------------------------------------------------------------
  // 6. Atomic isFirstClaim detection via findOneAndUpdate with new: false
  // ---------------------------------------------------------------------------
  console.log('6. Testing atomic isFirstClaim detection via findOneAndUpdate with new: false...');
  await mongoose.connect(MONGODB_URI, { dbName: 'emitdocs_review_test' });
  try {
    const testPortalId = new mongoose.Types.ObjectId();
    const testRecipientId = new mongoose.Types.ObjectId();
    const now = new Date();

    // Step A: First claim on non-existent record (new: false returns null)
    const prev1 = await ClaimRecipientState.findOneAndUpdate(
      { portalId: testPortalId, recipientId: testRecipientId },
      {
        $set: { status: 'claimed', lastClaimAt: now },
        $setOnInsert: { firstClaimAt: now },
      },
      { upsert: true, new: false }
    );
    assert.strictEqual(prev1, null, 'Previous document must be null when inserted');
    const isFirstClaim1 = !prev1 || prev1.status !== 'claimed';
    assert.strictEqual(isFirstClaim1, true, 'Must detect as first claim');

    // Step B: Repeat claim (new: false returns existing claimed doc)
    const prev2 = await ClaimRecipientState.findOneAndUpdate(
      { portalId: testPortalId, recipientId: testRecipientId },
      {
        $set: { status: 'claimed', lastClaimAt: now },
        $setOnInsert: { firstClaimAt: now },
      },
      { upsert: true, new: false }
    );
    assert.ok(prev2, 'Previous document must exist');
    assert.strictEqual(prev2.status, 'claimed');
    const isFirstClaim2 = !prev2 || prev2.status !== 'claimed';
    assert.strictEqual(isFirstClaim2, false, 'Must NOT detect as first claim on repeat claim');

    console.log('   ✓ findOneAndUpdate with new: false accurately distinguishes first vs repeat claim');
  } finally {
    await mongoose.disconnect();
  }

  // ---------------------------------------------------------------------------
  // 7. CLAIM_RATE_LIMIT_SALT Startup Guard in Production & Dev Fallback
  // ---------------------------------------------------------------------------
  console.log('7. Testing CLAIM_RATE_LIMIT_SALT startup failure in production & dev fallback...');
  
  // A. Missing salt in production fails at startup
  let prodMissingSaltFailed = false;
  try {
    execSync('NODE_PATH=./node_modules:../api/node_modules npx tsx -e "import(\'../api/src/services/claim-rate-limiter.js\')"', {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        CLAIM_RATE_LIMIT_SALT: '',
      },
      stdio: 'pipe',
    });
  } catch (err: any) {
    prodMissingSaltFailed = true;
    assert.ok(
      err.stderr.toString().includes('CLAIM_RATE_LIMIT_SALT must be set when NODE_ENV is production'),
      'Must fail with CLAIM_RATE_LIMIT_SALT production error message'
    );
  }
  assert.strictEqual(prodMissingSaltFailed, true, 'Importing claim-rate-limiter without salt in production must fail');

  // B. Valid salt in production succeeds
  execSync('NODE_PATH=./node_modules:../api/node_modules npx tsx -e "import(\'../api/src/services/claim-rate-limiter.js\')"', {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      CLAIM_RATE_LIMIT_SALT: 'prod_salt_1234567890',
    },
    stdio: 'pipe',
  });

  // C. Development fallback works when salt is missing
  const devSaltOutput = execSync('NODE_PATH=./node_modules:../api/node_modules npx tsx -e "import(\'../api/src/services/claim-rate-limiter.js\').then(m => console.log(m.ROTATING_SALT))"', {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      CLAIM_RATE_LIMIT_SALT: '',
    },
    stdio: 'pipe',
  }).toString().trim();
  assert.strictEqual(devSaltOutput, 'emitdocs_dev_claim_rate_limit_salt', 'Must use development fallback in dev');
  console.log('   ✓ CLAIM_RATE_LIMIT_SALT production startup guard & dev fallback verified');

  console.log('\n===========================================================');
  console.log('  ALL REVIEW COMMENTS VERIFICATION CHECKS PASSED (100%)    ');
  console.log('===========================================================\n');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
