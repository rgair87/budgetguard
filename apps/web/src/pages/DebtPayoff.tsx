import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import {
  TrendingDown,
  CreditCard,
  Zap,
  Target,
  DollarSign,
  Calendar,
  Award,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  CircleDollarSign,
  PartyPopper,
  Pencil,
} from 'lucide-react';
import useTrack from '../hooks/useTrack';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DebtAccount {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
  type?: string;
}

interface DebtPlan {
  strategy: 'avalanche' | 'snowball';
  strategyReason: string;
  debts: (DebtAccount & { isFocus: boolean; order: number })[];
  totalDebt: number;
  totalMinimumPayments: number;
  monthsToPayoff: number;
  totalInterestSaved: number;
  extraPayment: number;
}

interface SimResult {
  months: number;
  totalInterest: number;
  payoffOrder: { id: string; name: string; balance: number; payoffMonth: number }[];
}

/* ------------------------------------------------------------------ */
/*  Client-side payoff simulation (mirrors backend logic)              */
/* ------------------------------------------------------------------ */

function simulatePayoff(
  debts: DebtAccount[],
  priorityIds: string[],
  totalPayment: number,
): SimResult {
  if (debts.length === 0) return { months: 0, totalInterest: 0, payoffOrder: [] };

  const balances = new Map(debts.map(d => [d.id, d.balance]));
  const debtMap = new Map(debts.map(d => [d.id, d]));
  let months = 0;
  let totalInterest = 0;
  const maxMonths = 360;
  const payoffOrder: SimResult['payoffOrder'] = [];
  const paidOff = new Set<string>();

  while (months < maxMonths) {
    let remaining = 0;
    for (const [, bal] of balances) {
      if (bal > 0.01) remaining += bal;
    }
    if (remaining <= 0.01) break;

    months++;

    // Apply interest
    for (const d of debts) {
      const bal = balances.get(d.id)!;
      if (bal > 0.01) {
        const interest = bal * (d.interestRate / 100 / 12);
        totalInterest += interest;
        balances.set(d.id, bal + interest);
      }
    }

    // Pay minimums
    let available = totalPayment;
    for (const d of debts) {
      const bal = balances.get(d.id)!;
      if (bal > 0.01) {
        const payment = Math.min(d.minimumPayment, bal);
        balances.set(d.id, bal - payment);
        available -= payment;
      }
    }

    // Apply remaining to priority order (cascade)
    if (available > 0.01) {
      for (const id of priorityIds) {
        const bal = balances.get(id)!;
        if (bal > 0.01) {
          const extra = Math.min(available, bal);
          balances.set(id, bal - extra);
          available -= extra;
          if (available <= 0.01) break;
        }
      }
    }

    // Track payoff events
    for (const id of priorityIds) {
      if (!paidOff.has(id) && balances.get(id)! <= 0.01) {
        paidOff.add(id);
        const d = debtMap.get(id)!;
        payoffOrder.push({ id, name: d.name, balance: d.balance, payoffMonth: months });
      }
    }
  }

  return { months, totalInterest, payoffOrder };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatMonths(m: number): string {
  if (m <= 0) return '0 months';
  const y = Math.floor(m / 12);
  const mo = m % 12;
  if (y === 0) return `${mo} mo`;
  if (mo === 0) return `${y} yr`;
  return `${y} yr ${mo} mo`;
}

function payoffDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function debtTypeLabel(type?: string): string {
  switch (type) {
    case 'credit': return 'Credit Card';
    case 'auto_loan': return 'Auto Loan';
    case 'student_loan': return 'Student Loan';
    case 'personal_loan': return 'Personal Loan';
    case 'mortgage': return 'Mortgage';
    default: return 'Debt';
  }
}

function rateColor(rate: number): string {
  if (rate >= 20) return 'bg-red-500';
  if (rate >= 15) return 'bg-orange-500';
  if (rate >= 10) return 'bg-amber-500';
  if (rate >= 6) return 'bg-yellow-400';
  return 'bg-emerald-400';
}

/* ------------------------------------------------------------------ */
/*  Smart recommendation engine                                        */
/* ------------------------------------------------------------------ */

interface Recommendation {
  strategy: 'avalanche' | 'snowball';
  headline: string;
  explanation: string;
  icon: 'dollar' | 'target';
}

function getRecommendation(
  debts: DebtAccount[],
  avalanche: SimResult,
  snowball: SimResult,
): Recommendation {
  if (debts.length <= 1) {
    return {
      strategy: 'avalanche',
      headline: 'Focus all extra payments here',
      explanation: 'You have one debt, so no strategy comparison needed. Every extra dollar goes straight to paying it down faster.',
      icon: 'target',
    };
  }

  const rates = debts.map(d => d.interestRate);
  const maxRate = Math.max(...rates);
  const minRate = Math.min(...rates);
  const rateSpread = maxRate - minRate;

  const sorted = [...debts].sort((a, b) => a.balance - b.balance);
  const smallest = sorted[0];
  const smallestPayoffMonths = Math.ceil(smallest.balance / (smallest.minimumPayment || 50));
  const hasQuickWin = smallestPayoffMonths <= 6 && sorted.length > 1;

  const interestDiff = Math.round(snowball.totalInterest - avalanche.totalInterest);
  const highestRateDebt = [...debts].sort((a, b) => b.interestRate - a.interestRate)[0];
  const monthlyInterestOnHighest = highestRateDebt.balance * (highestRateDebt.interestRate / 100 / 12);

  // Strong rate spread -> avalanche
  if (rateSpread > 5 && interestDiff > 50) {
    return {
      strategy: 'avalanche',
      headline: 'Avalanche: tackle high interest first',
      explanation: `Your ${highestRateDebt.name} at ${highestRateDebt.interestRate}% APR costs you $${Math.round(monthlyInterestOnHighest)}/mo in interest alone. Paying it first saves you $${interestDiff.toLocaleString()} overall.`,
      icon: 'dollar',
    };
  }

  // Quick win available and interest difference is small
  if (hasQuickWin && interestDiff < 100) {
    return {
      strategy: 'snowball',
      headline: 'Snowball: build momentum fast',
      explanation: `Pay off ${smallest.name} ($${smallest.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}) in just ${smallestPayoffMonths} months for a quick win, then roll that payment into the next debt.`,
      icon: 'target',
    };
  }

  // Default to avalanche if there's any meaningful difference
  if (interestDiff > 10) {
    return {
      strategy: 'avalanche',
      headline: 'Avalanche: save the most on interest',
      explanation: `Targeting your highest-rate debt first saves $${interestDiff.toLocaleString()} in interest compared to the snowball approach.`,
      icon: 'dollar',
    };
  }

  // Strategies are essentially identical
  return {
    strategy: 'snowball',
    headline: 'Snowball: quick wins keep you motivated',
    explanation: 'Both strategies cost about the same in interest. Snowball gives you faster visible progress by eliminating smaller debts first.',
    icon: 'target',
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DebtPayoff() {
  const track = useTrack('debt_payoff');
  const [plan, setPlan] = useState<DebtPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [extraPayment, setExtraPayment] = useState(100);
  const [showComparison, setShowComparison] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ balance: string; rate: string; minPay: string }>({ balance: '', rate: '', minPay: '' });

  const [detectedDebts, setDetectedDebts] = useState<any[]>([]);
  const [addingDetected, setAddingDetected] = useState<string | null>(null);

  const fetchPlan = useCallback(() => {
    api.get('/debt?extra=0')
      .then(r => setPlan(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  useEffect(() => {
    api.get('/runway/detected-debts').then(r => setDetectedDebts(r.data.detected || [])).catch(() => {});
  }, []);

  async function addDetectedDebt(debt: any) {
    setAddingDetected(debt.displayName);
    try {
      await api.post('/csv/add-debt', {
        merchantName: debt.displayName,
        suggestedType: debt.suggestedType,
        monthlyAmount: debt.monthlyAmount,
      });
      setDetectedDebts(prev => prev.filter(d => d.displayName !== debt.displayName));
      fetchPlan();
    } catch {}
    setAddingDetected(null);
  }

  const saveEdit = async (debtId: string) => {
    try {
      await api.patch(`/settings/accounts/${debtId}`, {
        balance: editValues.balance || undefined,
        interest_rate: editValues.rate || undefined,
        minimum_payment: editValues.minPay || undefined,
      });
      setEditingId(null);
      fetchPlan(); // refresh data
    } catch {}
  };

  // Extract debt accounts from plan
  const debts: DebtAccount[] = useMemo(() => {
    if (!plan) return [];
    return plan.debts.map(d => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
      interestRate: d.interestRate,
      minimumPayment: d.minimumPayment,
      type: (d as any).type,
    }));
  }, [plan]);

  const totalDebt = useMemo(() => debts.reduce((s, d) => s + d.balance, 0), [debts]);
  const totalMinimum = useMemo(() => debts.reduce((s, d) => s + d.minimumPayment, 0), [debts]);

  const avalancheIds = useMemo(() =>
    [...debts].sort((a, b) => b.interestRate - a.interestRate).map(d => d.id),
    [debts],
  );
  const snowballIds = useMemo(() =>
    [...debts].sort((a, b) => a.balance - b.balance).map(d => d.id),
    [debts],
  );

  const totalPayment = totalMinimum + extraPayment;

  const avalanche = useMemo(
    () => simulatePayoff(debts, avalancheIds, totalPayment),
    [debts, avalancheIds, totalPayment],
  );
  const snowball = useMemo(
    () => simulatePayoff(debts, snowballIds, totalPayment),
    [debts, snowballIds, totalPayment],
  );

  const minimumOnly = useMemo(
    () => simulatePayoff(debts, avalancheIds, totalMinimum),
    [debts, avalancheIds, totalMinimum],
  );

  // Smart recommendation
  const recommendation = useMemo(
    () => getRecommendation(debts, avalanche, snowball),
    [debts, avalanche, snowball],
  );

  const activeResult = recommendation.strategy === 'avalanche' ? avalanche : snowball;
  const activeIds = recommendation.strategy === 'avalanche' ? avalancheIds : snowballIds;
  const debtMap = useMemo(() => new Map(debts.map(d => [d.id, d])), [debts]);

  // Impact sentence values
  const monthsSaved = Math.max(0, minimumOnly.months - activeResult.months);
  const interestSaved = Math.max(0, Math.round(minimumOnly.totalInterest - activeResult.totalInterest));

  /* ---------------------------------------------------------------- */
  /*  Loading / Empty states                                           */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded-lg w-48 animate-pulse" />
        <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!plan || debts.length === 0) {
    return (
      <div className="space-y-6">
        {detectedDebts.length > 0 ? (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">We found possible debts</h2>
              <p className="text-gray-500 text-sm max-w-sm mx-auto">
                Based on your transaction history, these look like recurring debt payments. Add them to track your payoff progress.
              </p>
            </div>
            <div className="space-y-2">
              {detectedDebts.map(d => (
                <div key={d.displayName} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{d.displayName}</p>
                    <p className="text-xs text-slate-400">{d.suggestedType.replace('_', ' ')} · ${Math.round(d.monthlyAmount)}/mo · {d.occurrences} payments</p>
                  </div>
                  <button
                    onClick={() => addDetectedDebt(d)}
                    disabled={addingDetected === d.displayName}
                    className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg disabled:opacity-50 transition-colors shrink-0"
                  >
                    {addingDetected === d.displayName ? 'Adding...' : 'Add debt'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <Award className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No debt found</h2>
            <p className="text-gray-500 text-sm max-w-xs mx-auto">
              You don't have any debt accounts. That's something to celebrate!
            </p>
          </div>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Build payoff roadmap steps                                       */
  /* ---------------------------------------------------------------- */

  const roadmapSteps: { title: string; subtitle: string; accent: string }[] = [];
  let rolledPayment = extraPayment;

  activeResult.payoffOrder.forEach((item, idx) => {
    const debt = debtMap.get(item.id);
    if (!debt) return;

    const paymentOnThis = debt.minimumPayment + (idx === 0 ? extraPayment : rolledPayment);
    const prevItem = idx > 0 ? activeResult.payoffOrder[idx - 1] : null;
    const prevDebt = prevItem ? debtMap.get(prevItem.id) : null;

    if (idx === 0) {
      roadmapSteps.push({
        title: `Focus on ${debt.name}`,
        subtitle: `Pay $${Math.round(paymentOnThis)}/mo (minimum + extra)`,
        accent: 'bg-indigo-600',
      });
    } else {
      const prevName = prevDebt?.name ?? 'previous debt';
      roadmapSteps.push({
        title: `Roll into ${debt.name}`,
        subtitle: `When ${prevName} is paid off in ${payoffDate(prevItem!.payoffMonth)}, redirect $${Math.round(prevDebt?.minimumPayment ?? 0)} here`,
        accent: 'bg-slate-400',
      });
    }

    // Accumulate freed-up payments for cascade
    if (idx < activeResult.payoffOrder.length - 1) {
      rolledPayment += debt.minimumPayment;
    }
  });

  // Final "debt free" step
  if (activeResult.payoffOrder.length > 0) {
    roadmapSteps.push({
      title: `Debt free by ${payoffDate(activeResult.months)}!`,
      subtitle: `${formatMonths(activeResult.months)} from now`,
      accent: 'bg-emerald-500',
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Main render                                                      */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-5 pb-8">
      {/* ---- Header ---- */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-1">
          <TrendingDown className="w-5 h-5 text-indigo-300" />
          <h1 className="text-lg font-semibold">Debt Strategy</h1>
        </div>
        <p className="text-slate-300 text-sm mb-4">Your personalized path to debt freedom</p>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Debt</p>
            <p className="text-xl font-bold mt-0.5">${totalDebt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Accounts</p>
            <p className="text-xl font-bold mt-0.5">{debts.length}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Min / mo</p>
            <p className="text-xl font-bold mt-0.5">${totalMinimum.toFixed(0)}</p>
          </div>
        </div>
      </div>

      {/* ---- Detected debts ---- */}
      {detectedDebts.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-indigo-800 mb-2">We found {detectedDebts.length} more possible debt{detectedDebts.length > 1 ? 's' : ''} from your transactions</p>
          <div className="space-y-1.5">
            {detectedDebts.slice(0, 5).map(d => (
              <div key={d.displayName} className="flex items-center justify-between gap-2">
                <span className="text-xs text-indigo-700">{d.displayName} — ${Math.round(d.monthlyAmount)}/mo</span>
                <button onClick={() => addDetectedDebt(d)} disabled={addingDetected === d.displayName}
                  className="text-[10px] font-medium text-indigo-600 bg-indigo-100 hover:bg-indigo-200 px-2 py-1 rounded-lg disabled:opacity-50">
                  {addingDetected === d.displayName ? 'Adding...' : 'Add'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- APR warning ---- */}
      {debts.some(d => [24, 7, 8.5, 6, 12].includes(d.interestRate)) && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Some APRs may be estimated</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Round APR numbers are likely national averages.{' '}
              <Link to="/settings" className="text-amber-800 underline font-medium">
                Enter your actual APR
              </Link>{' '}
              for accurate calculations.
            </p>
          </div>
        </div>
      )}

      {/* ---- Your Best Strategy (recommendation) ---- */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-gray-900">Your Best Strategy</h2>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              recommendation.icon === 'dollar'
                ? 'bg-indigo-100'
                : 'bg-purple-100'
            }`}>
              {recommendation.icon === 'dollar'
                ? <CircleDollarSign className="w-5 h-5 text-indigo-600" />
                : <Target className="w-5 h-5 text-purple-600" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-gray-900">{recommendation.headline}</p>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">{recommendation.explanation}</p>
            </div>
          </div>
        </div>

        {/* Compare strategies toggle (power users) */}
        {debts.length > 1 && (
          <div className="border-t border-gray-100">
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              {showComparison ? 'Hide' : 'Compare strategies'}
              {showComparison
                ? <ChevronUp className="w-3.5 h-3.5" />
                : <ChevronDown className="w-3.5 h-3.5" />
              }
            </button>

            {showComparison && (
              <div className="px-5 pb-5">
                <div className="grid grid-cols-2 gap-3">
                  {/* Avalanche column */}
                  <div className={`rounded-xl p-4 ${
                    recommendation.strategy === 'avalanche'
                      ? 'bg-indigo-50 ring-2 ring-indigo-200'
                      : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center gap-1.5 mb-3">
                      <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Avalanche</span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total Interest</p>
                        <p className="text-sm font-bold text-gray-900">
                          ${Math.round(avalanche.totalInterest).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Payoff</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {payoffDate(avalanche.months)} ({formatMonths(avalanche.months)})
                        </p>
                      </div>
                    </div>
                    {recommendation.strategy === 'avalanche' && (
                      <span className="inline-block mt-3 text-[10px] font-bold text-indigo-700 bg-indigo-100 rounded-full px-2 py-0.5 uppercase tracking-wide">
                        Recommended
                      </span>
                    )}
                  </div>

                  {/* Snowball column */}
                  <div className={`rounded-xl p-4 ${
                    recommendation.strategy === 'snowball'
                      ? 'bg-purple-50 ring-2 ring-purple-200'
                      : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center gap-1.5 mb-3">
                      <Target className="w-3.5 h-3.5 text-purple-600" />
                      <span className="text-xs font-bold text-purple-600 uppercase tracking-wide">Snowball</span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total Interest</p>
                        <p className="text-sm font-bold text-gray-900">
                          ${Math.round(snowball.totalInterest).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Payoff</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {payoffDate(snowball.months)} ({formatMonths(snowball.months)})
                        </p>
                      </div>
                    </div>
                    {recommendation.strategy === 'snowball' && (
                      <span className="inline-block mt-3 text-[10px] font-bold text-purple-700 bg-purple-100 rounded-full px-2 py-0.5 uppercase tracking-wide">
                        Recommended
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- What If Slider ---- */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-gray-900">What If I Paid Extra?</h2>
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Extra per month</span>
          <span className="text-lg font-bold text-indigo-600">${extraPayment}</span>
        </div>

        <input
          type="range"
          min={0}
          max={500}
          step={25}
          value={extraPayment}
          onChange={e => setExtraPayment(parseInt(e.target.value))}
          className="w-full accent-indigo-600 h-2 rounded-full appearance-none bg-gray-200 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1 mb-4">
          <span>$0</span>
          <span>$125</span>
          <span>$250</span>
          <span>$375</span>
          <span>$500</span>
        </div>

        {/* Impact sentence */}
        {extraPayment > 0 && monthsSaved > 0 ? (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
            <p className="text-sm text-gray-800 leading-relaxed">
              Adding <span className="font-bold text-indigo-700">${extraPayment}/mo</span> pays off all debt{' '}
              <span className="font-bold text-emerald-700">{monthsSaved} {monthsSaved === 1 ? 'month' : 'months'} sooner</span> and saves{' '}
              <span className="font-bold text-emerald-700">${interestSaved.toLocaleString()}</span> in interest.
            </p>
          </div>
        ) : extraPayment > 0 ? (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
            <p className="text-sm text-gray-800 leading-relaxed">
              Adding <span className="font-bold text-indigo-700">${extraPayment}/mo</span> saves{' '}
              <span className="font-bold text-emerald-700">${interestSaved.toLocaleString()}</span> in interest.
              Debt free by <span className="font-bold text-emerald-700">{payoffDate(activeResult.months)}</span>.
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center pt-2">
            Drag the slider to see how extra payments accelerate your payoff
          </p>
        )}
      </div>

      {/* ---- Current Debts ---- */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-gray-900">Your Debts</h2>
        </div>

        <div className="divide-y divide-gray-100">
          {plan.debts.map(debt => {
            const monthlyInterest = debt.balance * (debt.interestRate / 100 / 12);
            const aprSeverity = debt.interestRate >= 20 ? 'text-red-600 bg-red-50 ring-red-200' :
              debt.interestRate >= 15 ? 'text-orange-600 bg-orange-50 ring-orange-200' :
              debt.interestRate >= 10 ? 'text-amber-600 bg-amber-50 ring-amber-200' :
              'text-emerald-600 bg-emerald-50 ring-emerald-200';
            const isEditing = editingId === debt.id;
            const needsBalance = debt.balance === 0;
            return (
              <div key={debt.id} className="px-5 py-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{debt.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{debtTypeLabel((debt as any).type)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isEditing && (
                      <>
                        <p className={`font-bold text-lg ${needsBalance ? 'text-amber-500' : 'text-gray-900'}`}>
                          {needsBalance ? 'No balance' : `$${debt.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                        </p>
                        <button
                          onClick={() => {
                            setEditingId(debt.id);
                            setEditValues({
                              balance: debt.balance > 0 ? String(debt.balance) : '',
                              rate: debt.interestRate > 0 ? String(debt.interestRate) : '',
                              minPay: debt.minimumPayment > 0 ? String(debt.minimumPayment) : '',
                            });
                          }}
                          className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-3 space-y-2 bg-gray-50 rounded-lg p-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 font-medium">Balance</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={editValues.balance}
                          onChange={e => setEditValues(v => ({ ...v, balance: e.target.value }))}
                          className="w-full text-sm border rounded-md px-2 py-1.5 mt-0.5"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 font-medium">APR %</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={editValues.rate}
                          onChange={e => setEditValues(v => ({ ...v, rate: e.target.value }))}
                          className="w-full text-sm border rounded-md px-2 py-1.5 mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 font-medium">Min/mo</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={editValues.minPay}
                          onChange={e => setEditValues(v => ({ ...v, minPay: e.target.value }))}
                          className="w-full text-sm border rounded-md px-2 py-1.5 mt-0.5"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 px-3 py-1 rounded-md hover:bg-gray-200">Cancel</button>
                      <button onClick={() => saveEdit(debt.id)} className="text-xs text-white bg-indigo-600 px-3 py-1 rounded-md hover:bg-indigo-700">Save</button>
                    </div>
                  </div>
                ) : needsBalance ? (
                  <button
                    onClick={() => {
                      setEditingId(debt.id);
                      setEditValues({ balance: '', rate: '', minPay: '' });
                    }}
                    className="mt-2 w-full text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 hover:bg-amber-100 text-center"
                  >
                    Tap to enter balance, APR & minimum payment
                  </button>
                ) : (
                  <div className="flex items-center gap-3 mt-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ring-1 ${aprSeverity}`}>
                      {debt.interestRate}% APR
                    </span>
                    <span className="text-xs text-gray-500">
                      ${debt.minimumPayment.toFixed(0)}/mo minimum
                    </span>
                    <span className="text-xs text-red-500 font-medium ml-auto">
                      ${monthlyInterest.toFixed(0)}/mo interest
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Payoff Roadmap ---- */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-gray-900">Payoff Roadmap</h2>
        </div>

        <div className="space-y-3">
          {roadmapSteps.map((step, idx) => {
            const isLast = idx === roadmapSteps.length - 1;
            return (
              <div
                key={idx}
                className={`rounded-xl p-4 border ${
                  isLast
                    ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'
                    : idx === 0
                      ? 'bg-gradient-to-r from-indigo-50 to-slate-50 border-indigo-200'
                      : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold ${step.accent}`}>
                    {isLast
                      ? <PartyPopper className="w-3.5 h-3.5" />
                      : idx + 1
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${isLast ? 'text-emerald-800' : 'text-gray-900'}`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{step.subtitle}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Bottom Insight Card ---- */}
      <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-gray-900">Summary</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total Interest</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">
              ${Math.round(activeResult.totalInterest).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Debt-Free By</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">
              {payoffDate(activeResult.months)}
            </p>
          </div>
        </div>

        {interestSaved > 0 && extraPayment > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <ArrowRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <p className="text-sm text-gray-700">
                Saving <span className="font-bold text-emerald-700">${interestSaved.toLocaleString()}</span> vs. minimums only
              </p>
            </div>
          </div>
        )}

        {extraPayment === 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Tip: Even a small extra payment each month can save you hundreds in interest. Use the slider above to explore.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
