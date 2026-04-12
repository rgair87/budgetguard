import crypto from 'crypto';
import db from '../config/db';
import logger from '../config/logger';

// Stub email service — logs to console if the real module doesn't exist
let sendFamilyInviteEmail: (email: string, inviterName: string, token: string) => void;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const emailService = require('./email.service');
  sendFamilyInviteEmail = emailService.sendFamilyInviteEmail;
} catch {
  sendFamilyInviteEmail = (email: string, inviterName: string, token: string) => {
    logger.info(`[family] Invite email stub: to=${email}, from=${inviterName}, token=${token}`);
  };
}

interface Family {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string | null;
  email: string;
  role: string;
  status: string;
  invite_token: string | null;
  invited_at: string;
  joined_at: string | null;
}

export function createFamily(userId: string, name?: string): Family & { members: FamilyMember[] } {
  // Check if user already belongs to a family
  const existing = db.prepare(
    'SELECT f.* FROM families f JOIN family_members fm ON fm.family_id = f.id WHERE fm.user_id = ? AND fm.status = ?'
  ).get(userId, 'active') as Family | undefined;
  if (existing) {
    throw new Error('You already belong to a family');
  }

  const familyId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const familyName = name || 'My Family';

  // Get user email
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string };

  db.prepare(
    'INSERT INTO families (id, name, owner_id) VALUES (?, ?, ?)'
  ).run(familyId, familyName, userId);

  db.prepare(
    `INSERT INTO family_members (id, family_id, user_id, email, role, status, joined_at)
     VALUES (?, ?, ?, ?, 'owner', 'active', datetime('now'))`
  ).run(memberId, familyId, userId, user.email);

  return {
    id: familyId,
    name: familyName,
    owner_id: userId,
    created_at: new Date().toISOString(),
    members: getFamilyMembers(familyId),
  };
}

export function getFamily(userId: string): (Family & { members: FamilyMember[] }) | null {
  const family = db.prepare(
    `SELECT f.* FROM families f
     JOIN family_members fm ON fm.family_id = f.id
     WHERE fm.user_id = ? AND fm.status IN ('active', 'pending')`
  ).get(userId) as Family | undefined;

  if (!family) return null;

  return {
    ...family,
    members: getFamilyMembers(family.id),
  };
}

export function inviteMember(ownerId: string, email: string): FamilyMember {
  // Find family where user is owner
  const family = db.prepare(
    `SELECT f.* FROM families f
     JOIN family_members fm ON fm.family_id = f.id
     WHERE fm.user_id = ? AND fm.role = 'owner' AND fm.status = 'active'`
  ).get(ownerId) as Family | undefined;

  if (!family) {
    throw new Error('Only the family owner can invite members');
  }

  // Check member count
  const memberCount = db.prepare(
    'SELECT COUNT(*) as count FROM family_members WHERE family_id = ?'
  ).get(family.id) as { count: number };

  if (memberCount.count >= 5) {
    throw new Error('Maximum 5 members per family');
  }

  // Check if already invited
  const existingMember = db.prepare(
    'SELECT id FROM family_members WHERE family_id = ? AND email = ?'
  ).get(family.id, email) as { id: string } | undefined;

  if (existingMember) {
    throw new Error('This email has already been invited');
  }

  const memberId = crypto.randomUUID();
  const inviteToken = crypto.randomBytes(32).toString('hex');

  // Get inviter name/email
  const inviter = db.prepare('SELECT email FROM users WHERE id = ?').get(ownerId) as { email: string };

  db.prepare(
    `INSERT INTO family_members (id, family_id, email, role, status, invite_token)
     VALUES (?, ?, ?, 'member', 'pending', ?)`
  ).run(memberId, family.id, email, inviteToken);

  // Send invite email
  sendFamilyInviteEmail(email, inviter.email, inviteToken);

  return db.prepare('SELECT * FROM family_members WHERE id = ?').get(memberId) as unknown as FamilyMember;
}

export function acceptInvite(token: string, userId: string): FamilyMember {
  const member = db.prepare(
    'SELECT * FROM family_members WHERE invite_token = ? AND status = ?'
  ).get(token, 'pending') as FamilyMember | undefined;

  if (!member) {
    throw new Error('Invalid or expired invite token');
  }

  // Check user doesn't already belong to a family
  const existingFamily = db.prepare(
    `SELECT fm.id FROM family_members fm WHERE fm.user_id = ? AND fm.status = 'active'`
  ).get(userId) as { id: string } | undefined;

  if (existingFamily) {
    throw new Error('You already belong to a family');
  }

  db.prepare(
    `UPDATE family_members SET user_id = ?, status = 'active', joined_at = datetime('now'), invite_token = NULL
     WHERE id = ?`
  ).run(userId, member.id);

  return db.prepare('SELECT * FROM family_members WHERE id = ?').get(member.id) as unknown as FamilyMember;
}

export function removeMember(ownerId: string, memberId: string): void {
  // Verify caller is owner
  const ownerMember = db.prepare(
    `SELECT fm.family_id FROM family_members fm WHERE fm.user_id = ? AND fm.role = 'owner' AND fm.status = 'active'`
  ).get(ownerId) as { family_id: string } | undefined;

  if (!ownerMember) {
    throw new Error('Only the family owner can remove members');
  }

  // Verify target is in same family and not the owner
  const target = db.prepare(
    'SELECT * FROM family_members WHERE id = ? AND family_id = ?'
  ).get(memberId, ownerMember.family_id) as FamilyMember | undefined;

  if (!target) {
    throw new Error('Member not found');
  }

  if (target.role === 'owner') {
    throw new Error('Cannot remove the family owner');
  }

  db.prepare('DELETE FROM family_members WHERE id = ?').run(memberId);
}

export function leaveFamily(userId: string): void {
  const member = db.prepare(
    `SELECT * FROM family_members WHERE user_id = ? AND status = 'active'`
  ).get(userId) as FamilyMember | undefined;

  if (!member) {
    throw new Error('You are not in a family');
  }

  if (member.role === 'owner') {
    throw new Error('The owner cannot leave the family. Delete it instead.');
  }

  db.prepare('DELETE FROM family_members WHERE id = ?').run(member.id);
}

export function getFamilyMembers(familyId: string): FamilyMember[] {
  return db.prepare(
    'SELECT * FROM family_members WHERE family_id = ? ORDER BY role DESC, invited_at ASC'
  ).all(familyId) as unknown as FamilyMember[];
}
