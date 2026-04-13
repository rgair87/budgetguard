import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import {
  Wallet,
  CreditCard,
  AlertTriangle,
  Scissors,
  ArrowRight,
  TrendingUp,
  Clock,
  Shield,
} from 'lucide-react';
import InfoTip from './InfoTip';
import type { RunwayScore as RunwayScoreType, PaycheckPlan as PaycheckPlanType } from '@spenditure/shared';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  // Include year if different from current year
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

// Calculate how many days you gain by cutting $X/day from spending
// Accounts for income - the real drain is (burn - income), not just burn
function daysGained(balance: number, burnRate: number, dailyIncome: number, cutPerDay: number): number {
  if (burnRate <= 0 || cutPerDay <= 0) return 0;
  const netBurn = burnRate - dailyIncome;
  if (netBurn <= 0) return 999; // already sustainable
  const currentDays = balance / netBurn;
  const newNetBurn = Math.max(0.1, netBurn - cutPerDay);
  const newDays = balance / newNetBurn;
  return Math.round(Math.max(0, Math.min(newDays - currentDays, 730)));
}

interface Props {
  score: RunwayScoreType;
  plan?: PaycheckPlanType | null;
}

export default function RunwayScore({ score, plan }: Props) {
  const [progress, setProgress] = useState<{ runwayChange: number | null; spendChangeVsLastMonth: number | null } | null>(null);
  useEffect(() => {
    api.get('/runway/progress').then(r => setProgress(r.data)).catch(() => {});
  }, []);
  const isGood = score.runwayDays >= 180 && score.status === 'green';
  const isTight = score.status === 'yellow';
  const isDanger = score.status === 'red';
  const needsHelp = isTight || isDanger;

  // Gradient backgrounds per status
  const gradientBg = isDanger
    ? 'bg-gradient-to-br from-rose-500 to-red-600'
    : isTight
      ? 'bg-gradient-to-br from-amber-500 to-orange-500'
      : 'bg-gradient-to-br from-emerald-500 to-teal-600';

  const badgeBg = isDanger
    ? 'bg-white/20 text-white'
    : isTight
      ? 'bg-white/20 text-white'
      : 'bg-white/20 text-white';

  const borderColor = isDanger ? 'border-rose-200' : 'border-amber-200';

  const statusIcon = isDanger
    ? <AlertTriangle className="w-5 h-5 text-white/70" />
    : isTight
      ? <Clock className="w-5 h-5 text-white/70" />
      : <Shield className="w-5 h-5 text-white/70" />;

  // Calculate concrete day gains for coaching
  const burn = score.dailyBurnRate;
  const bal = score.spendableBalance;
  const dailyIncome = (plan?.monthlyIncome || 0) / 30;

  // Real merchants the user can cut
  const merchants = score.cuttableMerchants || [];

  return (
    <div className="space-y-4">
      {/* ── Hero Runway Card ── */}
      <div className={`relative overflow-hidden rounded-2xl shadow-lg ${gradientBg}`}>
        {/* Glass / pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.12) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 40%)',
          }}
        />
        <div className="pointer-events-none absolute inset-0 backdrop-blur-[1px] bg-white/[0.04]" />

        <div className="relative z-10 p-6">
          <div className="flex items-center gap-2 mb-3">
            {statusIcon}
            <p className="text-sm font-medium text-white/80 uppercase tracking-wider">Your Runway</p>
          </div>

          <p className="text-5xl sm:text-6xl lg:text-5xl font-extrabold text-white tracking-tight leading-none">
            {score.runwayDays >= 730 ? '2yr+' : score.runwayDays >= 365 ? `${Math.round(score.runwayDays / 30)}mo` : score.runwayDays}
          </p>
          <p className="text-base sm:text-lg lg:text-base font-medium text-white/80 mt-1 flex items-center gap-1.5">
            {score.runwayDays >= 365
              ? `${score.runwayDays} days of runway`
              : `day${score.runwayDays !== 1 ? 's' : ''} of runway`}
            <InfoTip text="How many days your current cash will last based on your spending habits and upcoming bills." />
          </p>
          <p className="text-sm text-white/65 mt-2 max-w-sm leading-relaxed">
            {(() => {
              const incomeCoversExpenses = plan && !plan.isShortfall && plan.buckets.spending.monthly > 0;
              if (isGood && incomeCoversExpenses) {
                return "You're in great shape. Income covers spending, bills, and upcoming events. Keep it up!";
              } else if (isGood || score.runwayDays >= 180) {
                return `Your savings give you a strong cushion.${plan?.isShortfall ? ' Your income doesn\'t fully cover expenses yet. Your cash reserves are making up the difference.' : ''}`;
              } else if (score.runwayDays >= 365) {
                return "You have solid savings, but you're spending more than you earn. Consider trimming expenses.";
              } else if (score.runoutDate) {
                return <>Covered through <span className="font-semibold text-white/90">{formatDate(score.runoutDate)}</span></>;
              } else {
                return 'of breathing room';
              }
            })()}
          </p>

          {/* Progress narrative */}
          {progress && (progress.runwayChange !== null || progress.spendChangeVsLastMonth !== null) && (
            <div className="flex flex-wrap gap-3 mt-3 text-xs text-white/70">
              {progress.runwayChange !== null && progress.runwayChange !== 0 && (
                <span className={progress.runwayChange > 0 ? 'text-emerald-300' : 'text-red-300'}>
                  {progress.runwayChange > 0 ? '+' : ''}{progress.runwayChange} days this week
                </span>
              )}
              {progress.spendChangeVsLastMonth !== null && progress.spendChangeVsLastMonth !== 0 && (
                <span className={progress.spendChangeVsLastMonth < 0 ? 'text-emerald-300' : 'text-red-300'}>
                  Spending {progress.spendChangeVsLastMonth < 0 ? 'down' : 'up'} {Math.abs(progress.spendChangeVsLastMonth)}% vs last month
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-3">
            <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm ${badgeBg}`}>
              {(() => {
                const incomeCoversExpenses = plan && !plan.isShortfall && plan.buckets.spending.monthly > 0;
                if (isDanger) return score.amount < 0 ? "Let's make a plan" : 'Time to take action';
                if (isTight) return score.runwayDays >= 180 ? 'Spending more than you earn' : "Getting tight, let's find room";
                if (incomeCoversExpenses) return 'On track';
                return 'Savings cushion';
              })()}
            </span>
            {score.daysToPayday !== null && score.daysToPayday >= 0 && (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm bg-white/15 text-white">
                <Clock className="w-3.5 h-3.5" />
                {score.daysToPayday === 0
                  ? 'Payday today'
                  : score.daysToPayday === 1
                    ? 'Payday tomorrow'
                    : `Payday in ${score.daysToPayday} days`}
                <InfoTip text="Days until your next expected paycheck based on your income history." />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── No income warning ── */}
      {score.noIncomeConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-800 font-medium">Your runway doesn't include income.</p>
            <p className="text-xs text-amber-600 mt-0.5">Set up your paycheck in Settings for accurate projections.</p>
          </div>
          <Link to="/settings" className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors shrink-0">
            Set up
          </Link>
        </div>
      )}

      {/* ── Cash flow warning ── */}
      {score.isLosingMoney && !score.noIncomeConfigured && score.monthlyIncome > 0 && (
        <div className="bg-white border border-red-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">You're spending more than you earn</p>
              <p className="text-xs text-slate-500">Your savings are covering the gap right now.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-xl p-3">
            <div className="text-center">
              <p className="text-xs text-slate-500">Income</p>
              <p className="text-sm font-bold text-emerald-600">${Math.round(score.monthlyIncome).toLocaleString()}/mo</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Spending</p>
              <p className="text-sm font-bold text-red-600">${Math.round(score.monthlyBurn).toLocaleString()}/mo</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Gap</p>
              <p className="text-sm font-bold text-red-600">-${Math.abs(Math.round(score.monthlyCashFlow)).toLocaleString()}/mo</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Key Numbers Grid ── */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/settings" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 transition-shadow hover:shadow-md hover:border-indigo-200 block cursor-pointer">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-emerald-50 rounded-lg">
              <Wallet className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide flex items-center gap-1">Available Cash <InfoTip text="Total money in your checking and savings accounts right now." /></p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${score.spendableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </Link>
        <Link to="/debt" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 transition-shadow hover:shadow-md hover:border-indigo-200 block cursor-pointer">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-gray-50 rounded-lg">
              <CreditCard className="w-4 h-4 text-gray-500" />
            </div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide flex items-center gap-1">Total Debt <InfoTip text="Total owed across all your credit cards and loans." /></p>
          </div>
          <p className={`text-2xl font-bold ${score.totalDebt > 0 ? 'text-gray-900' : 'text-emerald-600'}`}>
            {score.totalDebt > 0 ? `$${score.totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0'}
          </p>
        </Link>
      </div>

      {/* ── Urgent Events ── */}
      {score.hasUrgentWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-sm text-amber-800 font-semibold">Upcoming expenses we're watching</p>
          </div>
          {score.urgentEvents.map((evt) => (
            <div key={evt.name} className="flex items-center justify-between py-1.5">
              <p className="text-sm text-amber-700">{evt.name}</p>
              <p className="text-sm font-semibold text-amber-800">${evt.amount.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Concrete Action Plan ── */}
      {needsHelp && burn > 0 && (
        <div className={`bg-white border ${borderColor} rounded-2xl p-5 shadow-sm`}>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-indigo-50 rounded-lg">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900">How to add more days</p>
          </div>

          <div className="space-y-2 mb-4">
            {/* Real merchant-level cuts from their actual spending */}
            {merchants.map((m) => {
              const cutPerDay = m.monthlyAmount / 30;
              const gained = daysGained(bal, burn, dailyIncome, cutPerDay);
              if (gained < 1) return null;
              return (
                <div
                  key={m.name}
                  className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-2xl border border-gray-100 transition-all hover:bg-gray-100 hover:shadow-sm cursor-default"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-white rounded-lg shadow-sm">
                      <Scissors className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-800 font-medium">
                        Cut <span className="font-semibold">{m.name}</span>
                      </p>
                      <p className="text-xs text-gray-500">${fmt(m.monthlyAmount)}/mo in {m.category}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-3 py-1 bg-emerald-100 text-emerald-700 text-sm font-bold rounded-full shadow-sm">
                    +{gained} days
                  </span>
                </div>
              );
            })}
            {merchants.length === 0 && (
              <p className="text-sm text-gray-500 py-3 text-center">No non-essential spending found to cut.</p>
            )}
          </div>

          <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
            <Link
              to="/cut-this"
              className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 active:text-indigo-800 font-semibold transition-colors"
            >
              <Scissors className="w-3.5 h-3.5" />
              Scan with Cut This
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            {score.urgentEvents.length > 0 && (
              <p className="text-xs text-gray-500">
                Can any upcoming expense wait or be split?
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
