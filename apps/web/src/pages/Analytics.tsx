import { useEffect, useState } from 'react';
import api from '../api/client';
import { BarChart3, Users, Zap, TrendingUp, TrendingDown, Clock, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface FeatureStat {
  feature: string;
  total_events: number;
  unique_users: number;
  last_used: string;
}

interface DailyPoint {
  day: string;
  events: number;
  users: number;
}

interface DashboardData {
  days: number;
  byFeature: FeatureStat[];
  dailyTrend: DailyPoint[];
  totals: { total_events: number; total_users: number; total_features: number };
}

const FEATURE_LABELS: Record<string, string> = {
  home: 'Home Dashboard',
  calendar: 'Expense Calendar',
  goals: 'Savings Goals',
  chat: 'AI Chat',
  advisor: 'Financial Advisor',
  simulator: 'What If Simulator',
  cut_this: 'Cut This (Subscriptions)',
  debt_payoff: 'Debt Payoff',
  transactions: 'Transactions',
  trends: 'Spending Trends',
  predictions: 'Predictions',
  subscriptions: 'Subscriptions',
  negotiate: 'Bill Negotiation',
  settings: 'Settings',
  csv_upload: 'CSV Upload',
  family: 'Family Plan',
  events: 'Recurring Income',
};

const FEATURE_COLORS: Record<string, string> = {
  home: 'bg-indigo-500',
  calendar: 'bg-blue-500',
  goals: 'bg-emerald-500',
  chat: 'bg-violet-500',
  advisor: 'bg-amber-500',
  simulator: 'bg-cyan-500',
  cut_this: 'bg-rose-500',
  debt_payoff: 'bg-red-500',
  transactions: 'bg-slate-500',
  trends: 'bg-teal-500',
  predictions: 'bg-purple-500',
  subscriptions: 'bg-pink-500',
  negotiate: 'bg-orange-500',
  settings: 'bg-gray-500',
  csv_upload: 'bg-lime-500',
  family: 'bg-sky-500',
  events: 'bg-yellow-500',
};

export default function Analytics() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/analytics/dashboard?days=${days}`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  const maxEvents = data?.byFeature?.[0]?.total_events || 1;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/settings" className="p-2 -ml-2 text-slate-400 hover:text-slate-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-indigo-500" />
              Feature Analytics
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">See which features get used most and least</p>
          </div>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                days === d ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : !data ? (
        <div className="text-center py-20 text-slate-400">Failed to load analytics</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                <Zap className="w-3.5 h-3.5" />
                Total Events
              </div>
              <p className="text-2xl font-bold text-slate-900">{data.totals.total_events.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                <Users className="w-3.5 h-3.5" />
                Active Users
              </div>
              <p className="text-2xl font-bold text-slate-900">{data.totals.total_users.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                <BarChart3 className="w-3.5 h-3.5" />
                Features Used
              </div>
              <p className="text-2xl font-bold text-slate-900">{data.totals.total_features}</p>
            </div>
          </div>

          {/* Feature ranking */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Most Used Features
              </h2>
            </div>
            <div className="divide-y divide-slate-50">
              {data.byFeature.length === 0 ? (
                <div className="px-5 py-10 text-center text-slate-400 text-sm">
                  No usage data yet. Features will appear here as users interact with the app.
                </div>
              ) : (
                data.byFeature.map((f, i) => {
                  const pct = (f.total_events / maxEvents) * 100;
                  const color = FEATURE_COLORS[f.feature] || 'bg-slate-400';
                  const label = FEATURE_LABELS[f.feature] || f.feature;
                  const isTop3 = i < 3;
                  const isBottom3 = i >= data.byFeature.length - 3 && data.byFeature.length > 6;

                  return (
                    <div key={f.feature} className="px-5 py-3 flex items-center gap-4">
                      <div className="w-6 text-center">
                        <span className={`text-sm font-bold ${isTop3 ? 'text-emerald-500' : isBottom3 ? 'text-red-400' : 'text-slate-400'}`}>
                          {i + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-800 truncate">{label}</span>
                          <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0 ml-2">
                            <span>{f.total_events} events</span>
                            <span>{f.unique_users} {f.unique_users === 1 ? 'user' : 'users'}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${color} transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      {isTop3 && (
                        <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      {isBottom3 && (
                        <TrendingDown className="w-4 h-4 text-red-300 shrink-0" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Daily activity chart (simple bar representation) */}
          {data.dailyTrend.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  Daily Activity
                </h2>
              </div>
              <div className="px-5 py-4">
                <div className="flex items-end gap-1" style={{ height: 120 }}>
                  {data.dailyTrend.map(d => {
                    const maxDaily = Math.max(...data.dailyTrend.map(x => x.events));
                    const h = maxDaily > 0 ? (d.events / maxDaily) * 100 : 0;
                    const isToday = d.day === new Date().toISOString().split('T')[0];
                    return (
                      <div
                        key={d.day}
                        className="flex-1 group relative"
                        style={{ minWidth: 4 }}
                      >
                        <div
                          className={`w-full rounded-t-sm transition-colors ${
                            isToday ? 'bg-indigo-500' : 'bg-indigo-200 group-hover:bg-indigo-400'
                          }`}
                          style={{ height: `${Math.max(h, 2)}%` }}
                        />
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                          <div className="bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                            {new Date(d.day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            <br />{d.events} events
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-400">
                  <span>{new Date(data.dailyTrend[0].day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  <span>{new Date(data.dailyTrend[data.dailyTrend.length - 1].day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              </div>
            </div>
          )}

          {/* Least used callout */}
          {data.byFeature.length > 3 && (
            <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-5">
              <h3 className="font-semibold text-amber-800 text-sm mb-2 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Least Used Features
              </h3>
              <p className="text-xs text-amber-700 mb-3">
                These features might need better discoverability, a redesign, or could be candidates for removal.
              </p>
              <div className="flex flex-wrap gap-2">
                {data.byFeature.slice(-3).reverse().map(f => (
                  <span key={f.feature} className="inline-flex items-center gap-1.5 bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-800">
                    <span className={`w-2 h-2 rounded-full ${FEATURE_COLORS[f.feature] || 'bg-slate-400'}`} />
                    {FEATURE_LABELS[f.feature] || f.feature}
                    <span className="text-amber-500 ml-1">{f.total_events} events</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
