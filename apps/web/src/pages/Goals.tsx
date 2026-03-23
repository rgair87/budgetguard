import { useEffect, useState } from 'react';
import api from '../api/client';

interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  icon: string;
  percent: number;
  remaining: number;
  onTrack: boolean | null;
  dailyNeeded: number | null;
  daysLeft: number | null;
  created_at: string;
}

const ICONS = ['🎯', '🏠', '🚗', '✈️', '🎓', '💰', '🛡️', '🎁', '💍', '🏖️', '📱', '🏥'];

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', target_amount: '', current_amount: '', deadline: '', icon: '🎯' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadGoals();
  }, []);

  function loadGoals() {
    setLoading(true);
    api.get('/goals')
      .then(r => setGoals(r.data.goals))
      .finally(() => setLoading(false));
  }

  async function handleCreate() {
    if (!form.name || !form.target_amount) return;
    setSaving(true);
    try {
      await api.post('/goals', {
        name: form.name,
        target_amount: parseFloat(form.target_amount),
        current_amount: parseFloat(form.current_amount) || 0,
        deadline: form.deadline || undefined,
        icon: form.icon,
      });
      setForm({ name: '', target_amount: '', current_amount: '', deadline: '', icon: '🎯' });
      setShowAdd(false);
      loadGoals();
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMoney(goalId: string) {
    const amt = parseFloat(addAmount[goalId]);
    if (!amt || amt <= 0) return;
    await api.post(`/goals/${goalId}/add`, { amount: amt });
    setAddAmount(prev => ({ ...prev, [goalId]: '' }));
    loadGoals();
  }

  async function handleDelete(goalId: string) {
    await api.delete(`/goals/${goalId}`);
    loadGoals();
  }

  function progressColor(pct: number): string {
    if (pct >= 100) return 'bg-emerald-500';
    if (pct >= 75) return 'bg-green-500';
    if (pct >= 50) return 'bg-blue-500';
    if (pct >= 25) return 'bg-indigo-500';
    return 'bg-indigo-400';
  }

  if (loading) return <div className="text-gray-500 text-center py-12">Loading goals...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Savings Goals</h1>
          <p className="text-sm text-gray-500">Track progress toward the things that matter.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700"
        >
          + New Goal
        </button>
      </div>

      {/* Add goal form */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-medium text-gray-900">New savings goal</h3>

          {/* Icon picker */}
          <div className="flex gap-2 flex-wrap">
            {ICONS.map(icon => (
              <button
                key={icon}
                onClick={() => setForm({ ...form, icon })}
                className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center ${
                  form.icon === icon ? 'bg-indigo-100 ring-2 ring-indigo-500' : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Goal name (e.g. Emergency Fund)"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="col-span-2 text-sm border border-gray-300 rounded-md px-3 py-2"
            />
            <div className="relative">
              <span className="absolute left-3 top-2 text-sm text-gray-400">$</span>
              <input
                type="number"
                step="0.01"
                placeholder="Target amount"
                value={form.target_amount}
                onChange={e => setForm({ ...form, target_amount: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded-md pl-7 pr-3 py-2"
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2 text-sm text-gray-400">$</span>
              <input
                type="number"
                step="0.01"
                placeholder="Already saved (optional)"
                value={form.current_amount}
                onChange={e => setForm({ ...form, current_amount: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded-md pl-7 pr-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Target date (optional)</label>
            <input
              type="date"
              value={form.deadline}
              onChange={e => setForm({ ...form, deadline: e.target.value })}
              className="text-sm border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="text-sm text-gray-500 px-3 py-1.5">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={saving || !form.name || !form.target_amount}
              className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-md font-medium disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Goal'}
            </button>
          </div>
        </div>
      )}

      {/* Goals list */}
      {goals.length === 0 && !showAdd && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🎯</p>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No goals yet</h2>
          <p className="text-sm text-gray-500 mb-4">Set a savings goal to start tracking your progress.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="text-sm text-indigo-600 font-medium hover:underline"
          >
            Create your first goal
          </button>
        </div>
      )}

      <div className="space-y-4">
        {goals.map(goal => (
          <div key={goal.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-3xl">{goal.icon}</span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900">{goal.name}</h3>
                  <p className="text-sm text-gray-500">
                    ${goal.current_amount.toLocaleString()} of ${goal.target_amount.toLocaleString()}
                    {goal.deadline && (
                      <span className="ml-2">
                        &middot; {goal.daysLeft !== null && goal.daysLeft > 0
                          ? `${goal.daysLeft} days left`
                          : goal.daysLeft === 0 ? 'Due today' : 'Past due'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {goal.percent >= 100 && (
                  <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    Complete!
                  </span>
                )}
                <button
                  onClick={() => handleDelete(goal.id)}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  Remove
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-gray-700">{Math.min(goal.percent, 100).toFixed(0)}%</span>
                <span className="text-gray-500">${goal.remaining.toLocaleString()} to go</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${progressColor(goal.percent)}`}
                  style={{ width: `${Math.min(goal.percent, 100)}%` }}
                />
              </div>
            </div>

            {/* On-track indicator */}
            {goal.onTrack !== null && goal.dailyNeeded !== null && goal.percent < 100 && (
              <div className={`mt-3 text-xs px-3 py-2 rounded-lg ${
                goal.onTrack ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {goal.onTrack
                  ? `On track — save $${goal.dailyNeeded.toFixed(0)}/day to reach your goal by ${new Date(goal.deadline! + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  : `Behind pace — need $${goal.dailyNeeded.toFixed(0)}/day to catch up (${goal.daysLeft} days left)`
                }
              </div>
            )}

            {/* Add money */}
            {goal.percent < 100 && (
              <div className="mt-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2 text-sm text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Add savings..."
                    value={addAmount[goal.id] || ''}
                    onChange={e => setAddAmount(prev => ({ ...prev, [goal.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleAddMoney(goal.id)}
                    className="w-full text-sm border border-gray-300 rounded-md pl-7 pr-3 py-2"
                  />
                </div>
                <button
                  onClick={() => handleAddMoney(goal.id)}
                  disabled={!addAmount[goal.id]}
                  className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-md font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
