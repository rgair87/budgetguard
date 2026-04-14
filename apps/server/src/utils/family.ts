import db from '../config/db';

/**
 * Returns the "effective" user ID for data queries.
 * If the user is a family member (not the owner), returns the family owner's ID.
 * This makes family members see the owner's data (read-only shared household).
 * If the user is the owner or not in a family, returns their own ID.
 */
export function getEffectiveUserId(userId: string): string {
  // Check if user is a member of any family (not as owner)
  const membership = db.prepare(`
    SELECT f.owner_id FROM family_members fm
    JOIN families f ON f.id = fm.family_id
    WHERE fm.user_id = ? AND fm.status = 'active' AND f.owner_id != ?
    LIMIT 1
  `).get(userId, userId) as { owner_id: string } | undefined;

  return membership ? membership.owner_id : userId;
}
