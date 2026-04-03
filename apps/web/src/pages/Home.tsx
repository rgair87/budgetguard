import { useEffect, useState, useRef } from 'react';
import api from '../api/client';
import { Link } from 'react-router-dom';
import { AlertTriangle, Sparkles, Target, Phone, ChevronDown, ChevronRight, Wallet, CreditCard, CalendarClock, BrainCircuit, ExternalLink, Landmark, Upload, X, Beaker, ArrowRight } from 'lucide-react';
import RunwayScore from '../components/RunwayScore';
import PaycheckPlan from '../components/PaycheckPlan';
import InfoTip from '../components/InfoTip';
import { SkeletonDashboard } from '../components/Skeleton';
import TellerConnectButton from '../components/TellerConnect';
import useTrack from '../hooks/useTrack';
import type { RunwayScore as RunwayScoreType, PaycheckPlan as PaycheckPlanType, Account, IncomingEvent, AdvisorInsight, InsightSeverity } from '@runway/shared';

interface CategorySpend {
  category: string;
  total: number;
  count: number;
  pctOfTotal: number;
}

interface SpendingBreakdown {
  categories: CategorySpend[];
  totalSpend: number;
  period: string;
  periodLabel: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Food & Dining': 'bg-orange-500', 'Groceries': 'bg-green-500',
  'Entertainment': 'bg-purple-500', 'Shopping': 'bg-pink-500',
  'Transportation': 'bg-blue-500', 'Gas': 'bg-yellow-500',
  'Utilities': 'bg-teal-500', 'Healthcare': 'bg-red-500',
  'Insurance': 'bg-indigo-500', 'Housing': 'bg-slate-500',
  'Home Improvement': 'bg-lime-500', 'Education': 'bg-emerald-500',
  'Services': 'bg-cyan-500', 'Debt Payments': 'bg-rose-500',
  'Travel': 'bg-sky-500', 'Personal': 'bg-amber-500',
  'Transfers': 'bg-gray-400',
};

interface DrillTransaction { merchant: string; amount: number; date: string; }

function cleanMerchantName(raw: string): string {
  return raw
    .replace(/\s*(DEBIT CARD PURCHASE|RECURRING DEBIT CARD|POS DEBIT|POS PURCHASE)\s*/gi, '')
    .replace(/\s*(ACH WEB-?RECUR?|ACH WEB|ACH DEBIT|ACH TEL|ACH DR|PPD ID:?\s*\S+)/gi, '')
    .replace(/\s*POSxxxx\d+\s*xxx\d+/gi, '')
    .replace(/x{4,}\d*/gi, '')
    .replace(/\d{16}/g, '')
    .replace(/\s+\d{3}-\d{3,}-?\d*\s+\w{2}\s*$/i, '')
    .replace(/\s+\d{2}\/\d{2}$/i, '')
    .replace(/\s*(CARD\d+|\[PENDING\])/gi, '')
    .replace(/\s+\w{2}\s*$/i, (match) => {
      const state = match.trim();
      if (/^[A-Z]{2}$/.test(state) && ['TX','WA','CA','NY','FL','IL','PA','OH','GA','NC','MI','NJ','VA','AZ','MA','CO','WI','MN','MO','MD','IN','TN','OR','SC','KY','LA','OK','CT','IA','MS','AR','KS','NV','NM','NE','WV','ID','HI','ME','NH','RI','MT','DE','SD','ND','AK','VT','WY','DC'].includes(state)) return '';
      return match;
    })
    .replace(/\s+\d{3}-\d{3,4}-?\d{0,4}$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function formatTxDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// --- Collapsible Section ---
function Section({ title, linkTo, linkLabel, children, defaultOpen = false, badge, icon: Icon }: {
  title: string; linkTo?: string; linkLabel?: string;
  children: React.ReactNode; defaultOpen?: boolean; badge?: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden animate-fade-in">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className="w-4 h-4 text-slate-400" strokeWidth={1.75} />}
          {!Icon && (open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />)}
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {badge && (
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{badge}</span>
          )}
        </div>
        {linkTo && open && (
          <Link
            to={linkTo}
            onClick={e => e.stopPropagation()}
            className="text-xs text-indigo-500 font-semibold hover:text-indigo-700 flex items-center gap-1"
          >
            {linkLabel || 'View all'} <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </button>
      {open && <div className="px-5 pb-5 border-t border-slate-100">{children}</div>}
    </div>
  );
}

// --- Spending Breakdown (condensed) ---
function SpendingByCategory() {
  const [data, setData] = useState<SpendingBreakdown | null>(null);
  const [period, setPeriod] = useState<'this_month' | 'last_30' | 'last_90'>('this_month');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drillData, setDrillData] = useState<DrillTransaction[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setLoading(true);
    setExpanded(null);
    api.get(`/runway/spending-by-category?period=${period}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [period]);

  const toggleCategory = (category: string) => {
    if (expanded === category) { setExpanded(null); return; }
    setExpanded(category);
    setDrillLoading(true);
    api.get(`/runway/spending-by-category/transactions?category=${encodeURIComponent(category)}&period=${period}`)
      .then(r => setDrillData(r.data.transactions || []))
      .finally(() => setDrillLoading(false));
  };

  if (loading && !data) return <div className="py-4 text-center text-xs text-gray-400 animate-pulse">Loading spending data...</div>;
  if (!data || data.categories.length === 0) return (
    <div className="py-6 text-center">
      <p className="text-sm text-gray-500">No categorized spending yet.</p>
      <p className="text-xs text-gray-400 mt-1">Import transactions or <Link to="/transactions" className="text-indigo-500 hover:underline">classify your merchants</Link> to see your breakdown.</p>
    </div>
  );

  const maxTotal = data.categories[0]?.total || 1;
  const visible = showAll ? data.categories : data.categories.slice(0, 5);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">{data.periodLabel}, ${data.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} total</p>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value as any)}
          className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600"
        >
          <option value="this_month">This month</option>
          <option value="last_30">Last 30 days</option>
          <option value="last_90">Last 90 days</option>
        </select>
      </div>
      <div className="space-y-2">
        {visible.map(cat => (
          <div key={cat.category}>
            <button onClick={() => toggleCategory(cat.category)} className="w-full text-left">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-700 font-medium flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400">{expanded === cat.category ? '▼' : '▶'}</span>
                  {cat.category}
                  <span className="text-xs text-gray-400 font-normal">{cat.pctOfTotal}%</span>
                </span>
                <span className="text-gray-900 font-semibold text-sm">${cat.total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${CATEGORY_COLORS[cat.category] || 'bg-gray-400'}`}
                  style={{ width: `${Math.max(2, (cat.total / maxTotal) * 100)}%` }}
                />
              </div>
            </button>
            {expanded === cat.category && (
              <div className="mt-2 ml-4 border-l-2 border-gray-100 pl-3 space-y-1 pb-1">
                {drillLoading ? (
                  <p className="text-xs text-gray-400 py-1">Loading...</p>
                ) : drillData.length === 0 ? (
                  <p className="text-xs text-gray-400 py-1">No transactions found</p>
                ) : (
                  drillData.slice(0, 10).map((tx, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-gray-400 shrink-0 w-12">{formatTxDate(tx.date)}</span>
                        <span className="text-gray-700 truncate">{cleanMerchantName(tx.merchant)}</span>
                      </div>
                      <span className="text-gray-900 font-medium shrink-0 ml-2">${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                  ))
                )}
                {drillData.length > 10 && (
                  <Link to="/transactions" className="text-xs text-indigo-600">View all {drillData.length} →</Link>
                )}
              </div>
            )}
          </div>
        ))}
        {!showAll && data.categories.length > 5 && (
          <button
            onClick={() => setShowAll(true)}
            className="text-xs text-indigo-600 text-center w-full py-1"
          >
            +{data.categories.length - 5} more categories
          </button>
        )}
      </div>
    </div>
  );
}

// --- Alert type ---
interface Alert {
  id: string; type: string;
  severity: 'critical' | 'warning' | 'info' | 'win';
  title: string; body: string;
  action: string | null; actionLink: string | null;
}

// =========================
// HOME PAGE
// =========================
export default function Home() {
  const track = useTrack('home');
  const [score, setScore] = useState<RunwayScoreType | null>(null);
  const [plan, setPlan] = useState<PaycheckPlanType | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [events, setEvents] = useState<IncomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLinkedBank, setHasLinkedBank] = useState(false);
  const [wizardCompleted, setWizardCompleted] = useState(true); // default true to avoid flash
  const [latestTransactionDate, setLatestTransactionDate] = useState<string | null>(null);
  const [freshnessDismissed, setFreshnessDismissed] = useState(false);
  const [advisorSummary, setAdvisorSummary] = useState<{ available: boolean; healthScore?: number; healthLabel?: string; topInsights?: AdvisorInsight[] } | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(false);
  const [clearingDemo, setClearingDemo] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Detect demo data by checking for the exact set of demo account names
  const DEMO_ACCOUNT_NAMES = ['Main Checking', 'Emergency Savings', 'Chase Visa', 'Car Loan'];
  const isDemoData = accounts.length > 0 && accounts.length <= 5 &&
    DEMO_ACCOUNT_NAMES.every(name => accounts.some(a => a.name === name));

  async function clearDemoData() {
    setClearingDemo(true);
    try {
      await api.post('/auth/clear-demo-data');
      window.location.reload();
    } catch (e) {
      console.error('Failed to clear demo data:', e);
      setClearingDemo(false);
    }
  }

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    let errorCount = 0;
    await Promise.all([
      api.get('/runway').then((r) => setScore(r.data)).catch(() => { errorCount++; }),
      api.get('/runway/paycheck-plan').then((r) => setPlan(r.data)).catch(() => {}),
      api.get('/accounts').then((r) => {
        setAccounts(r.data.accounts);
        setHasLinkedBank(r.data.hasLinkedBank);
        setWizardCompleted(!!r.data.wizardCompleted);
        setLatestTransactionDate(r.data.latestTransactionDate);
      }).catch(() => { errorCount++; }),
      api.get('/events').then((r) => setEvents(r.data)).catch(() => {}),
      api.get('/advisor/summary').then((r) => setAdvisorSummary(r.data)).catch(() => {}),
      api.get('/alerts').then((r) => setAlerts(r.data.alerts || [])).catch(() => {}),
    ]).finally(() => {
      setLoading(false);
      if (errorCount > 0) setLoadError('Some data failed to load.');
    });
  }

  useEffect(() => { loadData(); }, [refreshKey]);

  async function loadDemoData() {
    setLoadingDemo(true);
    try {
      await api.post('/auth/demo-data');
      // Force full page reload to ensure all components pick up the new data
      window.location.reload();
    } catch (e) {
      console.error('Failed to load demo data:', e);
      setLoadingDemo(false);
    }
  }

  if (loading) {
    return <SkeletonDashboard />;
  }

  // Separate critical alerts from others
  const criticalAlerts = alerts.filter(a => !dismissedAlerts.has(a.id) && a.severity === 'critical');
  const otherAlerts = alerts.filter(a => !dismissedAlerts.has(a.id) && a.severity !== 'critical');

  // Data freshness check
  const daysOld = latestTransactionDate
    ? Math.floor((Date.now() - new Date(latestTransactionDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isStale = !freshnessDismissed && !hasLinkedBank && accounts.length > 0 && (daysOld === null || daysOld > 7);

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-red-700">{loadError}</p>
          <button
            onClick={() => { setLoadError(null); setRefreshKey(k => k + 1); }}
            className="text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}
      {/* Demo data banner */}
      {isDemoData && !demoBannerDismissed && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <Beaker className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm font-medium text-amber-800">You're viewing sample data</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={clearDemoData}
              disabled={clearingDemo}
              className="text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {clearingDemo ? 'Clearing...' : 'Clear & use my data'}
            </button>
            <button onClick={() => setDemoBannerDismissed(true)} className="text-amber-400 hover:text-amber-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* No accounts - friendly welcome state */}
      {accounts.length === 0 && (
        <div className="space-y-5 animate-fade-in">
          <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-6 shadow-lg shadow-indigo-200/50 text-center">
            <h2 className="text-xl font-bold text-white mb-1">Let's set up your dashboard</h2>
            <p className="text-sm text-indigo-100">Add your accounts so Runway can calculate your financial runway</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mx-auto mb-3">
                <Landmark className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm font-semibold text-slate-800 mb-0.5">Connect Bank</p>
              <p className="text-xs text-slate-400 mb-3">Securely link via Teller</p>
              <TellerConnectButton
                onSuccess={() => setRefreshKey(k => k + 1)}
                className="inline-flex items-center gap-2 text-xs bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-2 rounded-xl font-medium shadow-sm hover:from-indigo-700 hover:to-indigo-800 transition"
              />
              <Link to="/settings" className="text-[11px] text-slate-400 hover:text-indigo-500 mt-2 transition-colors">
                or add manually
              </Link>
            </div>
            <Link to="/csv-upload" className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 text-center card-hover group">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                <Upload className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm font-semibold text-slate-800 mb-0.5">Upload CSV</p>
              <p className="text-xs text-slate-400">Import from your bank's export</p>
              <div className="flex items-center justify-center gap-1 mt-2 text-xs text-emerald-500 font-medium">
                Upload file <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
            <button onClick={loadDemoData} disabled={loadingDemo} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 text-center card-hover group disabled:opacity-50">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm font-semibold text-slate-800 mb-0.5">{loadingDemo ? 'Loading...' : 'Try Sample Data'}</p>
              <p className="text-xs text-slate-400">See how Runway works first</p>
              <div className="flex items-center justify-center gap-1 mt-2 text-xs text-violet-500 font-medium">
                Explore demo <ArrowRight className="w-3 h-3" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Critical alerts only - these deserve top-level attention (hide when no data) */}
      {accounts.length > 0 && criticalAlerts.slice(0, 2).map(alert => (
        <div key={alert.id} className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">URGENT</span>
              <span className="text-sm font-semibold text-red-900">{alert.title}</span>
            </div>
            <p className="text-xs text-red-800/80">{alert.body}</p>
            {alert.action && alert.actionLink && (
              <Link to={alert.actionLink} className="text-xs font-medium text-red-700 mt-1 inline-block underline">{alert.action}</Link>
            )}
          </div>
          <button onClick={() => setDismissedAlerts(prev => new Set([...prev, alert.id]))}
            className="opacity-40 hover:opacity-70 text-lg leading-none shrink-0">&times;</button>
        </div>
      ))}

      {/* Stale data warning */}
      {isStale && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
          <p className="text-xs text-amber-800">
            {daysOld !== null ? `Data is ${daysOld} days old. ` : 'No transactions. '}
            <Link to="/settings" className="font-medium text-indigo-600">Link bank</Link> or <Link to="/csv-upload" className="font-medium text-indigo-600">upload CSV</Link>
          </p>
          <button onClick={() => setFreshnessDismissed(true)} className="text-amber-400 hover:text-amber-600 text-sm ml-2">&times;</button>
        </div>
      )}

      {/* === HERO: Runway Score === */}
      {score && accounts.length > 0 && <RunwayScore score={score} plan={plan} />}

      {/* Wizard nudge */}
      {!wizardCompleted && accounts.length > 0 && (
        <Link to="/budget-wizard"
          className="block bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 hover:bg-indigo-100 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <div>
                <p className="text-sm font-medium text-indigo-800">Set up your money plan</p>
                <p className="text-xs text-indigo-600">Review your bills, debt, and spending targets for accurate tracking.</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-indigo-400" />
          </div>
        </Link>
      )}

      {/* Quick stats row */}
      {score && accounts.length > 0 && (
        <div className="grid grid-cols-3 gap-3 animate-fade-in">
          <Link to="/transactions?dateFrom=this_month&spendingOnly=true" className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 text-center card-hover block hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-2">
              <Wallet className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-lg font-bold text-slate-900 animate-count-up">${score.spentThisMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5 flex items-center justify-center gap-1">Spent this month <InfoTip text="Total amount you've spent so far this calendar month across all your accounts." /></p>
          </Link>
          <Link to="/trends" className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 text-center card-hover block hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-2">
              <CreditCard className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-lg font-bold text-slate-900 animate-count-up">${score.dailyBurnRate.toFixed(0)}</p>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5 flex items-center justify-center gap-1">Daily burn <InfoTip text="How much you spend per day on average, based on the last 90 days." /></p>
          </Link>
          {plan ? (
            <Link to="/budgets" className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 text-center card-hover block hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2 ${plan.buckets.spending.monthly > 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <Target className={`w-4 h-4 ${plan.buckets.spending.monthly > 0 ? 'text-emerald-500' : 'text-red-500'}`} />
              </div>
              <p className={`text-lg font-bold animate-count-up ${(plan.buckets.spending.monthly - score.spentThisMonth) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                ${Math.abs(Math.round(plan.buckets.spending.monthly - score.spentThisMonth)).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5 flex items-center justify-center gap-1">
                {(plan.buckets.spending.monthly - score.spentThisMonth) >= 0 ? 'Left to spend' : 'Over plan'} <InfoTip text="How much spending money you have left this month after bills, debt, and savings." />
              </p>
            </Link>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 text-center card-hover">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2 bg-slate-50">
                <Target className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-lg font-bold text-slate-400">—</p>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">No budget set</p>
            </div>
          )}
        </div>
      )}

      {/* Non-critical alerts - collapsed (hide when no data) */}
      {accounts.length > 0 && otherAlerts.length > 0 && (
        <Section title="Alerts" badge={`${otherAlerts.length}`} defaultOpen={false} icon={AlertTriangle}>
          <div className="space-y-2">
            {otherAlerts.slice(0, 5).map(alert => {
              const colors: Record<string, string> = {
                warning: 'bg-amber-50 border-amber-200 text-amber-900',
                info: 'bg-blue-50 border-blue-200 text-blue-900',
                win: 'bg-emerald-50 border-emerald-200 text-emerald-900',
              };
              return (
                <div key={alert.id} className={`border rounded-lg p-3 ${colors[alert.severity] || colors.info} flex items-start justify-between gap-2`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-xs opacity-80 mt-0.5">{alert.body}</p>
                    {alert.action && alert.actionLink && (
                      <Link to={alert.actionLink} className="text-xs font-medium mt-1 inline-block underline">{alert.action}</Link>
                    )}
                  </div>
                  <button onClick={() => setDismissedAlerts(prev => new Set([...prev, alert.id]))}
                    className="opacity-40 hover:opacity-70 text-sm leading-none shrink-0">&times;</button>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Advisor top insight - just 1 teaser */}
      {advisorSummary?.available && advisorSummary.topInsights && advisorSummary.topInsights.length > 0 && (
        <Link to="/advisor" className="block bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 hover:shadow-md transition-shadow card-hover animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                <BrainCircuit className="w-4 h-4 text-indigo-500" />
              </div>
              {(() => {
                const sev: Record<InsightSeverity, { bg: string; text: string; label: string }> = {
                  critical: { bg: 'bg-red-50', text: 'text-red-600', label: 'Urgent' },
                  warning: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Warning' },
                  info: { bg: 'bg-slate-50', text: 'text-slate-600', label: 'Tip' },
                  win: { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Win' },
                };
                const s = sev[advisorSummary.topInsights![0].severity] || sev.info;
                return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>;
              })()}
            </div>
            <span className="text-xs text-indigo-500 font-semibold shrink-0 flex items-center gap-1">View report <ChevronRight className="w-3 h-3" /></span>
          </div>
          <p className="text-sm font-semibold text-slate-800 mb-0.5">{advisorSummary.topInsights[0].title}</p>
          <p className="text-xs text-slate-500 line-clamp-2">{advisorSummary.topInsights[0].body}</p>
        </Link>
      )}
      {advisorSummary && !advisorSummary.available && (
        <Link to="/advisor" className="block bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-5 shadow-lg shadow-indigo-200/50 card-hover animate-fade-in">
          <div className="flex items-center gap-2.5 mb-2">
            <BrainCircuit className="w-5 h-5 text-white/80" />
            <p className="text-sm font-bold text-white">Get your Financial Health Report</p>
          </div>
          <p className="text-xs text-indigo-100">AI-powered analysis of your spending, debt, and savings.</p>
        </Link>
      )}

      {/* Paycheck Plan - collapsed by default */}
      <Section title="Paycheck Plan" linkTo="/calendar" linkLabel="Calendar" defaultOpen={false} icon={Wallet}>
        <PaycheckPlan />
      </Section>

      {/* Spending breakdown - collapsed, shows top 5 */}
      <Section title="Where Your Money Goes" linkTo="/transactions" linkLabel="Transactions" defaultOpen={false} icon={CreditCard}>
        <SpendingByCategory />
      </Section>

      {/* Accounts - collapsed */}
      <Section title="Accounts" badge={`${accounts.length}`} linkTo="/settings" linkLabel="Manage" defaultOpen={false} icon={Wallet}>
        <div className="space-y-2">
          {accounts.map((acct) => (
            <div key={acct.id} className="flex items-center justify-between py-1.5">
              <div>
                <p className="text-sm font-medium text-gray-900">{acct.name}</p>
                <p className="text-xs text-gray-400 capitalize">{acct.institution_name ? `${acct.institution_name} · ` : ''}{acct.type}</p>
              </div>
              <p className={`text-sm font-semibold ${acct.type === 'credit' ? 'text-red-600' : 'text-gray-900'}`}>
                {acct.type === 'credit' ? '-' : ''}${Math.abs(Number(acct.current_balance)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Upcoming events - collapsed */}
      {events.length > 0 && (
        <Section title="Upcoming Expenses" badge={`${events.length}`} linkTo="/calendar" linkLabel="Manage" defaultOpen={false} icon={CalendarClock}>
          <div className="space-y-2">
            {events.slice(0, 5).map((evt) => (
              <div key={evt.id} className="flex items-center justify-between py-1.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">{evt.name}</p>
                  <p className="text-xs text-gray-400">
                    {evt.expected_date
                      ? new Date(evt.expected_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : 'Anytime'}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  ${Number(evt.estimated_amount).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Quick actions row */}
      <div className="grid grid-cols-3 gap-3 animate-fade-in">
        <Link to="/simulator" className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 text-center card-hover group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs font-semibold text-slate-700">What If?</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Simulate expenses</p>
        </Link>
        <Link to="/goals" className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 text-center card-hover group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
            <Target className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs font-semibold text-slate-700">Goals</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Track savings</p>
        </Link>
        <Link to="/negotiate" className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 text-center card-hover group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
            <Phone className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs font-semibold text-slate-700">Negotiate</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Lower your bills</p>
        </Link>
      </div>
    </div>
  );
}
