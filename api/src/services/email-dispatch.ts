/**
 * @file email-dispatch.ts
 * @description Hard-disabled email dispatch service for pilot release boundary.
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
  isEnabled: () => false,
  sendBatchEmail: async () => {
    throw new EmailDispatchDisabledError();
  },
};
