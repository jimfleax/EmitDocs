/**
 * @file account.controller.ts
 * @description HTTP controller endpoints for account lifecycle and full profile deletion (PRD-CORE-09).
 * @architecture Bridges Hono HTTP requests with the account-deletion cascade service, handling multi-status responses.
 * @agent_note Requires authenticated user on Context (`c.get('user')`). Returns 207 Multi-Status if MongoDB records are removed but Cloudinary purge encountered issues.
 */

import { Context } from 'hono';
import { deleteUserAccount } from '../services/account-deletion.js';

/**
 * @desc    Permanently deletes user account, associated MongoDB records, and purges Cloudinary assets.
 * @route   DELETE /api/account
 * @access  Private (Authenticated User)
 * @returns {Promise<Response>} 200 on complete success, 207 on partial purge, 401 if unauthorized, or 500 on failure.
 */
export const deleteAccount = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const result = await deleteUserAccount(user.id);
    if (!result.success) {
      const isMongoFailed = result.errors?.some((e: string) =>
        e.includes('MongoDB cascade deletion error')
      );
      if (!isMongoFailed && !result.cloudinaryPurged) {
        return c.json(
          {
            success: false,
            error: 'Account was removed but cleanup is incomplete',
            message: 'Account was removed but cleanup is incomplete',
            result,
          },
          207
        );
      }

      return c.json(
        {
          success: false,
          error: 'Failed to delete account',
          message: 'Failed to delete account',
          result,
        },
        500
      );
    }
    return c.json(
      {
        success: true,
        message: 'Account and associated data deleted successfully',
        result,
      },
      200
    );
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to delete account' }, 500);
  }
};
