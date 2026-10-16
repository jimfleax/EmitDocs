/**
 * @file account.controller.ts
 * @description HTTP controller endpoints for account lifecycle and full profile deletion (PRD-CORE-09).
 */

import { Context } from 'hono';
import { deleteUserAccount } from '../services/account-deletion.js';

export const deleteAccount = async (c: Context) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const result = await deleteUserAccount(user.id);
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
