import { useEffect, useState } from 'react';
import api from '../api/client';

interface MerchantTrend {
  merchantName: string;
  category: string | null;
  isRecurring: boolean;
  months: { month: string; amount: number }[];
  currentMonth: number;
  previousMonth: number;
  changePercent: number;
  changeAmount: number;
  trend: 'up' | 'down' | 'stable' | 'new';
  alert: string | null;
}

interface CategoryTrend {
  category: string;
  months: { month: string; amount: number }[];
  currentMonth: number;
  threeMonthAvg: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

interface TrendsData {
  merchantTrends: MerchantTrend[];
  categoryTrends: CategoryTrend[];
  alerts: string[];
  totalMonthlySpend: { month: string; amount: number }[];
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[parseInt(month) - 1]} '${year.slice(2)}`;
}

function TrendBadge({ trend, changePercent }: { trend: string; changePercent: number }) {
  if (trend === 'new') return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">New</span>;
  if (trend === 'stable') return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Stable</span>;
  if (trend === 'up') return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">+{Math.abs(changePercent).toFixed(0)}%</span>;
  return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{changePercent.toFixed(0)}%</span>;
}

function MiniBar({ months, maxVal }: { months: { month: string; amount: number }[]; maxVal: number }) {
  return (
    <div className="flex items-end gap-0.5 h-8">
      {months.map((m, i) => (
        <div key={m.month} className="flex flex-col items-center gap-0.5 flex-1">
          <div
            className={`w-full rounded-sm ${i === months.length - 1 ? 'bg-indigo-500' : 'bg-gray-200'}`}
            style={{ height: `${Math.max(2, (m.amount / maxVal) * 32)}px` }}
            title={`${formatMonth(m.month)}: $${m.amount.toFixed(0)}`}
          />
        </div>
      ))}
    </div>
  );
}

export default function Trends() {
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'merchants' | 'categories'>('merchants');

  useEffect(() => {
    api.get('/trends')
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load trends.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500 text-center py-12">Analyzing spending trends...</div>;
  if (error) return <div className="bg-red-50 text-red-600 text-sm p-4 rounded-lg">{error}</div>;
  if (!data) return null;

  const totalMax = Math.max(...(data.totalMonthlySpend.map(m => m.amount)), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Spending Trends</h1>
        <p className="text-sm text-gray-500">See how your spending changes month to month.</p>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert, i) => (
            <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              {alert}
            </div>
          ))}
        </div>
      )}

      {/* Total spending chart */}
      {data.totalMonthlySpend.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Total Monthly Spending</h2>
          <div className="flex items-end gap-1 h-32">
            {data.totalMonthlySpend.map((m, i) => (
              <div key={m.month} className="flex flex-col items-center gap-1 flex-1">
                <span className="text-[10px] text-gray-500 font-medium">${(m.amount / 1000).toFixed(1)}k</span>
                <div
                  className={`w-full rounded-t ${i === data.totalMonthlySpend.length - 1 ? 'bg-indigo-500' : 'bg-gray-200'}`}
                  style={{ height: `${Math.max(4, (m.amount / totalMax) * 100)}px` }}
                />
                <span className="text-[10px] text-gray-400">{formatMonth(m.month)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('merchants')}
          className={`text-sm font-medium px-4 py-2 rounded-lg ${
            tab === 'merchants' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          By Merchant
        </button>
        <button
          onClick={() => setTab('categories')}
          className={`text-sm font-medium px-4 py-2 rounded-lg ${
            tab === 'categories' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          By Category
        </button>
      </div>

      {/* Merchant trends */}
      {tab === 'merchants' && (
        <div className="space-y-3">
          {data.merchantTrends.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">Not enough data yet. Trends appear after 2+ months of transactions.</p>
          )}
          {data.merchantTrends.map(mt => {
            const maxAmt = Math.max(...mt.months.map(m => m.amount), 1);
            return (
              <div key={mt.merchantName} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm truncate">{mt.merchantName}</p>
                      <TrendBadge trend={mt.trend} changePercent={mt.changePercent} />
                      {mt.isRecurring && (
                        <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">recurring</span>
                      )}
                    </div>
                    {mt.category && <p className="text-xs text-gray-400">{mt.category}</p>}
                    {mt.alert && <p className="text-xs text-amber-600 mt-1">{mt.alert}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-900">${mt.currentMonth.toFixed(0)}/mo</p>
                    {mt.trend !== 'new' && mt.changeAmount !== 0 && (
                      <p className={`text-xs ${mt.changeAmount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {mt.changeAmount > 0 ? '+' : ''}${mt.changeAmount.toFixed(0)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <MiniBar months={mt.months} maxVal={maxAmt} />
                  <div className="flex justify-between mt-1">
                    {mt.months.length > 0 && (
                      <>
                        <span className="text-[9px] text-gray-400">{formatMonth(mt.months[0].month)}</span>
                        <span className="text-[9px] text-gray-400">{formatMonth(mt.months[mt.months.length - 1].month)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Category trends */}
      {tab === 'categories' && (
        <div className="space-y-3">
          {data.categoryTrends.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">Not enough data yet.</p>
          )}
          {data.categoryTrends.map(ct => {
            const maxAmt = Math.max(...ct.months.map(m => m.amount), 1);
            return (
              <div key={ct.category} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 text-sm">{ct.category}</p>
                    <TrendBadge trend={ct.trend} changePercent={ct.changePercent} />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">${ct.currentMonth.toFixed(0)}</p>
                    <p className="text-xs text-gray-400">avg ${ct.threeMonthAvg.toFixed(0)}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <MiniBar months={ct.months} maxVal={maxAmt} />
                  <div className="flex justify-between mt-1">
                    {ct.months.length > 0 && (
                      <>
                        <span className="text-[9px] text-gray-400">{formatMonth(ct.months[0].month)}</span>
                        <span className="text-[9px] text-gray-400">{formatMonth(ct.months[ct.months.length - 1].month)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
