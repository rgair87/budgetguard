import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Target, Sparkles, Check, AlertTriangle, TrendingUp, ArrowRight, XCircle, Receipt } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialEdits = useRef<Record<string, number>>({});

  // Track initial state to detect real changes
  useEffect(() => {
    if (budgets.length > 0 && Object.keys(initialEdits.current).length === 0) {
      const initial: Record<string, number> = {};
      for (const b of budgets) {
        if (b.monthly_limit > 0) initial[b.category] = b.monthly_limit;
      }
      initialEdits.current = initial;
    }
  }, [budgets]);

  const hasEdits = budgets.some(b => {
    const edited = edits[b.category];
    const original = b.monthly_limit || 0;
    return (edited || 0) !== original;
  });

  // Auto-save with 1.5s debounce
  const doSave = useCallback(async () => {
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
  }, [budgets, edits]);

  useEffect(() => {
    if (!hasEdits || budgets.length === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [edits, hasEdits, doSave]);

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
      {/* Summary with donut chart */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
        <div className="flex items-center gap-6">
          {/* Donut chart */}
          <div className="w-32 h-32 shrink-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Spent', value: Math.min(totalSpent, totalBudget || totalSpent) },
                    { name: 'Remaining', value: Math.max(0, (totalBudget || totalSpent) - totalSpent) },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={52}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  strokeWidth={0}
                >
                  <Cell fill={totalSpent > totalBudget && totalBudget > 0 ? '#ef4444' : '#4f46e5'} />
                  <Cell fill="#f1f5f9" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-lg font-bold text-slate-900">{totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}%</p>
                <p className="text-[9px] text-slate-400">used</p>
              </div>
            </div>
          </div>

          {/* Key metrics */}
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-xs text-slate-500">Budgeted</p>
              <p className="text-xl font-bold text-slate-900">${totalBudget.toLocaleString()}<span className="text-sm font-normal text-slate-400">/mo</span></p>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-slate-500">Spent</p>
                <p className={`text-base font-semibold ${totalSpent > totalBudget && totalBudget > 0 ? 'text-red-600' : 'text-slate-900'}`}>${totalSpent.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Remaining</p>
                <p className="text-base font-semibold text-emerald-600">${Math.max(0, totalBudget - totalSpent).toLocaleString()}</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">{new Date().getDate()} of ~30 days into the month</p>
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

      {/* Rebalancing suggestion */}
      {(() => {
        const overCategories = budgets.filter(b => {
          const bv = edits[b.category] || 0;
          return bv > 0 && b.currentSpend > bv;
        });
        const underCategories = budgets.filter(b => {
          const bv = edits[b.category] || 0;
          return bv > 0 && b.currentSpend < bv * 0.5 && new Date().getDate() > 15;
        });
        if (overCategories.length === 0 || underCategories.length === 0) return null;
        const over = overCategories[0];
        const under = underCategories[0];
        const overAmount = Math.round(over.currentSpend - (edits[over.category] || 0));
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-medium text-amber-900">
              You're ${overAmount} over on {over.category}.
            </p>
            <p className="text-xs text-amber-700 mt-1">
              {under.category} is only {Math.round((under.currentSpend / (edits[under.category] || 1)) * 100)}% used. Move ${overAmount} from {under.category} to cover it?
            </p>
            <button
              onClick={() => {
                const newEdits = { ...edits };
                newEdits[over.category] = (edits[over.category] || 0) + overAmount;
                newEdits[under.category] = Math.max(0, (edits[under.category] || 0) - overAmount);
                for (const [k, v] of Object.entries(newEdits)) {
                  setEditValue(k, String(v));
                }
              }}
              className="mt-2 text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              Rebalance budgets
            </button>
          </div>
        );
      })()}

      {/* Category cards - grouped by needs vs wants */}
      {[
        { label: 'Essentials', filter: (b: BudgetWithSuggestion) => BUDGETABLE_CATEGORIES.find(c => c.name === b.category)?.type === 'necessity' },
        { label: 'Discretionary', filter: (b: BudgetWithSuggestion) => BUDGETABLE_CATEGORIES.find(c => c.name === b.category)?.type !== 'necessity' },
      ].map(group => {
        const groupBudgets = budgets.filter(group.filter);
        if (groupBudgets.length === 0) return null;
        const groupSpent = groupBudgets.reduce((s, b) => s + b.currentSpend, 0);
        const groupBudgeted = groupBudgets.reduce((s, b) => s + (edits[b.category] || 0), 0);
        return (
        <div key={group.label}>
          <div className="flex items-center justify-between mb-3 mt-2">
            <div className="flex items-center gap-2">
              <div className={`w-1 h-5 rounded-full ${group.label === 'Essentials' ? 'bg-blue-500' : 'bg-violet-500'}`} />
              <p className="text-sm font-semibold text-slate-800">{group.label}</p>
              <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {groupBudgets.length} {groupBudgets.length === 1 ? 'category' : 'categories'}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500">${groupSpent.toLocaleString()} of ${groupBudgeted.toLocaleString()}</p>
          </div>
          <div className="space-y-2">
        {groupBudgets.map(b => {
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
                      to={`/transactions?category=${encodeURIComponent(b.category)}&dateFrom=this_month&spendingOnly=true`}
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
                ) : budgetVal > 0 && pctUsed >= 70 && new Date().getDate() < 20 ? (
                  <span className="text-[11px] font-medium text-amber-600">
                    {pctUsed}% used, {30 - new Date().getDate()}d left
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
        </div>
        );
      })}

      {/* Upgrade prompt when at free tier budget limit */}
      {tier === 'free' && budgetCount >= 3 && (
        <UpgradeCard
          feature="Unlimited budget categories"
          description="Free accounts can track 3 categories. Upgrade to set budgets for every spending category."
          tierNeeded="plus"
        />
      )}

      {/* Auto-save status toast */}
      {(saving || saved || saveError) && (
        <div className={`text-center py-2 rounded-xl text-xs font-medium transition-all ${
          saveError ? 'bg-red-50 text-red-600' :
          saved ? 'bg-emerald-50 text-emerald-600' :
          'bg-slate-50 text-slate-400'
        }`}>
          {saveError ? (
            <span className="flex items-center justify-center gap-1"><XCircle className="w-3.5 h-3.5" /> Failed to save. Try again.</span>
          ) : saved ? (
            <span className="flex items-center justify-center gap-1"><Check className="w-3.5 h-3.5" /> Saved</span>
          ) : (
            'Saving...'
          )}
        </div>
      )}
    </div>
  );
}
