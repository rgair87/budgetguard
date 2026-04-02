import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Shield,
  Wallet,
  CreditCard,
  PiggyBank,
} from 'lucide-react';
import api from '../api/client';
import type { AdvisorReport, AdvisorInsight, InsightSeverity, InsightCategory } from '@runway/shared';
import useTrack from '../hooks/useTrack';

/* ── Helpers ────────────────────────────────────────────────── */

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, win: 2, info: 3 };

function scoreGradient(score: number): string {
  if (score <= 40) return 'from-red-500 to-rose-600';
  if (score <= 60) return 'from-amber-400 to-orange-500';
  return 'from-emerald-400 to-teal-500';
}

function scoreRingColor(score: number): string {
  if (score <= 40) return 'stroke-red-400';
  if (score <= 60) return 'stroke-amber-400';
  return 'stroke-emerald-400';
}

function scoreTrackColor(score: number): string {
  if (score <= 40) return 'stroke-red-200/40';
  if (score <= 60) return 'stroke-amber-200/40';
  return 'stroke-emerald-200/40';
}

function formatCacheAge(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / (1000 * 60));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function severityIcon(severity: InsightSeverity) {
  switch (severity) {
    case 'critical': return <XCircle className="w-5 h-5 text-red-500 shrink-0" />;
    case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
    case 'win': return <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />;
    default: return <Activity className="w-5 h-5 text-slate-400 shrink-0" />;
  }
}

function severityBorder(severity: InsightSeverity): string {
  switch (severity) {
    case 'critical': return 'border-l-red-500';
    case 'warning': return 'border-l-amber-400';
    case 'win': return 'border-l-emerald-500';
    default: return 'border-l-slate-300';
  }
}

/* Category grouping for Detailed Breakdown */

interface CategoryGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  categories: InsightCategory[];
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    key: 'spending',
    label: 'Spending Trends',
    icon: <Wallet className="w-5 h-5" />,
    categories: ['spending_trend', 'behavioral_pattern', 'quick_win', 'bill_negotiation'],
  },
  {
    key: 'cashflow',
    label: 'Cash Flow',
    icon: <TrendingUp className="w-5 h-5" />,
    categories: ['cash_flow', 'what_if', 'health_score'],
  },
  {
    key: 'debt',
    label: 'Debt Intelligence',
    icon: <CreditCard className="w-5 h-5" />,
    categories: ['debt_intelligence'],
  },
  {
    key: 'savings',
    label: 'Savings & Growth',
    icon: <PiggyBank className="w-5 h-5" />,
    categories: ['savings', 'progress', 'action_plan'],
  },
];

function groupBadge(insights: AdvisorInsight[]): { text: string; className: string } {
  const crits = insights.filter(i => i.severity === 'critical').length;
  const warns = insights.filter(i => i.severity === 'warning').length;
  const issues = crits + warns;
  if (issues === 0) return { text: 'All good', className: 'bg-emerald-100 text-emerald-700' };
  return {
    text: `${issues} issue${issues > 1 ? 's' : ''}`,
    className: crits > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
  };
}

/* ── Circular Gauge ─────────────────────────────────────────── */

function ScoreGauge({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="relative w-36 h-36">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle
          cx="64" cy="64" r={radius}
          fill="none"
          strokeWidth="10"
          className={scoreTrackColor(score)}
        />
        <circle
          cx="64" cy="64" r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className={`${scoreRingColor(score)} transition-all duration-1000 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-white leading-none">{score}</span>
        <span className="text-[11px] text-white/70 mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

/* ── Key Takeaway Card ──────────────────────────────────────── */

function TakeawayCard({ insight }: { insight: AdvisorInsight }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      onClick={() => setExpanded(e => !e)}
      className={`w-full text-left bg-white rounded-2xl shadow-sm border border-slate-200 border-l-4 ${severityBorder(insight.severity)} p-4 transition-all duration-200 hover:shadow-md`}
    >
      <div className="flex items-start gap-3">
        {severityIcon(insight.severity)}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm leading-snug">{insight.title}</p>
          <p className={`text-sm text-slate-500 mt-1 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
            {insight.body}
          </p>
          {expanded && insight.action && (
            <div className="mt-3 bg-slate-50 rounded-xl p-3 animate-fade-in">
              <p className="text-xs font-semibold text-slate-700 mb-0.5">Recommended action</p>
              <p className="text-xs text-slate-600 leading-relaxed">{insight.action}</p>
            </div>
          )}
          {expanded && (insight.estimatedImpact || insight.timeToComplete || insight.difficulty) && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {insight.estimatedImpact && (
                <span className="text-xs text-emerald-600 font-medium">{insight.estimatedImpact}</span>
              )}
              {insight.timeToComplete && (
                <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{insight.timeToComplete}</span>
              )}
              {insight.difficulty && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  insight.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700'
                    : insight.difficulty === 'medium' ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
                }`}>{insight.difficulty}</span>
              )}
            </div>
          )}
          {expanded && insight.relatedPage && (
            <Link
              to={insight.relatedPage}
              onClick={e => e.stopPropagation()}
              className="inline-block text-xs text-indigo-500 hover:text-indigo-600 mt-2"
            >
              View details &rarr;
            </Link>
          )}
        </div>
        <div className="shrink-0 mt-0.5">
          {expanded
            ? <ChevronDown className="w-4 h-4 text-slate-400" />
            : <ChevronRight className="w-4 h-4 text-slate-400" />
          }
        </div>
      </div>
    </button>
  );
}

/* ── Collapsible Breakdown Section ──────────────────────────── */

function BreakdownSection({ group, insights }: { group: CategoryGroup; insights: AdvisorInsight[] }) {
  const [open, setOpen] = useState(false);
  const badge = groupBadge(insights);

  if (insights.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-200">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors"
      >
        <span className="text-slate-500">{group.icon}</span>
        <span className="font-semibold text-slate-800 text-sm flex-1 text-left">{group.label}</span>
        <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${badge.className}`}>
          {badge.text}
        </span>
        {open
          ? <ChevronDown className="w-4 h-4 text-slate-400" />
          : <ChevronRight className="w-4 h-4 text-slate-400" />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 animate-fade-in">
          <div className="border-t border-slate-100" />
          {insights.map(insight => (
            <InsightRow key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}

function InsightRow({ insight }: { insight: AdvisorInsight }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      onClick={() => setExpanded(e => !e)}
      className={`w-full text-left rounded-xl border border-slate-100 border-l-4 ${severityBorder(insight.severity)} p-3 hover:bg-slate-50 transition-colors`}
    >
      <div className="flex items-start gap-2.5">
        {severityIcon(insight.severity)}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-800 text-sm">{insight.title}</p>
          <p className={`text-xs text-slate-500 mt-0.5 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
            {insight.body}
          </p>
          {expanded && insight.action && (
            <div className="mt-2 bg-slate-50 rounded-lg p-2.5 animate-fade-in">
              <p className="text-[11px] font-semibold text-slate-600 mb-0.5">Action</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">{insight.action}</p>
            </div>
          )}
          {expanded && (insight.estimatedImpact || insight.timeToComplete || insight.difficulty) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {insight.estimatedImpact && (
                <span className="text-[11px] text-emerald-600 font-medium">{insight.estimatedImpact}</span>
              )}
              {insight.timeToComplete && (
                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{insight.timeToComplete}</span>
              )}
              {insight.difficulty && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  insight.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700'
                    : insight.difficulty === 'medium' ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
                }`}>{insight.difficulty}</span>
              )}
            </div>
          )}
          {expanded && insight.relatedPage && (
            <Link
              to={insight.relatedPage}
              onClick={e => e.stopPropagation()}
              className="inline-block text-[11px] text-indigo-500 hover:text-indigo-600 mt-1"
            >
              View details &rarr;
            </Link>
          )}
        </div>
        <div className="shrink-0">
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          }
        </div>
      </div>
    </button>
  );
}

/* ── Loading Progress ───────────────────────────────────────── */

const LOADING_STEPS = [
  { delay: 0, text: 'Analyzing your transactions...' },
  { delay: 5000, text: 'Calculating spending patterns...' },
  { delay: 12000, text: 'Generating personalized insights...' },
  { delay: 22000, text: 'Almost done — first reports take a bit longer...' },
];

function AdvisorLoadingProgress() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timers = LOADING_STEPS.slice(1).map((s, i) =>
      setTimeout(() => setStep(i + 1), s.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div className="text-center py-20">
      <div className="inline-block w-10 h-10 border-[3px] border-slate-300 border-t-emerald-500 rounded-full animate-spin mb-4" />
      <p className="text-slate-600 font-medium">{LOADING_STEPS[step].text}</p>
      <div className="flex justify-center gap-1.5 mt-3">
        {LOADING_STEPS.map((_, i) => (
          <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i <= step ? 'bg-emerald-500' : 'bg-slate-200'}`} />
        ))}
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */

export default function Advisor() {
  const track = useTrack('advisor');
  const [report, setReport] = useState<AdvisorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function loadReport(refresh = false) {
    setLoading(true);
    setError('');
    api.get(`/advisor${refresh ? '?refresh=true' : ''}`)
      .then(r => setReport(r.data))
      .catch(() => setError('Failed to generate advisor report. Try again.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadReport(); }, []);

  const sortedInsights = report?.insights
    ? [...report.insights].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
    : [];

  // Top 3 actionable takeaways (prioritize critical/warning/win, skip info)
  const topTakeaways = sortedInsights
    .filter(i => i.severity !== 'info')
    .slice(0, 3);

  // Categorized insights for breakdown
  const groupedInsights = CATEGORY_GROUPS.map(group => ({
    group,
    insights: sortedInsights.filter(i => group.categories.includes(i.category)),
  })).filter(g => g.insights.length > 0);

  // Remaining uncategorized insights
  const categorized = new Set(CATEGORY_GROUPS.flatMap(g => g.categories));
  const uncategorized = sortedInsights.filter(i => !categorized.has(i.category));

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Loading */}
      {loading && <AdvisorLoadingProgress />}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-4 rounded-2xl flex items-center gap-3">
          <XCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && report && (
        <>
          {/* ── 1. Health Score Hero ────────────────────────── */}
          <div className={`rounded-2xl bg-gradient-to-br ${scoreGradient(report.healthScore)} p-6 shadow-sm`}>
            <div className="flex items-center gap-6">
              <ScoreGauge score={report.healthScore} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-white/60" />
                  <span className="text-xs font-medium text-white/60 uppercase tracking-wider">Financial Health</span>
                </div>
                <p className="text-xl font-bold text-white">{report.healthLabel}</p>
                <p className="text-sm text-white/80 mt-2 leading-relaxed line-clamp-3">{report.healthSummary}</p>
              </div>
            </div>
          </div>

          {/* ── 2. Key Takeaways ───────────────────────────── */}
          {topTakeaways.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Key Takeaways</h2>
              </div>
              <div className="space-y-2.5">
                {topTakeaways.map(insight => (
                  <TakeawayCard key={insight.id} insight={insight} />
                ))}
              </div>
            </section>
          )}

          {/* ── 3. Detailed Breakdown ──────────────────────── */}
          {groupedInsights.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Detailed Breakdown</h2>
              </div>
              <div className="space-y-2.5">
                {groupedInsights.map(({ group, insights }) => (
                  <BreakdownSection key={group.key} group={group} insights={insights} />
                ))}
                {/* Uncategorized */}
                {uncategorized.length > 0 && (
                  <BreakdownSection
                    group={{
                      key: 'other',
                      label: 'Other Insights',
                      icon: <Activity className="w-5 h-5" />,
                      categories: [],
                    }}
                    insights={uncategorized}
                  />
                )}
              </div>
            </section>
          )}

          {/* ── What-If Scenarios (kept compact) ───────────── */}
          {report.scenarios.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">What If...</h2>
              </div>
              <div className="space-y-2.5">
                {report.scenarios.map((s, i) => (
                  <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                    <p className="font-medium text-slate-800 text-sm mb-3">{s.description}</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center bg-emerald-50 rounded-xl py-2">
                        <p className="text-lg font-bold text-emerald-600">${Math.abs(s.monthlySavings).toLocaleString()}</p>
                        <p className="text-[11px] text-slate-500">{s.monthlySavings < 0 ? 'added/mo' : 'saved/mo'}</p>
                      </div>
                      <div className="text-center bg-indigo-50 rounded-xl py-2">
                        <p className="text-lg font-bold text-indigo-600">+{s.runwayDaysGained}</p>
                        <p className="text-[11px] text-slate-500">runway days</p>
                      </div>
                      <div className="text-center bg-slate-50 rounded-xl py-2">
                        <p className="text-lg font-bold text-slate-800">${Math.abs(s.annualImpact).toLocaleString()}</p>
                        <p className="text-[11px] text-slate-500">annual</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Priority Actions ─────────────────────────── */}
          {report.priorityActions && report.priorityActions.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Your Top 3 Moves</h2>
              </div>
              <div className="space-y-2">
                {report.priorityActions.map((pa, i) => (
                  <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-white">{pa.rank}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm">{pa.action}</p>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{pa.reason}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {pa.impact && (
                            <span className="text-xs text-emerald-600 font-medium">{pa.impact}</span>
                          )}
                          {pa.timeToComplete && (
                            <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{pa.timeToComplete}</span>
                          )}
                          {pa.difficulty && (
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                              pa.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700'
                                : pa.difficulty === 'medium' ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                            }`}>{pa.difficulty}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Changes Since Last Report ─────────────────── */}
          {report.changes?.hasLastReport && report.changes.summary && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Since Last Report</h2>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
                <p className="text-sm text-slate-600">{report.changes.summary}</p>
                {report.changes.improved.length > 0 && (
                  <div className="space-y-1">
                    {report.changes.improved.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="text-slate-600">{item}</span>
                      </div>
                    ))}
                  </div>
                )}
                {report.changes.regressed.length > 0 && (
                  <div className="space-y-1">
                    {report.changes.regressed.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="text-slate-600">{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── 4. Refresh Button + Footer ─────────────────── */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-400">
              {report.cached && report.cachedAt
                ? <>Last updated {formatCacheAge(report.cachedAt)}</>
                : <>Generated just now</>
              }
            </div>
            <button
              onClick={() => loadReport(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-slate-600 to-slate-700 rounded-xl shadow-sm hover:from-slate-700 hover:to-slate-800 disabled:opacity-50 transition-all duration-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Chat CTA */}
          <Link
            to="/chat"
            className="block text-center bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
          >
            Have questions about this report? Ask your AI assistant &rarr;
          </Link>
        </>
      )}

      {/* Fade-in animation utility */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
