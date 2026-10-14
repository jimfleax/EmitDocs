/**
 * @file transactions.ts
 * @description MongoDB transaction and session error handling utilities.
 */

/**
 * Helper function determining if an error indicates that MongoDB transactions or sessions
 * are unsupported by the active deployment (e.g. standalone Mongo instances).
 *
 * @param {any} err - Caught error object from database operation or session initialization.
 * @returns {boolean} True if error indicates transactions/sessions are unsupported.
 */
export function isTransactionUnsupportedError(err: any): boolean {
  if (!err) return false;
  if (err.code === 20 || err.code === 263 || err.code === 148) {
    return true;
  }
  if (
    err.codeName === 'IllegalOperation' ||
    err.codeName === 'CommandNotSupported' ||
    err.codeName === 'OperationNotSupportedInTransaction'
  ) {
    return true;
  }
  const msg = typeof err.message === 'string' ? err.message.toLowerCase() : '';
  return (
    msg.includes('replica set member or mongos') ||
    msg.includes('transactions are not supported') ||
    msg.includes('does not support transactions') ||
    msg.includes('does not support retryable writes') ||
    msg.includes('sessions are not supported') ||
    msg.includes('standalone') ||
    msg.includes('not supported by this deployment') ||
    msg.includes('transaction management is not supported')
  );
}
