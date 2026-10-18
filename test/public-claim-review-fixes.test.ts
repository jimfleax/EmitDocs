/**
 * @file public-claim-review-fixes.test.ts
 * @description Dedicated verification test suite for review comment fixes in public-claim.controller.ts:
 *   1. Bounded timeout with AbortSignal.timeout and response body cancellation on non-OK responses
 *   2. PDF string literal escaping for title and recipientName in createMinimalCertificatePdf
 *   3. ClaimNotAvailableError returning 403 and gating fallback placeholders behind explicit development/test flag
 * @architecture Controller and HTTP integration test suite exercising Hono route handlers, PDF escaping, fetch timeouts, and ClaimNotAvailableError responses.
 * @agent_note Run via `npx tsx test/public-claim-review-fixes.test.ts`. Requires MONGODB_URI in api/.env. Runs tests against isolated database emitdocs_public_claim_review_test.
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { Hono } from 'hono';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../api/.env') });

import { ClaimPortal } from '../api/src/models/ClaimPortal.js';
import { ClaimSession } from '../api/src/models/ClaimSession.js';
import { ClaimRecipientState } from '../api/src/models/ClaimRecipientState.js';
import { ApprovedRecipient } from '../api/src/models/ApprovedRecipient.js';
import { ApprovedSnapshot } from '../api/src/models/ApprovedSnapshot.js';
import publicClaimApp from '../api/src/routes/public-claim.route.js';
import cloudinary from '../api/src/lib/cloudinary.js';
import { CLAIM_SESSION_COOKIE } from '../api/src/controllers/public-claim.controller.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/emitdocs_test';

/**
 * @desc Main test runner verifying review fixes across fetch timeout handling, PDF string escaping, and 403 ClaimNotAvailable gating.
 * @returns {Promise<void>} Resolves when all review fix tests pass.
 */
async function runTests() {
  console.log('🧪 Starting Public Claim Review Fixes Test Suite...\n');

  await mongoose.connect(MONGODB_URI, { dbName: 'emitdocs_public_claim_review_test' });

  const app = new Hono();
  app.route('/api/public/claim-portals', publicClaimApp);

  try {
    // -------------------------------------------------------------------------
    // Test 1: PDF string literal escaping in createMinimalCertificatePdf
    // -------------------------------------------------------------------------
    console.log('1. Testing PDF string literal escaping for parentheses, backslashes, newlines...');
    
    // We can trigger createMinimalCertificatePdf with explicit flag enabled
    process.env.ENABLE_PLACEHOLDER_PDF = 'true';

    const testSlug = `pdf-escape-${Date.now()}`;
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const portal = await ClaimPortal.create({
      publicSlug: testSlug,
      ownerId: 'owner_pdf_escape',
      batchId: new mongoose.Types.ObjectId(),
      snapshotId: new mongoose.Types.ObjectId(), // Non-existent snapshot triggers fallback
      status: 'active',
      label: 'Portal (Special \\\\ Title)',
      instructions: 'Claim here',
      credentialMode: 'generated_token',
      credentialSetRevision: 1,
      eligibleRecipientCount: 1,
      uniqueClaimedCount: 0,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    });

    const maliciousName = 'Alice) Tj\nET\nq 0 0 0 rg\nBT (Injected';
    const recipient = await ApprovedRecipient.create({
      snapshotId: portal.snapshotId,
      batchId: portal.batchId,
      ownerId: portal.ownerId,
      recipientKey: 'rec_malicious',
      sourceRowNumber: 1,
      effectiveData: { Name: maliciousName },
      status: 'valid',
      generationStatus: 'generated',
    });

    await ClaimSession.create({
      portalId: portal._id,
      recipientId: recipient._id,
      credentialSetRevision: 1,
      sessionTokenHash: tokenHash,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600 * 1000),
      ipAddress: '127.0.0.1',
    });

    // Request document streaming
    const res = await app.request(`/api/public/claim-portals/${testSlug}/documents/anyId`, {
      headers: {
        Cookie: `${CLAIM_SESSION_COOKIE}=${rawToken}`,
      },
    });

    assert.strictEqual(res.status, 200, 'With ENABLE_PLACEHOLDER_PDF=true, returns 200 fallback PDF');
    assert.strictEqual(res.headers.get('content-type'), 'application/pdf');

    const pdfBuffer = Buffer.from(await res.arrayBuffer());
    const pdfText = pdfBuffer.toString('latin1');

    // Verify malicious operators were escaped and cannot break the content stream
    assert.ok(pdfText.includes('\\) Tj\\nET\\nq 0 0 0 rg\\nBT \\(Injected'), 'Parentheses and newlines must be escaped');
    assert.ok(!pdfText.includes('(Awarded to: Alice) Tj\nET'), 'Raw injection sequence must NOT appear in PDF stream');
    console.log('   ✓ createMinimalCertificatePdf securely escapes PDF literals and prevents injection\n');

    // -------------------------------------------------------------------------
    // Test 2: Asset/snapshot failures return error status when flag is disabled
    // -------------------------------------------------------------------------
    console.log('2. Testing missing snapshot/asset returns error status when placeholder flag is disabled...');
    delete process.env.ENABLE_PLACEHOLDER_PDF;
    delete process.env.ALLOW_PLACEHOLDER_PDF;
    delete process.env.ALLOW_CLAIM_PLACEHOLDER;

    // A) streamClaimDocument: Missing snapshot -> returns 404 error
    const resDocNoSnap = await app.request(`/api/public/claim-portals/${testSlug}/documents/anyId`, {
      headers: {
        Cookie: `${CLAIM_SESSION_COOKIE}=${rawToken}`,
      },
    });
    assert.strictEqual(resDocNoSnap.status, 404, 'Missing snapshot must return 404 error');
    const jsonDocNoSnap = await resDocNoSnap.json();
    assert.strictEqual(jsonDocNoSnap.success, false);
    assert.strictEqual(jsonDocNoSnap.error.code, 'SNAPSHOT_NOT_FOUND');
    console.log('   ✓ streamClaimDocument returns 404 SNAPSHOT_NOT_FOUND instead of placeholder PDF');

    // B) streamTemplateFile & streamClaimDocument: With snapshot present but missing template/version
    await ApprovedSnapshot.create({
      _id: portal.snapshotId,
      batchId: portal.batchId,
      ownerId: portal.ownerId,
      templateId: new mongoose.Types.ObjectId(),
      templateVersionId: new mongoose.Types.ObjectId(),
      templateVersion: 1,
      templateSourceChecksum: 'chk',
      mappingHash: 'map',
      importRevision: 1,
      canonicalDigest: 'dig',
      totalRecipients: 1,
      idempotencyKey: `snap_${Date.now()}`,
      status: 'ready',
      expiresAt: portal.expiresAt,
    });

    // Missing version -> streamClaimDocument returns 404 TEMPLATE_VERSION_NOT_FOUND
    const resDocNoVer = await app.request(`/api/public/claim-portals/${testSlug}/documents/anyId`, {
      headers: {
        Cookie: `${CLAIM_SESSION_COOKIE}=${rawToken}`,
      },
    });
    assert.strictEqual(resDocNoVer.status, 404);
    const jsonDocNoVer = await resDocNoVer.json();
    assert.strictEqual(jsonDocNoVer.error.code, 'TEMPLATE_VERSION_NOT_FOUND');
    console.log('   ✓ streamClaimDocument returns 404 TEMPLATE_VERSION_NOT_FOUND when version is missing');

    // Template asset failure in streamTemplateFile -> returns 500 TEMPLATE_FETCH_FAILED
    const resTemplateFail = await app.request(`/api/public/claim-portals/${testSlug}/template-file`, {
      headers: {
        Cookie: `${CLAIM_SESSION_COOKIE}=${rawToken}`,
      },
    });
    assert.strictEqual(resTemplateFail.status, 500, 'Template asset failure must return 500 error');
    const jsonTemplateFail = await resTemplateFail.json();
    assert.strictEqual(jsonTemplateFail.success, false);
    assert.strictEqual(jsonTemplateFail.error.code, 'TEMPLATE_FETCH_FAILED');
    console.log('   ✓ streamTemplateFile returns 500 TEMPLATE_FETCH_FAILED instead of placeholder PDF\n');

    // -------------------------------------------------------------------------
    // Test 3: ClaimNotAvailableError returns 403 on revoked/excluded recipient
    // -------------------------------------------------------------------------
    console.log('3. Testing ClaimNotAvailableError returns 403 for revoked/excluded recipient...');
    // Revoke the recipient in ClaimRecipientState
    await ClaimRecipientState.create({
      portalId: portal._id,
      recipientId: recipient._id,
      snapshotId: portal.snapshotId,
      credentialSetRevision: 1,
      status: 'revoked',
      revokedAt: new Date(),
    });

    // A) streamTemplateFile returns 403
    const resTemplateRevoked = await app.request(`/api/public/claim-portals/${testSlug}/template-file`, {
      headers: {
        Cookie: `${CLAIM_SESSION_COOKIE}=${rawToken}`,
      },
    });
    assert.strictEqual(resTemplateRevoked.status, 403, 'streamTemplateFile must return 403 on revoked recipient');
    const jsonTemplateRevoked = await resTemplateRevoked.json();
    assert.strictEqual(jsonTemplateRevoked.error.code, 'CLAIM_NOT_AVAILABLE');
    console.log('   ✓ streamTemplateFile returns 403 CLAIM_NOT_AVAILABLE');

    // B) streamClaimDocument returns 403
    const resDocRevoked = await app.request(`/api/public/claim-portals/${testSlug}/documents/anyId`, {
      headers: {
        Cookie: `${CLAIM_SESSION_COOKIE}=${rawToken}`,
      },
    });
    assert.strictEqual(resDocRevoked.status, 403, 'streamClaimDocument must return 403 on revoked recipient');
    const jsonDocRevoked = await resDocRevoked.json();
    assert.strictEqual(jsonDocRevoked.error.code, 'CLAIM_NOT_AVAILABLE');
    console.log('   ✓ streamClaimDocument returns 403 CLAIM_NOT_AVAILABLE\n');

    // -------------------------------------------------------------------------
    // Test 4: Cloudinary download timeout and body cancellation on non-OK response
    // -------------------------------------------------------------------------
    console.log('4. Testing Cloudinary fetch timeout & body cancellation...');
    cloudinary.config({ cloud_name: 'test_cloud' });
    
    // Create un-revoked recipient with outputKey
    const rawToken2 = crypto.randomBytes(32).toString('hex');
    const tokenHash2 = crypto.createHash('sha256').update(rawToken2).digest('hex');

    const recipient2 = await ApprovedRecipient.create({
      snapshotId: portal.snapshotId,
      batchId: portal.batchId,
      ownerId: portal.ownerId,
      recipientKey: 'rec_cloudinary',
      sourceRowNumber: 2,
      effectiveData: { Name: 'Cloud Bob' },
      status: 'valid',
      generationStatus: 'generated',
      outputKey: 'certs/bob.pdf',
    });

    await ClaimSession.create({
      portalId: portal._id,
      recipientId: recipient2._id,
      credentialSetRevision: 1,
      sessionTokenHash: tokenHash2,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600 * 1000),
      ipAddress: '127.0.0.1',
    });

    const originalFetch = globalThis.fetch;
    let firstFetchSignal: AbortSignal | undefined;
    let bodyCancelCalled = false;

    // Mock fetch: first call returns 404 non-ok response with mock body
    globalThis.fetch = async (url: any, init?: any) => {
      firstFetchSignal = init?.signal;
      return {
        ok: false,
        status: 404,
        body: {
          cancel: async () => {
            bodyCancelCalled = true;
          },
        },
      } as any;
    };

    try {
      await app.request(`/api/public/claim-portals/${testSlug}/documents/certs/bob.pdf`, {
        headers: {
          Cookie: `${CLAIM_SESSION_COOKIE}=${rawToken2}`,
        },
      });

      // Verify that fetch signal was an AbortSignal
      assert.ok(firstFetchSignal instanceof AbortSignal, 'fetch must receive an AbortSignal timeout');
      // Verify body was cancelled when non-ok response was returned
      assert.strictEqual(bodyCancelCalled, true, 'response.body.cancel() must be called on non-OK response');
      console.log('   ✓ AbortSignal provided and non-OK response.body cancelled cleanly\n');
    } finally {
      globalThis.fetch = originalFetch;
    }

    console.log('🎉 ALL Public Claim Review Fixes tests PASSED successfully!');
  } finally {
    delete process.env.ENABLE_PLACEHOLDER_PDF;
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
