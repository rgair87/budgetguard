import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import type { AdvisorReport, AdvisorInsight, InsightSeverity } from '@runway/shared';

const SEVERITY_STYLES: Record<InsightSeverity, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-100', text: 'text-red-700', label: 'Urgent' },
  warning: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Warning' },
  info: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Info' },
  win: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Win' },
};

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, win: 2, info: 3 };

function scoreColor(score: number): string {
  if (score <= 20) return 'text-red-500';
  if (score <= 40) return 'text-orange-500';
  if (score <= 60) return 'text-amber-500';
  if (score <= 80) return 'text-emerald-500';
  return 'text-green-500';
}

function scoreBg(score: number): string {
  if (score <= 20) return 'bg-red-50 border-red-200';
  if (score <= 40) return 'bg-orange-50 border-orange-200';
  if (score <= 60) return 'bg-amber-50 border-amber-200';
  if (score <= 80) return 'bg-emerald-50 border-emerald-200';
  return 'bg-green-50 border-green-200';
}

function formatCacheAge(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function SeverityBadge({ severity }: { severity: InsightSeverity }) {
  const s = SEVERITY_STYLES[severity] || SEVERITY_STYLES.info;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  hard: 'bg-red-100 text-red-700',
};

function InsightCard({ insight }: { insight: AdvisorInsight }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <SeverityBadge severity={insight.severity} />
        <h3 className="font-semibold text-gray-900 text-sm">{insight.title}</h3>
        {insight.difficulty && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${DIFFICULTY_COLORS[insight.difficulty] || ''}`}>
            {insight.difficulty}
          </span>
        )}
        {insight.timeToComplete && (
          <span className="text-[10px] text-gray-400">{insight.timeToComplete}</span>
        )}
      </div>
      <p className="text-sm text-gray-600 leading-relaxed">{insight.body}</p>
      {insight.action && (
        <div className="mt-3 bg-indigo-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-indigo-800 mb-0.5">Action:</p>
          <p className="text-xs text-indigo-700 leading-relaxed">{insight.action}</p>
        </div>
      )}
      <div className="flex items-center gap-3 mt-2">
        {insight.estimatedImpact && (
          <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
            {insight.estimatedImpact}
          </span>
        )}
        {insight.relatedPage && (
          <Link to={insight.relatedPage} className="text-xs text-gray-400 hover:text-indigo-600">
            View details &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}

export default function Advisor() {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Financial Advisor</h1>
          <p className="text-sm text-gray-500">AI-powered analysis of your complete financial picture.</p>
        </div>
        <div className="text-right">
          {report?.cached && report.cachedAt && (
            <p className="text-xs text-gray-400 mb-1">Analyzed {formatCacheAge(report.cachedAt)}</p>
          )}
          <button
            onClick={() => loadReport(true)}
            disabled={loading}
            className="text-sm text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
          >
            {report?.cached ? 'Refresh analysis' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-gray-500">Analyzing your finances...</p>
          <p className="text-xs text-gray-400 mt-1">This may take a few seconds</p>
        </div>
      )}

      {/* Error */}
      {error && <div className="bg-red-50 text-red-600 text-sm p-4 rounded-lg">{error}</div>}

      {!loading && !error && report && (
        <>
          {/* Health Score */}
          <div className={`rounded-xl border p-6 ${scoreBg(report.healthScore)}`}>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className={`text-5xl font-bold ${scoreColor(report.healthScore)}`}>{report.healthScore}</p>
                <p className="text-xs text-gray-500 mt-1">out of 100</p>
              </div>
              <div className="flex-1">
                <span className={`inline-block text-sm font-semibold px-3 py-1 rounded-full ${scoreColor(report.healthScore)} ${scoreBg(report.healthScore)}`}>
                  {report.healthLabel}
                </span>
                <p className="text-sm text-gray-700 mt-2 leading-relaxed">{report.healthSummary}</p>
              </div>
            </div>
          </div>

          {/* Priority Actions */}
          {report.priorityActions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Do This Now</h2>
              <div className="space-y-2">
                {report.priorityActions.map(pa => (
                  <div key={pa.rank} className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex gap-4">
                    <span className="text-2xl font-bold text-indigo-300 shrink-0 w-8 text-center">{pa.rank}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-indigo-900 text-sm">{pa.action}</p>
                        {pa.difficulty && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${DIFFICULTY_COLORS[pa.difficulty] || ''}`}>
                            {pa.difficulty}
                          </span>
                        )}
                        {pa.timeToComplete && (
                          <span className="text-[10px] text-indigo-500">{pa.timeToComplete}</span>
                        )}
                      </div>
                      <p className="text-xs text-indigo-700 mt-0.5">{pa.reason}</p>
                      <p className="text-xs text-indigo-600 font-semibold mt-1">{pa.impact}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* What Changed */}
          {report.changes.hasLastReport && report.changes.summary && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">What Changed</h2>
              <p className="text-sm text-gray-600 mb-3">{report.changes.summary}</p>
              <div className="flex gap-6">
                {report.changes.improved.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-emerald-600 mb-1">Improved</p>
                    {report.changes.improved.map((item, i) => (
                      <p key={i} className="text-xs text-gray-600 flex items-center gap-1">
                        <span className="text-emerald-500">&#10003;</span> {item}
                      </p>
                    ))}
                  </div>
                )}
                {report.changes.regressed.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-amber-600 mb-1">Needs Attention</p>
                    {report.changes.regressed.map((item, i) => (
                      <p key={i} className="text-xs text-gray-600 flex items-center gap-1">
                        <span className="text-amber-500">&#9888;</span> {item}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Insights */}
          {sortedInsights.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Insights</h2>
              <div className="space-y-3">
                {sortedInsights.map(insight => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            </div>
          )}

          {/* What-If Scenarios */}
          {report.scenarios.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">What If...</h2>
              <div className="space-y-3">
                {report.scenarios.map((s, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
                    <p className="font-medium text-gray-900 text-sm mb-3">{s.description}</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-lg font-bold text-green-600">${Math.abs(s.monthlySavings).toLocaleString()}</p>
                        <p className="text-xs text-gray-500">{s.monthlySavings < 0 ? 'added/month' : 'saved/month'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-indigo-600">+{s.runwayDaysGained}</p>
                        <p className="text-xs text-gray-500">runway days</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-gray-900">${Math.abs(s.annualImpact).toLocaleString()}</p>
                        <p className="text-xs text-gray-500">annual impact</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom CTA */}
          <Link
            to="/chat"
            className="block text-center bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600 hover:text-indigo-600 hover:border-indigo-200"
          >
            Have questions about this report? Ask your AI assistant &rarr;
          </Link>
        </>
      )}
    </div>
  );
}
