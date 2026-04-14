import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus, Calendar, Snowflake, Sun } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import api from '../api/client';

interface BillForecastData {
  merchantName: string;
  category: string;
  monthlyHistory: Array<{ month: string; amount: number }>;
  averageAmount: number;
  nextExpectedAmount: number;
  nextExpectedMonth: string;
  trend: 'rising' | 'falling' | 'stable';
  seasonalPattern: boolean;
  highMonth: string;
  lowMonth: string;
}

function fmtMonth(m: string) {
  const [, mo] = m.split('-');
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(mo) - 1];
}

export default function BillForecast() {
  const [forecasts, setForecasts] = useState<BillForecastData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/runway/bill-forecasts')
      .then(r => setForecasts(r.data.forecasts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || forecasts.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700">Bill Forecast</h2>
        </div>
        <p className="text-[10px] text-slate-400">Based on your payment history</p>
      </div>

      <div className="space-y-3">
        {forecasts.slice(0, 8).map(bill => {
          const TrendIcon = bill.trend === 'rising' ? TrendingUp : bill.trend === 'falling' ? TrendingDown : Minus;
          const trendColor = bill.trend === 'rising' ? 'text-red-500' : bill.trend === 'falling' ? 'text-emerald-500' : 'text-slate-400';

          return (
            <div key={bill.merchantName} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/transactions?search=${encodeURIComponent(bill.merchantName)}`}
                      className="text-sm font-medium text-slate-800 hover:text-indigo-600 transition-colors line-clamp-1"
                      title={bill.merchantName}
                    >
                      {bill.merchantName}
                    </Link>
                    <TrendIcon className={`w-3.5 h-3.5 ${trendColor} shrink-0`} />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {bill.category}
                    {bill.seasonalPattern && (
                      <span className="ml-2 inline-flex items-center gap-1">
                        <Sun className="w-3 h-3 text-amber-400" />
                        Peaks in {bill.highMonth}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-slate-900">${Math.round(bill.nextExpectedAmount).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400">expected {fmtMonth(bill.nextExpectedMonth)}</p>
                </div>
              </div>

              {/* Sparkline */}
              <div className="h-12">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={bill.monthlyHistory} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
                    <defs>
                      <linearGradient id={`fg-${bill.merchantName.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={bill.trend === 'rising' ? '#ef4444' : '#4f46e5'} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={bill.trend === 'rising' ? '#ef4444' : '#4f46e5'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Tooltip
                      formatter={(value: any) => [`$${Number(value).toLocaleString()}`, '']}
                      labelFormatter={(label: any) => fmtMonth(String(label))}
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', padding: '4px 8px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke={bill.trend === 'rising' ? '#ef4444' : '#4f46e5'}
                      strokeWidth={1.5}
                      fill={`url(#fg-${bill.merchantName.replace(/\s/g, '')})`}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Monthly labels */}
              <div className="flex justify-between mt-1 px-0.5">
                <span className="text-[9px] text-slate-300">{bill.monthlyHistory.length > 0 ? fmtMonth(bill.monthlyHistory[0].month) : ''}</span>
                <span className="text-[9px] text-slate-400 font-medium">avg ${Math.round(bill.averageAmount).toLocaleString()}/mo</span>
                <span className="text-[9px] text-slate-300">{bill.monthlyHistory.length > 0 ? fmtMonth(bill.monthlyHistory[bill.monthlyHistory.length - 1].month) : ''}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
