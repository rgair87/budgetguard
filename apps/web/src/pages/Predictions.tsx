import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, AlertTriangle, CheckCircle, Target, ArrowRight, Zap } from 'lucide-react';
import api from '../api/client';
import useTrack from '../hooks/useTrack';

interface CategoryPrediction {
  category: string;
  spentSoFar: number;
  budget: number | null;
  projectedTotal: number;
  projectedOverage: number;
  daysLeft: number;
  dailyPace: number;
  safeDailyBudget: number | null;
  status: 'on_track' | 'warning' | 'over_budget' | 'no_budget';
  message: string;
}

interface SpendingPredictions {
  predictions: CategoryPrediction[];
  overallMessage: string;
  daysLeftInMonth: number;
  percentThroughMonth: number;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; ring: string; label: string; icon: string; gradient: string }> = {
  over_budget: { bg: 'bg-red-50', text: 'text-red-700', ring: 'border-red-200/60', label: 'Over Budget', icon: 'alert', gradient: 'from-red-500 to-rose-500' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'border-amber-200/60', label: 'Warning', icon: 'alert', gradient: 'from-amber-500 to-orange-500' },
  on_track: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'border-emerald-200/60', label: 'On Track', icon: 'check', gradient: 'from-emerald-500 to-green-500' },
  no_budget: { bg: 'bg-slate-50', text: 'text-slate-600', ring: 'border-slate-200/60', label: 'No Budget', icon: 'none', gradient: 'from-slate-400 to-slate-500' },
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'over_budget' || status === 'warning') return <AlertTriangle className="w-3.5 h-3.5" />;
  if (status === 'on_track') return <CheckCircle className="w-3.5 h-3.5" />;
  return null;
}

export default function Predictions() {
  const track = useTrack('predictions');
  const [data, setData] = useState<SpendingPredictions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/predictions')
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load predictions.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500 text-center py-12">Calculating spending predictions...</div>;
  if (error) return <div className="bg-red-50 text-red-600 text-sm p-4 rounded-2xl border border-red-200/60">{error}</div>;
  if (!data) return null;

  const problems = data.predictions.filter(p => p.status === 'over_budget' || p.status === 'warning');
  const onTrack = data.predictions.filter(p => p.status === 'on_track');
  const unbudgeted = data.predictions.filter(p => p.status === 'no_budget');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Gradient hero header */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold">Spending Predictions</h1>
        </div>
        <div className="ml-12 flex items-center gap-3">
          <p className="text-indigo-100 text-sm">
            {data.daysLeftInMonth} days left &middot; {data.percentThroughMonth.toFixed(0)}% through the month
          </p>
        </div>
        {/* Month progress bar */}
        <div className="mt-4 ml-12">
          <div className="w-full bg-white/20 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-white/80 to-white transition-all duration-500"
              style={{ width: `${data.percentThroughMonth}%` }}
            />
          </div>
        </div>
      </div>

      {/* Overall summary */}
      <div className={`rounded-2xl border p-5 shadow-sm animate-fade-in ${
        problems.length > 0 ? 'bg-amber-50 border-amber-200/60' : 'bg-emerald-50 border-emerald-200/60'
      }`}>
        <div className="flex items-start gap-3">
          {problems.length > 0
            ? <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            : <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
          }
          <p className={`text-sm font-medium ${
            problems.length > 0 ? 'text-amber-800' : 'text-emerald-800'
          }`}>
            {data.overallMessage}
          </p>
        </div>
      </div>

      {/* Problem categories */}
      {problems.length > 0 && (
        <div className="animate-fade-in">
          <h2 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Needs Attention
          </h2>
          <div className="space-y-3">
            {problems.map(pred => {
              const style = STATUS_STYLES[pred.status];
              const budgetPct = pred.budget ? Math.min((pred.spentSoFar / pred.budget) * 100, 100) : 0;
              const projPct = pred.budget ? Math.min((pred.projectedTotal / pred.budget) * 100, 150) : 0;

              return (
                <div key={pred.category} className={`rounded-2xl border p-5 shadow-sm ${style.bg} ${style.ring}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{pred.category}</h3>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${style.text} ring-1 ${style.ring} bg-white/60`}>
                        <StatusIcon status={pred.status} />
                        {style.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">${pred.spentSoFar.toFixed(0)}</p>
                      {pred.budget && <p className="text-xs text-gray-500">of ${pred.budget.toFixed(0)} budget</p>}
                    </div>
                  </div>

                  {/* Progress bar with gradient fill */}
                  {pred.budget && (
                    <div className="relative w-full bg-white/60 rounded-full h-3 mb-3 overflow-hidden">
                      {/* Projected fill */}
                      <div
                        className="absolute h-3 rounded-full bg-red-200/50"
                        style={{ width: `${Math.min(projPct, 100)}%` }}
                      />
                      {/* Actual fill with gradient */}
                      <div
                        className={`relative h-3 rounded-full bg-gradient-to-r ${style.gradient} transition-all duration-500`}
                        style={{ width: `${budgetPct}%` }}
                      />
                      {/* Budget line */}
                      <div className="absolute right-0 top-0 h-3 w-0.5 bg-gray-400/80 rounded" />
                    </div>
                  )}

                  <p className="text-sm text-gray-700">{pred.message}</p>

                  {pred.safeDailyBudget !== null && pred.safeDailyBudget > 0 && (
                    <div className="mt-3 flex items-center gap-2 bg-white/60 rounded-xl px-3 py-2">
                      <Target className="w-4 h-4 text-indigo-600 shrink-0" />
                      <p className="text-xs font-medium text-indigo-700">
                        Slow down to ${pred.safeDailyBudget.toFixed(0)}/day to stay within budget
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* On track categories */}
      {onTrack.length > 0 && (
        <div className="animate-fade-in">
          <h2 className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            On Track
          </h2>
          <div className="space-y-2">
            {onTrack.map(pred => {
              const budgetPct = pred.budget ? Math.min((pred.spentSoFar / pred.budget) * 100, 100) : 0;
              return (
                <div key={pred.category} className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm font-medium text-gray-900">{pred.category}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-900">${pred.spentSoFar.toFixed(0)}</span>
                      {pred.budget && <span className="text-xs text-gray-500"> / ${pred.budget.toFixed(0)}</span>}
                    </div>
                  </div>
                  {pred.budget && (
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-500"
                        style={{ width: `${budgetPct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No budget categories */}
      {unbudgeted.length > 0 && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              No Budget Set
            </h2>
            <Link
              to="/settings"
              className="inline-flex items-center gap-1 text-xs font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 px-3 py-1.5 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 shadow-sm"
            >
              Set budgets <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {unbudgeted.map(pred => (
              <div key={pred.category} className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{pred.category}</span>
                    <p className="text-xs text-gray-400 mt-0.5">Pace: ${pred.dailyPace.toFixed(0)}/day</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">${pred.spentSoFar.toFixed(0)} spent</p>
                    <p className="text-xs text-gray-400">~${pred.projectedTotal.toFixed(0)} projected</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
