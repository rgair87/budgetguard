import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Target, Sparkles, Check, AlertTriangle, TrendingUp, ArrowRight, XCircle, Receipt } from 'lucide-react';
import api from '../api/client';
import { BUDGETABLE_CATEGORIES } from '@spenditure/shared';
import type { BudgetWithSuggestion } from '@spenditure/shared';
import useTrack from '../hooks/useTrack';
import useTier from '../hooks/useTier';
import UpgradeCard from '../components/UpgradeCard';

const CATEGORY_COLORS: Record<string, string> = {
  'Housing': 'bg-slate-500', 'Groceries': 'bg-green-500', 'Utilities': 'bg-teal-500',
  'Transportation': 'bg-blue-500', 'Gas': 'bg-yellow-500', 'Insurance': 'bg-indigo-500',
  'Healthcare': 'bg-red-500', 'Phone & Internet': 'bg-cyan-500', 'Childcare': 'bg-purple-500',
  'Food & Dining': 'bg-orange-500', 'Entertainment': 'bg-purple-500', 'Shopping': 'bg-pink-500',
  'Subscriptions': 'bg-violet-500', 'Personal Care': 'bg-rose-500', 'Travel': 'bg-sky-500',
  'Education': 'bg-emerald-500', 'Pets': 'bg-amber-500', 'Gifts': 'bg-fuchsia-500',
  'Home Improvement': 'bg-lime-500', 'Services': 'bg-cyan-600', 'Bills': 'bg-slate-400',
  'Other': 'bg-gray-400',
};

export default function Budgets() {
  const track = useTrack('budgets');
  const { tier } = useTier();
  const [budgets, setBudgets] = useState<BudgetWithSuggestion[]>([]);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/runway/budgets')
      .then(r => {
        const items: BudgetWithSuggestion[] = r.data.budgets || [];
        setBudgets(items);
        const initial: Record<string, number> = {};
        for (const b of items) {
          if (b.monthly_limit > 0) initial[b.category] = b.monthly_limit;
        }
        setEdits(initial);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function setEditValue(category: string, value: string) {
    const num = parseFloat(value);
    if (value === '' || value === '0') {
      const next = { ...edits };
      delete next[category];
      setEdits(next);
    } else if (!isNaN(num) && num >= 0) {
      setEdits(prev => ({ ...prev, [category]: num }));
    }
  }

  function applySuggestions() {
    const next = { ...edits };
    for (const b of budgets) {
      if (b.suggested && !next[b.category]) {
        next[b.category] = b.suggested;
      }
    }
    setEdits(next);
  }

  const [saveError, setSaveError] = useState(false);

  async function saveBudgets() {
    setSaving(true);
    setSaved(false);
    setSaveError(false);
    try {
      const allCategories = new Set([
        ...budgets.map(b => b.category),
        ...Object.keys(edits),
      ]);
      const payload = [...allCategories].map(category => ({
        category,
        monthly_limit: edits[category] || 0,
      }));
      await api.put('/runway/budgets', { budgets: payload });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 5000);
    }
    setSaving(false);
  }

  const hasEdits = budgets.some(b => {
    const edited = edits[b.category];
    const original = b.monthly_limit || 0;
    return (edited || 0) !== original;
  });

  const hasSuggestions = budgets.some(b => b.suggested && !edits[b.category]);
  const totalBudget = Object.values(edits).reduce((s, v) => s + v, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.currentSpend, 0);
  const budgetCount = Object.keys(edits).length;

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto animate-pulse">
        <div className="h-28 bg-slate-100 rounded-2xl" />
        <div className="h-64 bg-slate-100 rounded-2xl" />
      </div>
    );
  }

  if (budgets.length === 0) {
    return (
      <div className="text-center py-16 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
          <Target className="w-8 h-8 text-indigo-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No spending data yet</h2>
        <p className="text-gray-500 text-sm mb-6">
          Import transactions or link your bank account, then come back to set budgets based on your actual spending patterns.
        </p>
        <div className="flex justify-center gap-3">
          <Link to="/csv-upload" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">Import CSV</Link>
          <span className="text-slate-300">|</span>
          <Link to="/settings" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">Link bank</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Summary card */}
      <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-white/60" />
          <p className="text-xs font-medium text-white/60 uppercase tracking-wider">Monthly Budgets</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-bold text-white">{budgetCount}</p>
            <p className="text-xs text-white/60">categories</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">${totalBudget.toLocaleString()}</p>
            <p className="text-xs text-white/60">budgeted/mo</p>
          </div>
          <div>
            <p className={`text-2xl font-bold ${totalSpent > totalBudget && totalBudget > 0 ? 'text-red-200' : 'text-white'}`}>
              ${totalSpent.toLocaleString()}
            </p>
            <p className="text-xs text-white/60">spent this mo</p>
          </div>
        </div>
      </div>

      {/* Suggestions banner */}
      {hasSuggestions && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <p className="text-sm text-indigo-700">We calculated suggestions based on your 3-month spending averages.</p>
          </div>
          <button
            onClick={applySuggestions}
            className="text-xs font-semibold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            Apply all
          </button>
        </div>
      )}

      {/* Category cards */}
      <div className="space-y-3">
        {budgets.map(b => {
          const catDef = BUDGETABLE_CATEGORIES.find(c => c.name === b.category);
          const isNecessity = catDef?.type === 'necessity';
          const budgetVal = edits[b.category] || 0;
          const pctUsed = budgetVal > 0 ? Math.min(100, Math.round((b.currentSpend / budgetVal) * 100)) : 0;
          const isOver = budgetVal > 0 && b.currentSpend > budgetVal;
          const barColor = CATEGORY_COLORS[b.category] || 'bg-gray-400';

          return (
            <div key={b.category} className={`bg-white rounded-2xl shadow-sm border p-4 transition-all ${isOver ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
              {/* Top row: name + budget input */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-3 h-3 rounded-full ${barColor} shrink-0`} />
                  <p className="text-sm font-semibold text-slate-800 truncate">{b.category}</p>
                  {isNecessity && (
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full shrink-0">essential</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-slate-400">$</span>
                  <input
                    type="number"
                    min="0"
                    step="25"
                    value={edits[b.category] ?? ''}
                    placeholder={b.suggested ? String(b.suggested) : '0'}
                    onChange={e => setEditValue(b.category, e.target.value)}
                    className="w-20 text-right text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                  />
                  <span className="text-xs text-slate-400">/mo</span>
                </div>
              </div>

              {/* Progress bar - thicker and more visual */}
              <div className="bg-slate-100 rounded-full h-2.5 mb-2">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : barColor}`}
                  style={{ width: `${Math.min(100, budgetVal > 0 ? (b.currentSpend / budgetVal) * 100 : 0)}%` }}
                />
              </div>

              {/* Bottom row: spent + status + drilldown */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-slate-500">
                    <span className="font-medium text-slate-700">${b.currentSpend.toLocaleString()}</span> spent
                  </p>
                  {b.currentSpend > 0 && (
                    <Link
                      to={`/transactions?search=${encodeURIComponent(b.category)}`}
                      className="text-[11px] text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-0.5 transition-colors"
                    >
                      <Receipt className="w-3 h-3" /> View
                    </Link>
                  )}
                </div>
                {isOver ? (
                  <span className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> ${Math.round(b.currentSpend - budgetVal).toLocaleString()} over
                  </span>
                ) : budgetVal > 0 ? (
                  <span className="text-[11px] text-slate-400">{pctUsed}% used</span>
                ) : b.suggested ? (
                  <span className="text-[11px] text-slate-400">avg ~${b.suggested}/mo</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upgrade prompt when at free tier budget limit */}
      {tier === 'free' && budgetCount >= 3 && (
        <UpgradeCard
          feature="Unlimited budget categories"
          description="Free accounts can track 3 categories. Upgrade to set budgets for every spending category."
          tierNeeded="plus"
        />
      )}

      {/* Save bar */}
      <div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {saved ? (
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Budgets saved. Alerts are active.
              </span>
            ) : hasEdits ? (
              'You have unsaved changes'
            ) : budgetCount > 0 ? (
              `${budgetCount} budget${budgetCount !== 1 ? 's' : ''} active`
            ) : (
              'Set limits to get budget alerts'
            )}
          </p>
          <div className="flex items-center gap-3">
            {saveError && (
              <span className="flex items-center gap-1 text-sm text-red-600">
                <XCircle className="w-4 h-4" /> Failed to save
              </span>
            )}
            <button
              onClick={saveBudgets}
              disabled={saving || !hasEdits}
              className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2 rounded-xl disabled:opacity-40 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Budgets'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
