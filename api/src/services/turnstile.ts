/**
 * @file turnstile.ts
 * @description Cloudflare Turnstile token verification service for bot defense (PRD-CORE-11 AC-019).
 * @architecture Validates single-use Turnstile tokens server-side.
 *               Provides mock bypass in test/dev environments for test token 'TEST_PASS_TOKEN'
 *               or when TURNSTILE_SECRET_KEY is omitted.
 * @agent_note Supports bypass in non-production environments when token equals TEST_PASS_TOKEN or secret key is unconfigured. Never throws; returns failure with errorCodes instead.
 */

export interface TurnstileVerifyResult {
  success: boolean;
  errorCodes?: string[];
}

/**
 * @desc    Verifies a Cloudflare Turnstile bot verification token with Cloudflare siteverify API.
 * @param   {string} token - Client-submitted Turnstile token.
 * @param   {string} [remoteIp] - Optional client IP address for enhanced security check.
 * @returns {Promise<TurnstileVerifyResult>} Verification outcome indicating success or error codes.
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string
): Promise<TurnstileVerifyResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  const isBypassAllowed =
    process.env.NODE_ENV === 'test' ||
    (process.env.NODE_ENV !== 'production' && process.env.TURNSTILE_ALLOW_BYPASS === 'true');

  // Test bypass
  if (isBypassAllowed && (token === 'TEST_PASS_TOKEN' || !secretKey)) {
    return { success: true };
  }

  if (!token || typeof token !== 'string') {
    return { success: false, errorCodes: ['missing-input-response'] };
  }

  if (!secretKey) {
    return { success: false, errorCodes: ['missing-secret-key'] };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const timeoutMs = Number(process.env.TURNSTILE_TIMEOUT_MS) || 5000;
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      return { success: false, errorCodes: [`http-status-${res.status}`] };
    }

    const data = (await res.json()) as any;
    return {
      success: data.success === true,
      errorCodes: data['error-codes'],
    };
  } catch (err: any) {
    return {
      success: false,
      errorCodes: [err?.message || 'network-error'],
    };
  }
}
