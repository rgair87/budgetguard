import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import type { PaycheckPlan as PaycheckPlanType } from '@runway/shared';

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export default function PaycheckPlan() {
  const [plan, setPlan] = useState<PaycheckPlanType | null>(null);
  const [notSet, setNotSet] = useState(false);
  // Categories always start expanded - it's the most important section
  const [expanded, setExpanded] = useState<string | null>('categories');

  useEffect(() => {
    api.get('/runway/paycheck-plan')
      .then(r => setPlan(r.data))
      .catch(err => {
        if (err.response?.status === 404) setNotSet(true);
      });
  }, []);

  if (notSet) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Your Money Plan</h2>
        <p className="text-sm text-gray-500 mb-3">Tell us about your income so we can build you a plan for every paycheck.</p>
        <Link to="/settings" className="text-sm font-medium text-indigo-600 active:text-indigo-800">
          Set up paycheck info &rarr;
        </Link>
      </div>
    );
  }

  if (!plan) return null;

  const { buckets, monthlyIncome } = plan;
  const total = monthlyIncome;

  // Bar percentages
  const billsPct = total > 0 ? (buckets.bills.amount / total) * 100 : 0;
  const debtPct = total > 0 ? (buckets.debt.amount / total) * 100 : 0;
  const savingsPct = total > 0 ? (buckets.savings.amount / total) * 100 : 0;
  const spendingPct = total > 0 ? (buckets.spending.monthly / total) * 100 : 0;

  const toggle = (name: string) => setExpanded(expanded === name ? null : name);

  const removeBill = async (merchantName: string) => {
    await api.post('/csv/recurring/remove', { merchantName });
    const r = await api.get('/runway/paycheck-plan');
    setPlan(r.data);
  };

  const { categories } = buckets.spending;
  const discretionary = categories.filter(c => !c.isNecessity);
  const necessities = categories.filter(c => c.isNecessity);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-base font-semibold text-gray-900">Your Money Plan</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          ${fmt(monthlyIncome)}/mo &middot; {Math.round(plan.paycheckCount)}&times; ${fmt(plan.paycheckAmount)} {plan.frequency}
        </p>
      </div>

      {/* Bills Covered - #1 confidence signal */}
      {plan.billsCovered ? (
        <div className="mx-4 mb-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-emerald-600 text-lg">&#10003;</span>
          <div>
            <p className="text-sm font-semibold text-emerald-900">Bills are covered</p>
            <p className="text-xs text-emerald-700">Your income covers all your bills and debt payments.</p>
          </div>
        </div>
      ) : (
        <div className="mx-4 mb-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-900">
            We need to find ${fmt(plan.billsGap)}/mo
          </p>
          <p className="text-sm text-amber-700 mt-1">
            {plan.advice}{' '}
            <Link to="/cut-this" className="font-semibold underline">Check Cut This &rarr;</Link>
          </p>
        </div>
      )}

      {/* Stacked bar */}
      <div className="px-5 pb-4">
        <div className="flex rounded-full overflow-hidden h-3 bg-gray-100">
          {billsPct > 0 && <div className="bg-blue-500" style={{ width: `${billsPct}%` }} />}
          {debtPct > 0 && <div className="bg-amber-400" style={{ width: `${debtPct}%` }} />}
          {savingsPct > 0 && <div className="bg-emerald-400" style={{ width: `${savingsPct}%` }} />}
          {spendingPct > 0 && <div className="bg-purple-400" style={{ width: `${spendingPct}%` }} />}
        </div>
      </div>

      {/* Bucket rows */}
      <div className="border-t border-gray-100">
        {/* Bills */}
        <button
          onClick={() => buckets.bills.details.length > 0 && toggle('bills')}
          className="w-full flex items-center justify-between px-5 py-3.5 active:bg-gray-50 text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
            <span className="text-sm text-gray-700 truncate">Bills & fixed costs</span>
            {buckets.bills.details.length > 0 && (
              <span className="text-xs text-gray-400">{expanded === 'bills' ? '▾' : '▸'}</span>
            )}
          </div>
          <span className="text-sm font-semibold text-gray-900 ml-3">${fmt(buckets.bills.amount)}</span>
        </button>
        {expanded === 'bills' && buckets.bills.details.length > 0 && (
          <div className="px-5 pb-3 space-y-0.5">
            {buckets.bills.details.map((d, i) => (
              <div key={i} className="flex items-center justify-between py-2 pl-6">
                <span className="text-sm text-gray-500 truncate min-w-0 mr-3">{d.name}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm text-gray-500">${fmt(d.amount)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeBill(d.name); }}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 active:bg-red-50 active:text-red-600"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Debt - amber, not red. Debt is normal. */}
        {buckets.debt.amount > 0 && (
          <>
            <button
              onClick={() => buckets.debt.details.length > 0 && toggle('debt')}
              className="w-full flex items-center justify-between px-5 py-3.5 active:bg-gray-50 text-left border-t border-gray-50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                <span className="text-sm text-gray-700 truncate">Debt payments</span>
                {buckets.debt.details.length > 0 && (
                  <span className="text-xs text-gray-400">{expanded === 'debt' ? '▾' : '▸'}</span>
                )}
              </div>
              <span className="text-sm font-semibold text-gray-900 ml-3">${fmt(buckets.debt.amount)}</span>
            </button>
            {expanded === 'debt' && buckets.debt.details.length > 0 && (
              <div className="px-5 pb-3 space-y-0.5">
                {buckets.debt.details.map((d, i) => (
                  <div key={i} className="flex items-center justify-between py-2 pl-6">
                    <span className="text-sm text-gray-500 truncate min-w-0 mr-3">{d.name}</span>
                    <span className="text-sm text-gray-500 shrink-0">${fmt(d.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Savings */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-50">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-3 h-3 rounded-full bg-emerald-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-sm text-gray-700">Savings</span>
              {buckets.savings.reason && (
                <p className="text-xs text-gray-400 truncate">{buckets.savings.reason}</p>
              )}
            </div>
          </div>
          <span className="text-sm font-semibold text-gray-900 ml-3">${fmt(buckets.savings.amount)}</span>
        </div>
      </div>

      {/* ===== SPENDING SECTION: The Hero ===== */}
      <div className="border-t-2 border-purple-100 bg-purple-50 px-5 py-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-purple-500 shrink-0" />
            <span className="text-sm font-semibold text-gray-900">Your spending money</span>
          </div>
          <span className="text-lg font-bold text-purple-700">${fmt(buckets.spending.monthly)}<span className="text-sm font-normal text-purple-500">/mo</span></span>
        </div>
        <p className="text-xs text-gray-500 ml-6 mb-1">
          ${fmt(buckets.spending.weekly)}/wk &middot; ${fmt(buckets.spending.daily)}/day
        </p>

        {/* Spending pace bar */}
        {plan.spendingPace && buckets.spending.monthly > 0 && (
          <div className="mt-3 ml-6">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{plan.spendingPace.percentThroughMonth}% through month</span>
              <span>{plan.spendingPace.percentBudgetUsed}% spent</span>
            </div>
            <div className="h-2 rounded-full bg-purple-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${plan.spendingPace.onTrack ? 'bg-purple-400' : 'bg-amber-400'}`}
                style={{ width: `${Math.min(plan.spendingPace.percentBudgetUsed, 100)}%` }}
              />
            </div>
            <p className={`text-xs mt-1.5 ${plan.spendingPace.onTrack ? 'text-purple-600' : 'text-amber-600'}`}>
              {plan.spendingPace.message}
            </p>
          </div>
        )}
      </div>

      {/* ===== WHERE IT'S GOING: Category Breakdown ===== */}
      {categories.length > 0 && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => toggle('categories')}
            className="w-full flex items-center justify-between px-5 py-3.5 active:bg-gray-50 text-left"
          >
            <span className="text-sm font-medium text-gray-700">Where it's going</span>
            <span className="text-xs text-gray-400">{expanded === 'categories' ? '▾' : '▸'}</span>
          </button>

          {expanded === 'categories' && (
            <div className="px-5 pb-4 space-y-1">
              {/* Discretionary (cuttable) - shown first */}
              {discretionary.length > 0 && (
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide pb-1">Can cut</p>
              )}
              {discretionary.map((cat, i) => (
                <div key={i} className="flex items-center justify-between py-2 pl-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-gray-700 truncate">{cat.name}</span>
                    {cat.isOverBudget && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">over</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-medium text-gray-900">${fmt(cat.monthlyAmount)}</span>
                    {cat.runwayImpactDays > 0 && (
                      <span className="text-xs text-emerald-600">+{cat.runwayImpactDays}d</span>
                    )}
                  </div>
                </div>
              ))}

              {/* Necessities */}
              {necessities.length > 0 && (
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide pt-2 pb-1">Needs</p>
              )}
              {necessities.map((cat, i) => (
                <div key={i} className="flex items-center justify-between py-2 pl-2">
                  <span className="text-sm text-gray-500 truncate">{cat.name}</span>
                  <span className="text-sm text-gray-500">${fmt(cat.monthlyAmount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overspending alert - category-specific, not burn rate */}
      {plan.isOverspending && !plan.isShortfall && (
        <div className="border-t-2 border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-semibold text-amber-900 mb-1">Spending is above plan</p>
          <p className="text-xs text-amber-700 mb-3">{plan.advice}</p>
          {plan.topCut && (
            <div className="bg-white rounded-lg border border-amber-200 px-4 py-3">
              <p className="text-sm text-gray-900">
                <span className="font-medium">Biggest opportunity:</span> Cut {plan.topCut.category} by half
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                Save ${fmt(plan.topCut.saveAmount)}/mo &rarr; +{plan.topCut.runwayGainDays} days of runway
              </p>
            </div>
          )}
        </div>
      )}

      {/* Top cut suggestion when NOT overspending but could still improve */}
      {!plan.isOverspending && !plan.isShortfall && plan.topCut && plan.topCut.runwayGainDays >= 5 && (
        <div className="border-t border-gray-100 px-5 py-3">
          <p className="text-xs text-gray-500">
            <span className="text-emerald-600 font-medium">Tip:</span> Cutting {plan.topCut.category} by half saves ${fmt(plan.topCut.saveAmount)}/mo &rarr; +{plan.topCut.runwayGainDays} days
          </p>
        </div>
      )}

      {/* Wins - celebrate progress */}
      {plan.wins.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-3 space-y-1">
          {plan.wins.map((win, i) => (
            <p key={i} className="text-xs text-emerald-700 flex items-start gap-1.5">
              <span className="shrink-0 mt-0.5">&#9733;</span>
              <span>{win}</span>
            </p>
          ))}
        </div>
      )}

      {/* Advice footer */}
      {!plan.isShortfall && !plan.isOverspending && (
        <div className="px-5 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">{plan.advice}</p>
        </div>
      )}
    </div>
  );
}
