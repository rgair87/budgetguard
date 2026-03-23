import { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Crown, Mail, X, LogOut } from 'lucide-react';
import api from '../api/client';

interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string | null;
  email: string;
  role: string;
  status: string;
  invited_at: string;
  joined_at: string | null;
}

interface Family {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  members: FamilyMember[];
}

export default function FamilyPage() {
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [error, setError] = useState('');
  const [inviting, setInviting] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchFamily = useCallback(async () => {
    try {
      const { data } = await api.get('/family');
      setFamily(data.family);
    } catch {
      setFamily(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFamily();
  }, [fetchFamily]);

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const { data } = await api.post('/family', { name: familyName || undefined });
      setFamily(data);
      setFamilyName('');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create family');
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError('');
    try {
      await api.post('/family/invite', { email: inviteEmail.trim() });
      setInviteEmail('');
      fetchFamily();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    setError('');
    try {
      await api.delete(`/family/members/${memberId}`);
      fetchFamily();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleLeave = async () => {
    if (!confirm('Are you sure you want to leave this family?')) return;
    setError('');
    try {
      await api.post('/family/leave');
      setFamily(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to leave family');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Determine if current user is owner
  const currentUserEmail = family?.members.find(m => m.role === 'owner')?.email;
  const isOwner = family?.members.some(m => m.role === 'owner' && m.status === 'active');

  // No family yet — show create CTA
  if (!family) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-indigo-50 flex items-center justify-center">
            <Users className="w-8 h-8 text-indigo-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Family Plan</h1>
          <p className="text-slate-500 mb-8">
            Manage finances together with your partner or family. Create a family to start inviting members.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <input
            type="text"
            placeholder="Family name (optional)"
            value={familyName}
            onChange={e => setFamilyName(e.target.value)}
            className="w-full px-4 py-3 mb-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Family'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
          <Users className="w-6 h-6 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{family.name}</h1>
          <p className="text-sm text-slate-500">
            {family.members.length} member{family.members.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Members list */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Members</h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {family.members.map(member => (
            <li key={member.id} className="flex items-center gap-4 px-6 py-4">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-indigo-600">
                  {member.email.charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 truncate">
                    {member.email}
                  </span>
                  {member.role === 'owner' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700">
                      <Crown className="w-3 h-3" />
                      Owner
                    </span>
                  )}
                  {member.role === 'member' && member.status === 'active' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-green-100 text-green-700">
                      Member
                    </span>
                  )}
                  {member.status === 'pending' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-500">
                      <Mail className="w-3 h-3" />
                      Pending
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {member.status === 'active'
                    ? `Joined ${member.joined_at ? new Date(member.joined_at).toLocaleDateString() : ''}`
                    : `Invited ${new Date(member.invited_at).toLocaleDateString()}`}
                </p>
              </div>

              {/* Actions */}
              {isOwner && member.role !== 'owner' && (
                <button
                  onClick={() => handleRemove(member.id)}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Remove member"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Invite form (owner only) */}
      {isOwner && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-500" />
            Invite Member
          </h2>
          <form onSubmit={handleInvite} className="flex gap-3">
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              required
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 text-sm"
            />
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
            >
              {inviting ? 'Sending...' : 'Send Invite'}
            </button>
          </form>
        </div>
      )}

      {/* Leave family (member only) */}
      {!isOwner && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Leave Family</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                You will no longer share finances with this family.
              </p>
            </div>
            <button
              onClick={handleLeave}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 font-semibold rounded-xl hover:bg-red-100 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              Leave
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
