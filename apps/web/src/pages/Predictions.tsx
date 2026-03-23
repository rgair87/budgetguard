import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

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

const STATUS_STYLES: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  over_budget: { bg: 'bg-red-50', text: 'text-red-700', ring: 'border-red-200', label: 'Over Budget' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'border-amber-200', label: 'Warning' },
  on_track: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'border-emerald-200', label: 'On Track' },
  no_budget: { bg: 'bg-gray-50', text: 'text-gray-600', ring: 'border-gray-200', label: 'No Budget' },
};

export default function Predictions() {
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
  if (error) return <div className="bg-red-50 text-red-600 text-sm p-4 rounded-lg">{error}</div>;
  if (!data) return null;

  const problems = data.predictions.filter(p => p.status === 'over_budget' || p.status === 'warning');
  const onTrack = data.predictions.filter(p => p.status === 'on_track');
  const unbudgeted = data.predictions.filter(p => p.status === 'no_budget');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Spending Predictions</h1>
        <p className="text-sm text-gray-500">
          {data.daysLeftInMonth} days left in the month &middot; {data.percentThroughMonth.toFixed(0)}% through
        </p>
      </div>

      {/* Overall summary */}
      <div className={`rounded-xl border p-5 ${
        problems.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
      }`}>
        <p className={`text-sm font-medium ${
          problems.length > 0 ? 'text-amber-800' : 'text-emerald-800'
        }`}>
          {data.overallMessage}
        </p>
      </div>

      {/* Problem categories */}
      {problems.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-red-700 mb-3">Needs Attention</h2>
          <div className="space-y-3">
            {problems.map(pred => {
              const style = STATUS_STYLES[pred.status];
              const budgetPct = pred.budget ? Math.min((pred.spentSoFar / pred.budget) * 100, 100) : 0;
              const projPct = pred.budget ? Math.min((pred.projectedTotal / pred.budget) * 100, 150) : 0;

              return (
                <div key={pred.category} className={`rounded-xl border p-5 ${style.bg} ${style.ring}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{pred.category}</h3>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">${pred.spentSoFar.toFixed(0)}</p>
                      {pred.budget && <p className="text-xs text-gray-500">of ${pred.budget.toFixed(0)} budget</p>}
                    </div>
                  </div>

                  {/* Progress bar */}
                  {pred.budget && (
                    <div className="relative w-full bg-white/60 rounded-full h-3 mb-3">
                      {/* Projected fill */}
                      <div
                        className="absolute h-3 rounded-full bg-red-200 opacity-50"
                        style={{ width: `${Math.min(projPct, 100)}%` }}
                      />
                      {/* Actual fill */}
                      <div
                        className={`relative h-3 rounded-full ${pred.status === 'over_budget' ? 'bg-red-500' : 'bg-amber-500'}`}
                        style={{ width: `${budgetPct}%` }}
                      />
                      {/* Budget line */}
                      <div className="absolute right-0 top-0 h-3 w-0.5 bg-gray-400 rounded" />
                    </div>
                  )}

                  <p className="text-sm text-gray-700">{pred.message}</p>

                  {pred.safeDailyBudget !== null && pred.safeDailyBudget > 0 && (
                    <p className="text-xs font-medium text-indigo-700 mt-2">
                      Slow down to ${pred.safeDailyBudget.toFixed(0)}/day to stay within budget
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* On track categories */}
      {onTrack.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-emerald-700 mb-3">On Track</h2>
          <div className="space-y-2">
            {onTrack.map(pred => (
              <div key={pred.category} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500 text-sm">&#10003;</span>
                  <span className="text-sm font-medium text-gray-900">{pred.category}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm text-gray-900">${pred.spentSoFar.toFixed(0)}</span>
                  {pred.budget && <span className="text-xs text-gray-500"> / ${pred.budget.toFixed(0)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No budget categories */}
      {unbudgeted.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-600">No Budget Set</h2>
            <Link to="/settings" className="text-xs text-indigo-600 font-medium">Set budgets</Link>
          </div>
          <div className="space-y-2">
            {unbudgeted.map(pred => (
              <div key={pred.category} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-900">{pred.category}</span>
                  <p className="text-xs text-gray-400">Pace: ${pred.dailyPace.toFixed(0)}/day</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-900">${pred.spentSoFar.toFixed(0)} spent</p>
                  <p className="text-xs text-gray-400">~${pred.projectedTotal.toFixed(0)} projected</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
