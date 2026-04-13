import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Sparkles,
  ShoppingBag,
  Smartphone,
  Briefcase,
  Home,
  Scissors,
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Zap,
} from 'lucide-react';
import api from '../api/client';
import useTrack from '../hooks/useTrack';

/* ── types ── */

interface RunwayData {
  runwayDays: number;
  runoutDate: string;
  dailyBurnRate: number;
  spendableBalance: number;
  remainingBudget: number;
  amount: string;
  daysToPayday: number;
}

type ScenarioKind = 'one-time-expense' | 'monthly-expense' | 'monthly-income';

interface ScenarioTemplate {
  key: string;
  icon: React.ReactNode;
  title: string;
  placeholder: string;
  kind: ScenarioKind;
}

interface ActiveScenario {
  id: string;
  templateKey: string;
  title: string;
  amount: number;
  kind: ScenarioKind;
  icon: React.ReactNode;
}

/* ── scenario templates ── */

const TEMPLATES: ScenarioTemplate[] = [
  { key: 'big-purchase', icon: <ShoppingBag className="w-5 h-5" />, title: 'Big Purchase', placeholder: 'e.g. 500', kind: 'one-time-expense' },
  { key: 'new-sub', icon: <Smartphone className="w-5 h-5" />, title: 'New Subscription', placeholder: 'e.g. 15', kind: 'monthly-expense' },
  { key: 'side-income', icon: <Briefcase className="w-5 h-5" />, title: 'Side Income', placeholder: 'e.g. 800', kind: 'monthly-income' },
  { key: 'rent-increase', icon: <Home className="w-5 h-5" />, title: 'Rent Increase', placeholder: 'e.g. 200', kind: 'monthly-expense' },
  { key: 'cut-bill', icon: <Scissors className="w-5 h-5" />, title: 'Cut a Bill', placeholder: 'e.g. 50', kind: 'monthly-income' },
  { key: 'custom', icon: <Plus className="w-5 h-5" />, title: 'Custom', placeholder: 'Amount', kind: 'one-time-expense' },
];

const kindLabel = (k: ScenarioKind) =>
  k === 'one-time-expense' ? 'One-time' : k === 'monthly-expense' ? 'Monthly cost' : 'Monthly saving';

const kindColor = (k: ScenarioKind) =>
  k === 'one-time-expense'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : k === 'monthly-expense'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';

/* ── component ── */

export default function Simulator() {
  const track = useTrack('simulator');
  const [runway, setRunway] = useState<RunwayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scenarios, setScenarios] = useState<ActiveScenario[]>([]);

  // Per-card input state
  const [cardInputs, setCardInputs] = useState<Record<string, string>>({});
  // Custom card extra fields
  const [customName, setCustomName] = useState('');
  const [customKind, setCustomKind] = useState<ScenarioKind>('one-time-expense');

  // Ref for auto-scrolling to results
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/runway')
      .then(r => setRunway(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const addScenario = useCallback((template: ScenarioTemplate, overrideKind?: ScenarioKind) => {
    const raw = cardInputs[template.key];
    const amount = parseFloat(raw);
    if (isNaN(amount) || amount <= 0) return;
    track('simulator', 'add_scenario');

    const kind = overrideKind ?? template.kind;
    const title = template.key === 'custom' && customName.trim()
      ? customName.trim()
      : template.title;

    setScenarios(prev => [...prev, {
      id: crypto.randomUUID(),
      templateKey: template.key,
      title,
      amount,
      kind,
      icon: template.icon,
    }]);

    // Reset the card input
    setCardInputs(prev => ({ ...prev, [template.key]: '' }));
    if (template.key === 'custom') {
      setCustomName('');
      setCustomKind('one-time-expense');
    }
  }, [cardInputs, customName, customKind]);

  const removeScenario = (id: string) => {
    setScenarios(prev => prev.filter(s => s.id !== id));
  };

  // Auto-scroll to results when scenarios are added
  useEffect(() => {
    if (scenarios.length > 0 && resultsRef.current) {
      // Small delay to let the DOM update
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [scenarios.length]);

  /* ── loading / error ── */
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-36 rounded-2xl bg-gradient-to-r from-violet-100 to-purple-100" />
        <div className="h-24 rounded-2xl bg-gray-100" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 rounded-2xl bg-gray-100" />)}
        </div>
      </div>
    );
  }

  if (!runway) {
    return (
      <div className="bg-white border border-red-200 rounded-2xl p-5 flex items-center gap-3 shadow-sm">
        <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
          <span className="text-red-500 text-sm font-bold">!</span>
        </div>
        <p className="text-sm text-slate-700">Failed to load data. Please try again.</p>
      </div>
    );
  }

  /* ── math ── */
  const currentBalance = runway.spendableBalance;
  const currentBurnRate = runway.dailyBurnRate;
  const currentRunwayDays = runway.runwayDays;

  const totalOneTimeExpense = scenarios
    .filter(s => s.kind === 'one-time-expense')
    .reduce((sum, s) => sum + s.amount, 0);

  const totalMonthlyExpense = scenarios
    .filter(s => s.kind === 'monthly-expense')
    .reduce((sum, s) => sum + s.amount, 0);

  const totalMonthlyIncome = scenarios
    .filter(s => s.kind === 'monthly-income')
    .reduce((sum, s) => sum + s.amount, 0);

  const monthlyNetImpact = totalMonthlyExpense - totalMonthlyIncome;
  const additionalDaily = monthlyNetImpact / 30;

  const newBalance = currentBalance - totalOneTimeExpense;
  const newBurnRate = currentBurnRate + additionalDaily;
  const newRunwayDays = newBurnRate > 0 ? Math.max(0, Math.floor(newBalance / newBurnRate)) : 999;

  const daysDiff = newRunwayDays - currentRunwayDays;
  const hasScenarios = scenarios.length > 0;

  const maxBar = Math.max(currentRunwayDays, newRunwayDays, 1);
  const currentBarPct = (currentRunwayDays / maxBar) * 100;
  const newBarPct = (newRunwayDays / maxBar) * 100;

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg bg-gradient-to-br from-violet-500 to-purple-600">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.12) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 40%)',
          }}
        />
        <div className="pointer-events-none absolute inset-0 backdrop-blur-[1px] bg-white/[0.04]" />
        <div className="relative z-10 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-white/70" />
            <p className="text-sm font-medium text-white/80 uppercase tracking-wider">Simulator</p>
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">What If</p>
          <p className="text-sm text-white/70 mt-1 max-w-sm leading-relaxed">
            See how decisions affect your runway before you make them
          </p>
        </div>
      </div>

      {/* ── Current Runway Baseline ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 bg-violet-50 rounded-lg">
            <Zap className="w-4 h-4 text-violet-600" />
          </div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Current Baseline</p>
        </div>
        <div className="flex items-end gap-2 mt-2">
          <p className="text-4xl font-extrabold text-gray-900 leading-none">{currentRunwayDays}</p>
          <p className="text-lg text-gray-500 font-medium pb-0.5">days of runway</p>
        </div>
        <div className="flex gap-4 mt-3 text-xs text-gray-400">
          <span>${currentBurnRate.toFixed(0)}/day burn rate</span>
          <span>${currentBalance.toLocaleString()} available</span>
        </div>
      </div>

      {/* ── Scenario Builder ── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <ArrowRight className="w-4 h-4 text-violet-500" />
          Build Your Scenario
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {TEMPLATES.map(tmpl => (
            <div
              key={tmpl.key}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-violet-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-violet-50 rounded-lg text-violet-600 group-hover:bg-violet-100 transition-colors">
                  {tmpl.icon}
                </div>
                <p className="text-sm font-semibold text-gray-800">{tmpl.title}</p>
              </div>

              {/* Custom card: extra name + kind picker */}
              {tmpl.key === 'custom' && (
                <div className="mb-2 space-y-2">
                  <input
                    type="text"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="Scenario name"
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent outline-none transition-shadow"
                  />
                  <div className="flex gap-1">
                    {(['one-time-expense', 'monthly-expense', 'monthly-income'] as ScenarioKind[]).map(k => (
                      <button
                        key={k}
                        onClick={() => setCustomKind(k)}
                        className={`flex-1 text-[10px] font-semibold py-1 rounded-lg border transition-colors ${
                          customKind === k
                            ? 'bg-violet-100 border-violet-300 text-violet-700'
                            : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
                        }`}
                      >
                        {k === 'one-time-expense' ? 'Once' : k === 'monthly-expense' ? '+Cost' : '+Save'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={cardInputs[tmpl.key] || ''}
                    onChange={e => setCardInputs(prev => ({ ...prev, [tmpl.key]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') addScenario(tmpl, tmpl.key === 'custom' ? customKind : undefined);
                    }}
                    placeholder={tmpl.placeholder}
                    className="w-full pl-7 pr-2 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent outline-none transition-shadow"
                  />
                </div>
                <button
                  onClick={() => addScenario(tmpl, tmpl.key === 'custom' ? customKind : undefined)}
                  disabled={!cardInputs[tmpl.key] || parseFloat(cardInputs[tmpl.key]) <= 0}
                  className="px-3 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Active Scenarios List ── */}
      {hasScenarios && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Active Scenarios</h2>
            <button
              onClick={() => setScenarios([])}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {scenarios.map(s => (
              <div
                key={s.id}
                className={`inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border text-sm font-medium transition-all ${kindColor(s.kind)}`}
              >
                <span className="opacity-60">{s.icon}</span>
                <span>{s.title}</span>
                <span className="font-bold">${s.amount.toLocaleString()}</span>
                <span className="text-[10px] opacity-60">{kindLabel(s.kind)}</span>
                <button
                  onClick={() => removeScenario(s.id)}
                  className="p-0.5 rounded-full hover:bg-black/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          {/* Running totals */}
          <div className="flex gap-4 mt-3 text-xs text-gray-400">
            {totalOneTimeExpense > 0 && <span>One-time: ${totalOneTimeExpense.toLocaleString()}</span>}
            {totalMonthlyExpense > 0 && <span>+${totalMonthlyExpense}/mo costs</span>}
            {totalMonthlyIncome > 0 && <span>-${totalMonthlyIncome}/mo savings</span>}
            {monthlyNetImpact !== 0 && (
              <span className={monthlyNetImpact > 0 ? 'text-rose-500' : 'text-emerald-500'}>
                Net: {monthlyNetImpact > 0 ? '+' : ''}${monthlyNetImpact.toFixed(0)}/mo
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Results Panel ── */}
      {hasScenarios && (
        <div ref={resultsRef} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            {daysDiff >= 0
              ? <TrendingUp className="w-4 h-4 text-emerald-500" />
              : <TrendingDown className="w-4 h-4 text-rose-500" />}
            Impact Analysis
          </h2>

          {/* Visual comparison bars */}
          <div className="space-y-3">
            {/* Current */}
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="font-medium">Current</span>
                <span className="font-bold text-gray-700">{currentRunwayDays} days</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden">
                <div
                  className="h-5 rounded-full bg-gradient-to-r from-slate-400 to-slate-500 transition-all duration-500"
                  style={{ width: `${currentBarPct}%` }}
                />
              </div>
            </div>

            {/* After changes */}
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="font-medium">After Changes</span>
                <span className={`font-bold ${daysDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {newRunwayDays} days
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden">
                <div
                  className={`h-5 rounded-full transition-all duration-500 ${
                    daysDiff >= 0
                      ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                      : 'bg-gradient-to-r from-rose-400 to-rose-500'
                  }`}
                  style={{ width: `${newBarPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Delta */}
          <div className={`flex items-center justify-center gap-3 py-4 rounded-2xl ${
            daysDiff > 0
              ? 'bg-emerald-50 border border-emerald-200'
              : daysDiff < 0
                ? 'bg-rose-50 border border-rose-200'
                : 'bg-gray-50 border border-gray-200'
          }`}>
            {daysDiff > 0 ? (
              <TrendingUp className="w-6 h-6 text-emerald-500" />
            ) : daysDiff < 0 ? (
              <TrendingDown className="w-6 h-6 text-rose-500" />
            ) : null}
            <span className={`text-2xl font-extrabold ${
              daysDiff > 0 ? 'text-emerald-700' : daysDiff < 0 ? 'text-rose-700' : 'text-gray-700'
            }`}>
              {daysDiff === 0 ? 'No change' : daysDiff > 0 ? `+${daysDiff} days` : `${daysDiff} days`}
            </span>
          </div>

          {/* Contextual message */}
          {daysDiff > 0 && (
            <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <Sparkles className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Your runway would improve!</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  These changes add {daysDiff} day{daysDiff !== 1 ? 's' : ''} of financial breathing room. Nice move.
                </p>
              </div>
            </div>
          )}
          {daysDiff < 0 && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <TrendingDown className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">This would cost you {Math.abs(daysDiff)} day{Math.abs(daysDiff) !== 1 ? 's' : ''}</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Your runway would drop from {currentRunwayDays} to {newRunwayDays} days. Make sure this is worth it.
                </p>
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
            <div className="text-center">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">One-time</p>
              <p className="text-sm font-bold text-gray-900 mt-1">${totalOneTimeExpense.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Monthly net</p>
              <p className={`text-sm font-bold mt-1 ${monthlyNetImpact > 0 ? 'text-rose-600' : monthlyNetImpact < 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                {monthlyNetImpact >= 0 ? '+' : ''}{monthlyNetImpact < 0 ? '-' : ''}${Math.abs(monthlyNetImpact).toFixed(0)}/mo
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">New burn</p>
              <p className="text-sm font-bold text-gray-900 mt-1">${newBurnRate.toFixed(0)}/day</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
