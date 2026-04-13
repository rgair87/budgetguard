import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Repeat } from 'lucide-react';
import api from '../api/client';
import { USER_CATEGORY_NAMES } from '@spenditure/shared';
import useTrack from '../hooks/useTrack';

interface Subscription {
  name: string;
  monthlyAmount: number;
  frequency: string;
  firstPaymentDate: string;
  lastPaymentDate: string;
  totalPayments: number;
  totalSpent: number;
  monthsActive: number;
  isActive: boolean;
  category: string;
  avgAmount: number;
  minAmount: number;
  maxAmount: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  subscription: 'Subscriptions',
  bill: 'Bills & Services',
  debt: 'Debt Payments',
};

const CATEGORY_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  subscription: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
  bill: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  debt: { bg: 'bg-rose-50', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-700' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatMoney(amount: number): string {
  return '$' + amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function ActionMenu({ sub, onDismiss, onReclassify }: {
  sub: Subscription;
  onDismiss: (name: string) => void;
  onReclassify: (name: string, category: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const [showCategories, setShowCategories] = useState(false);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        title="Actions"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-48 max-h-72 overflow-y-auto">
          <button
            onClick={() => setShowCategories(!showCategories)}
            className="w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-between"
          >
            Change category
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className={`transition-transform ${showCategories ? 'rotate-180' : ''}`}>
              <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          {showCategories && USER_CATEGORY_NAMES.map(cat => (
            <button
              key={cat}
              onClick={() => { onReclassify(sub.name, cat); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 pl-6"
            >
              {cat}
            </button>
          ))}
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={() => { onDismiss(sub.name); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="3" y1="3" x2="11" y2="11" />
              <line x1="11" y1="3" x2="3" y2="11" />
            </svg>
            Not recurring - remove
          </button>
        </div>
      )}
    </div>
  );
}

export default function Subscriptions() {
  const track = useTrack('subscriptions');
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'subscription' | 'bill' | 'debt'>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [dismissed, setDismissed] = useState<{ name: string; sub: Subscription } | null>(null);
  const [acting, setActing] = useState(false);

  const loadSubs = () => {
    setLoading(true);
    api.get('/runway/subscriptions')
      .then(r => setSubs(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSubs(); }, []);

  const handleDismiss = async (name: string) => {
    const sub = subs.find(s => s.name === name);
    if (!sub) return;
    setActing(true);
    try {
      await api.post('/runway/subscriptions/dismiss', { merchantName: name });
      setDismissed({ name, sub });
      setSubs(prev => prev.filter(s => s.name !== name));
    } catch { /* ignore */ }
    setActing(false);
  };

  const handleRestore = async () => {
    if (!dismissed) return;
    setActing(true);
    try {
      await api.post('/runway/subscriptions/restore', { merchantName: dismissed.name });
      setSubs(prev => [...prev, dismissed.sub].sort((a, b) => b.totalSpent - a.totalSpent));
      setDismissed(null);
    } catch { /* ignore */ }
    setActing(false);
  };

  const handleReclassify = async (name: string, category: string) => {
    setActing(true);
    try {
      await api.post('/runway/subscriptions/reclassify', { merchantName: name, category });
      setSubs(prev => prev.map(s => s.name === name ? { ...s, category } : s));
    } catch { /* ignore */ }
    setActing(false);
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-gray-500">Scanning your transactions...</p>
      </div>
    );
  }

  const filtered = subs.filter(s => {
    if (filter !== 'all' && s.category !== filter) return false;
    if (!showInactive && !s.isActive) return false;
    return true;
  }).sort((a, b) => b.monthlyAmount - a.monthlyAmount);

  const activeSubs = subs.filter(s => s.isActive);
  const totalMonthly = activeSubs.reduce((s, x) => s + x.monthlyAmount, 0);
  const totalLifetime = subs.reduce((s, x) => s + x.totalSpent, 0);
  const subCount = subs.filter(s => s.category === 'subscription').length;
  const billCount = subs.filter(s => s.category === 'bill').length;
  const debtCount = subs.filter(s => s.category === 'debt').length;
  const inactiveCount = subs.filter(s => !s.isActive).length;

  // Monthly by category
  const monthlyBySub = activeSubs.filter(s => s.category === 'subscription').reduce((a, x) => a + x.monthlyAmount, 0);
  const monthlyByBill = activeSubs.filter(s => s.category === 'bill').reduce((a, x) => a + x.monthlyAmount, 0);
  const monthlyByDebt = activeSubs.filter(s => s.category === 'debt').reduce((a, x) => a + x.monthlyAmount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Recurring Spend</h1>
        <p className="text-sm text-gray-500">
          Every subscription, bill, and debt payment we found in your transactions - with lifetime totals.
          Use the <span className="font-mono text-gray-600">&#8942;</span> menu to reclassify or remove items that don't belong.
        </p>
      </div>

      {/* Undo banner */}
      {dismissed && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
          <p className="text-sm text-amber-800">
            <span className="font-medium">{dismissed.name}</span> removed from recurring list.
          </p>
          <button
            onClick={handleRestore}
            disabled={acting}
            className="text-sm font-medium text-amber-700 hover:text-amber-900 underline"
          >
            Undo
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Monthly total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatMoney(totalMonthly)}</p>
          <p className="text-xs text-gray-400 mt-0.5">/month</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Lifetime spent</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatMoney(totalLifetime)}</p>
          <p className="text-xs text-gray-400 mt-0.5">all time</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Subscriptions</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{formatMoney(monthlyBySub)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{subCount} services</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Bills</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{formatMoney(monthlyByBill)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{billCount} recurring</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'subscription', 'bill', 'debt'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
              filter === f
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {f === 'all' ? `All (${subs.filter(s => showInactive || s.isActive).length})` :
             f === 'subscription' ? `Subscriptions (${subCount})` :
             f === 'bill' ? `Bills (${billCount})` :
             `Debt (${debtCount})`}
          </button>
        ))}
        {inactiveCount > 0 && (
          <label className="flex items-center gap-1.5 text-sm text-gray-500 ml-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show cancelled ({inactiveCount})
          </label>
        )}
      </div>

      {/* Subscription list */}
      <div className="space-y-2">
        {filtered.map((sub, i) => {
          const colors = CATEGORY_COLORS[sub.category] || CATEGORY_COLORS.bill;
          return (
            <div
              key={i}
              className={`rounded-lg border p-4 ${sub.isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-70'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/transactions?search=${encodeURIComponent(sub.name)}`}
                      className={`font-medium hover:text-indigo-600 hover:underline transition-colors ${sub.isActive ? 'text-gray-900' : 'text-gray-500 line-through'}`}
                      onClick={e => e.stopPropagation()}
                    >
                      {sub.name}
                    </Link>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>
                      {CATEGORY_LABELS[sub.category]?.replace(/s$/, '') || sub.category}
                    </span>
                    {!sub.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">
                        Cancelled
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500 flex-wrap">
                    <span>{sub.frequency}</span>
                    <span>{sub.totalPayments} payment{sub.totalPayments !== 1 ? 's' : ''}</span>
                    <span>Since {formatDate(sub.firstPaymentDate)}</span>
                    {sub.monthsActive > 1 && <span>{sub.monthsActive} months</span>}
                  </div>
                </div>
                <div className="flex items-start gap-2 shrink-0">
                  <div className="text-right">
                    <p className={`text-lg font-semibold ${sub.isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                      {formatMoney(sub.monthlyAmount)}
                      <span className="text-xs font-normal text-gray-400">/mo</span>
                    </p>
                    {sub.minAmount !== sub.maxAmount ? (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        avg {formatMoney(sub.avgAmount)} ({formatMoney(sub.minAmount)}-{formatMoney(sub.maxAmount)})
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {formatMoney(sub.totalSpent)} total
                      </p>
                    )}
                  </div>
                  <ActionMenu
                    sub={sub}
                    onDismiss={handleDismiss}
                    onReclassify={handleReclassify}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Repeat className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">No recurring charges found</h3>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">
            Import bank transactions or connect your bank to see subscriptions and recurring bills.
          </p>
        </div>
      )}

      {/* Debt monthly total */}
      {monthlyByDebt > 0 && filter !== 'subscription' && filter !== 'bill' && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
          <p className="text-sm text-rose-800">
            <span className="font-semibold">{formatMoney(monthlyByDebt)}/mo</span> goes toward debt payments.
            {' '}
            <a href="/debt" className="underline hover:text-rose-900">See payoff plan</a>
          </p>
        </div>
      )}

    </div>
  );
}

