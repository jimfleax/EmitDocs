/**
 * @file email-dispatch.ts
 * @description Hard-disabled email dispatch service for pilot release boundary.
 * @architecture Throws EmailDispatchDisabledError on all send operations to uphold the zero-cost architecture boundary.
 * @agent_note Email dispatch is intentionally hard-disabled for initial release milestones.
 */

export class EmailDispatchDisabledError extends Error {
  code = 'EMAIL_DISPATCH_DISABLED';
  constructor(message = 'Email dispatch is hard-disabled for this pilot release.') {
    super(message);
    this.name = 'EmailDispatchDisabledError';
    Object.setPrototypeOf(this, EmailDispatchDisabledError.prototype);
  }
}

export const EmailDispatchService = {
  /**
   * @desc    Returns whether email dispatch capability is enabled in the current runtime environment.
   * @returns {boolean} Always false for the pilot release.
   */
  isEnabled: () => false,

  /**
   * @desc    Simulates or rejects batch email delivery requests.
   * @throws  {EmailDispatchDisabledError} Always throws because email dispatch is hard-disabled.
   */
  sendBatchEmail: async () => {
    throw new EmailDispatchDisabledError();
  },
};
