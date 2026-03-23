import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import {
  TrendingDown,
  CreditCard,
  Zap,
  Target,
  ArrowRight,
  DollarSign,
  Calendar,
  Award,
  Info,
} from 'lucide-react';

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
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DebtPayoff() {
  const [plan, setPlan] = useState<DebtPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [extraPayment, setExtraPayment] = useState(0);
  const [selectedStrategy, setSelectedStrategy] = useState<'avalanche' | 'snowball'>('avalanche');

  useEffect(() => {
    api.get('/debt?extra=0')
      .then(r => setPlan(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Compute both strategies client-side for real-time slider updates
  const debts: DebtAccount[] = useMemo(() => {
    if (!plan) return [];
    return plan.debts.map(d => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
      interestRate: d.interestRate,
      minimumPayment: d.minimumPayment,
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

  const activeResult = selectedStrategy === 'avalanche' ? avalanche : snowball;
  const activeOrder = selectedStrategy === 'avalanche' ? avalancheIds : snowballIds;

  // Quick win calculations
  const smallestDebt = useMemo(() => {
    if (debts.length === 0) return null;
    return [...debts].sort((a, b) => a.balance - b.balance)[0];
  }, [debts]);

  const interestSavedByAvalanche = Math.max(0, Math.round(snowball.totalInterest - avalanche.totalInterest));

  /* ---------------------------------------------------------------- */
  /*  Loading / Empty states                                           */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded-lg w-48 animate-pulse" />
        <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!plan || debts.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <Award className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No debt found</h2>
        <p className="text-gray-500 text-sm max-w-xs mx-auto">
          You don't have any debt accounts. That's something to celebrate!
        </p>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Main render                                                      */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6 pb-8">
      {/* ---- Header ---- */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-1">
          <TrendingDown className="w-5 h-5 text-indigo-300" />
          <h1 className="text-lg font-semibold">Debt Strategy</h1>
        </div>
        <p className="text-slate-300 text-sm mb-4">Your personalized path to debt freedom</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Debt</p>
            <p className="text-2xl font-bold mt-0.5">${totalDebt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Accounts</p>
            <p className="text-2xl font-bold mt-0.5">{debts.length}</p>
          </div>
        </div>
      </div>

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

      {/* ---- Current Debts ---- */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-gray-900">Current Debts</h2>
        </div>

        <div className="divide-y divide-gray-100">
          {plan.debts.map(debt => {
            const maxRate = Math.max(...debts.map(d => d.interestRate));
            const barWidth = maxRate > 0 ? Math.max(8, (debt.interestRate / maxRate) * 100) : 0;
            return (
              <div key={debt.id} className="px-5 py-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{debt.name}</p>
                    <p className="text-xs text-gray-500">{debtTypeLabel((debt as any).type)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 text-sm">
                      ${debt.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-gray-500">
                      ${debt.minimumPayment.toFixed(0)}/mo min
                    </p>
                  </div>
                </div>
                {/* Interest bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${rateColor(debt.interestRate)}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600 w-16 text-right">
                    {debt.interestRate}% APR
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Strategy Comparison ---- */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-indigo-600" />
          <h2 className="text-sm font-semibold text-gray-900">Strategy Comparison</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Avalanche */}
          <button
            onClick={() => setSelectedStrategy('avalanche')}
            className={`text-left rounded-2xl border-2 p-4 transition-all duration-200 ${
              selectedStrategy === 'avalanche'
                ? 'border-indigo-500 bg-indigo-50/60 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <DollarSign className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Avalanche</span>
            </div>
            <p className="text-[11px] text-gray-500 mb-3">Highest interest first</p>

            <div className="space-y-2">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Interest Paid</p>
                <p className="text-base font-bold text-gray-900">
                  ${Math.round(avalanche.totalInterest).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Payoff Date</p>
                <p className="text-sm font-semibold text-gray-900">{payoffDate(avalanche.months)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Time</p>
                <p className="text-sm font-semibold text-gray-900">{formatMonths(avalanche.months)}</p>
              </div>
            </div>

            {avalanche.totalInterest <= snowball.totalInterest && (
              <div className="mt-3 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full px-2 py-0.5 inline-block uppercase tracking-wide">
                Saves the most
              </div>
            )}
          </button>

          {/* Snowball */}
          <button
            onClick={() => setSelectedStrategy('snowball')}
            className={`text-left rounded-2xl border-2 p-4 transition-all duration-200 ${
              selectedStrategy === 'snowball'
                ? 'border-indigo-500 bg-indigo-50/60 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Target className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-bold text-purple-600 uppercase tracking-wide">Snowball</span>
            </div>
            <p className="text-[11px] text-gray-500 mb-3">Smallest balance first</p>

            <div className="space-y-2">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Interest Paid</p>
                <p className="text-base font-bold text-gray-900">
                  ${Math.round(snowball.totalInterest).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Payoff Date</p>
                <p className="text-sm font-semibold text-gray-900">{payoffDate(snowball.months)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Time</p>
                <p className="text-sm font-semibold text-gray-900">{formatMonths(snowball.months)}</p>
              </div>
            </div>

            {snowball.months <= avalanche.months && snowball.months < avalanche.months && (
              <div className="mt-3 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full px-2 py-0.5 inline-block uppercase tracking-wide">
                Fastest wins
              </div>
            )}
          </button>
        </div>
      </div>

      {/* ---- "What If" Slider ---- */}
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

        {/* Real-time impact */}
        {extraPayment > 0 && (
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-100">
            <div className="text-center">
              <p className="text-xs text-gray-400">New payoff</p>
              <p className="text-sm font-bold text-gray-900">{payoffDate(activeResult.months)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">Interest saved</p>
              <p className="text-sm font-bold text-emerald-600">
                ${Math.max(0, Math.round(minimumOnly.totalInterest - activeResult.totalInterest)).toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">Months saved</p>
              <p className="text-sm font-bold text-indigo-600">
                {Math.max(0, minimumOnly.months - activeResult.months)}
              </p>
            </div>
          </div>
        )}

        {extraPayment === 0 && (
          <p className="text-xs text-gray-400 text-center pt-2">
            Drag the slider to see how extra payments accelerate your payoff
          </p>
        )}
      </div>

      {/* ---- Payoff Order Timeline ---- */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-gray-900">
            Payoff Order
            <span className="text-xs font-normal text-gray-400 ml-2 capitalize">
              ({selectedStrategy} strategy)
            </span>
          </h2>
        </div>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-3 bottom-3 w-px bg-gray-200" />

          <div className="space-y-0">
            {activeResult.payoffOrder.map((item, idx) => {
              const isLast = idx === activeResult.payoffOrder.length - 1;
              return (
                <div key={item.id} className="relative flex items-start gap-4 py-3">
                  {/* Dot */}
                  <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    idx === 0
                      ? 'bg-indigo-600 text-white'
                      : isLast
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                  }`}>
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs font-semibold text-gray-500 shrink-0 ml-2">
                        {payoffDate(item.payoffMonth)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-500">
                        ${item.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatMonths(item.payoffMonth)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {activeResult.payoffOrder.length > 0 && (
            <div className="relative flex items-start gap-4 py-3">
              <div className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-emerald-100">
                <Award className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-700">Debt Free!</p>
                <p className="text-xs text-gray-500">{payoffDate(activeResult.months)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---- Quick Wins ---- */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-gray-900">Quick Wins</h2>
        </div>

        <div className="space-y-3">
          {/* Smallest debt quick win */}
          {smallestDebt && (
            <div className="flex items-start gap-3 bg-white/70 rounded-xl p-3.5">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  <span className="font-semibold">Pay off {smallestDebt.name}</span> in{' '}
                  {(() => {
                    const monthsAtDouble = Math.ceil(
                      smallestDebt.balance / (smallestDebt.minimumPayment * 2),
                    );
                    const extra = smallestDebt.minimumPayment;
                    return (
                      <>
                        <span className="font-semibold text-emerald-700">{monthsAtDouble} months</span> by
                        adding <span className="font-semibold text-emerald-700">${extra.toFixed(0)}/mo</span>
                      </>
                    );
                  })()}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Balance: ${smallestDebt.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 mt-2 shrink-0" />
            </div>
          )}

          {/* Avalanche savings insight */}
          {interestSavedByAvalanche > 10 && debts.length > 1 && (
            <div className="flex items-start gap-3 bg-white/70 rounded-xl p-3.5">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  Save{' '}
                  <span className="font-semibold text-indigo-700">
                    ${interestSavedByAvalanche.toLocaleString()}
                  </span>{' '}
                  in interest by using the avalanche method
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Targets high-interest debt first
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 mt-2 shrink-0" />
            </div>
          )}

          {/* Extra payment insight */}
          {extraPayment === 0 && (
            <div className="flex items-start gap-3 bg-white/70 rounded-xl p-3.5">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                {(() => {
                  const extra100 = simulatePayoff(debts, avalancheIds, totalMinimum + 100);
                  const monthsSaved = minimumOnly.months - extra100.months;
                  const interestSaved = Math.round(minimumOnly.totalInterest - extra100.totalInterest);
                  return (
                    <>
                      <p className="text-sm text-gray-900">
                        An extra{' '}
                        <span className="font-semibold text-amber-700">$100/mo</span>{' '}
                        saves{' '}
                        <span className="font-semibold text-amber-700">
                          ${interestSaved.toLocaleString()}
                        </span>{' '}
                        and cuts{' '}
                        <span className="font-semibold text-amber-700">
                          {monthsSaved} months
                        </span>{' '}
                        off your payoff
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Use the slider above to explore different amounts
                      </p>
                    </>
                  );
                })()}
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 mt-2 shrink-0" />
            </div>
          )}
        </div>
      </div>

      {/* ---- Monthly Summary ---- */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Monthly Minimums</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            ${totalMinimum.toFixed(0)}
          </p>
          {extraPayment > 0 && (
            <p className="text-xs text-indigo-600 font-medium mt-0.5">
              +${extraPayment} extra
            </p>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Debt-Free By</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {payoffDate(activeResult.months)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatMonths(activeResult.months)}
          </p>
        </div>
      </div>
    </div>
  );
}
