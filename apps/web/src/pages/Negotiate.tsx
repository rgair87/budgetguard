import { useEffect, useState } from 'react';
import {
  Phone,
  PhoneCall,
  DollarSign,
  Clock,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  X,
  TrendingDown,
  Award,
} from 'lucide-react';
import api from '../api/client';

interface NegotiationSuggestion {
  id: string;
  billName: string;
  currentAmount: number;
  estimatedSavings: { low: number; high: number };
  annualSavings: { low: number; high: number };
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'call_to_negotiate' | 'switch_provider' | 'cancel_downgrade' | 'rate_reduction';
  script: string;
  tips: string[];
  phoneNumber: string | null;
  bestTimeToCall: string | null;
  successRate: string;
}

const TYPE_LABELS: Record<string, string> = {
  call_to_negotiate: 'Call to negotiate',
  switch_provider: 'Switch provider',
  cancel_downgrade: 'Cancel/downgrade',
  rate_reduction: 'Request rate cut',
};

function parseSuccessRate(rate: string): number {
  const match = rate.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export default function Negotiate() {
  const [suggestions, setSuggestions] = useState<NegotiationSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    api.get('/negotiate')
      .then(r => setSuggestions(r.data.suggestions))
      .catch(() => setError('Failed to load negotiation suggestions.'))
      .finally(() => setLoading(false));
  }, []);

  const activeSuggestions = suggestions.filter(s => !completedIds.has(s.id));
  const totalMonthlySavings = activeSuggestions.reduce((sum, s) => sum + s.estimatedSavings.high, 0);
  const totalAnnualSavings = activeSuggestions.reduce((sum, s) => sum + s.annualSavings.high, 0);

  const handleCopyScript = (id: string, script: string) => {
    navigator.clipboard.writeText(script);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <Phone className="w-10 h-10 text-indigo-300 mb-4" />
        <p className="text-slate-400 font-medium">Scanning your bills for savings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-5 rounded-2xl flex items-center gap-3">
        <X className="w-5 h-5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 p-6 text-white shadow-sm">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Lower Your Bills</h1>
              <p className="text-sm text-blue-100">Scripts and numbers to save money today</p>
            </div>
          </div>
          {totalMonthlySavings > 0 && (
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl font-extrabold tracking-tight">
                ${totalMonthlySavings.toFixed(0)}
              </span>
              <span className="text-blue-200 text-sm font-medium">/mo potential savings</span>
            </div>
          )}
        </div>
      </div>

      {/* Empty State */}
      {suggestions.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <PhoneCall className="w-7 h-7 text-slate-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">No negotiable bills found</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            We couldn't match recurring bills to our negotiation database. Add more transaction history for better results.
          </p>
        </div>
      )}

      {/* All Reviewed State */}
      {completedIds.size === suggestions.length && suggestions.length > 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <Award className="w-7 h-7 text-emerald-500" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">All suggestions reviewed!</h2>
          <p className="text-sm text-slate-500">Nice work. Check back after your next billing cycle.</p>
        </div>
      )}

      {/* Bill Cards */}
      <div className="space-y-4">
        {suggestions.map(s => {
          const isDone = completedIds.has(s.id);
          if (isDone) return null;

          const isExpanded = expandedId === s.id;
          const successNum = parseSuccessRate(s.successRate);

          return (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md"
            >
              {/* Card Header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : s.id)}
                className="w-full text-left p-5 transition-colors hover:bg-slate-50/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    {/* Bill name + amount */}
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-slate-900 text-base">{s.billName}</h3>
                      <span className="text-sm text-slate-400 font-medium">
                        ${s.currentAmount.toFixed(0)}/mo
                      </span>
                    </div>

                    {/* Tags row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Savings badge */}
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                        <TrendingDown className="w-3.5 h-3.5" />
                        Save ${s.estimatedSavings.low}–${s.estimatedSavings.high}/mo
                      </span>

                      {/* Success rate */}
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500 transition-all"
                            style={{ width: `${Math.min(successNum, 100)}%` }}
                          />
                        </div>
                        {s.successRate}
                      </span>

                      {/* Type label */}
                      <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">
                        {TYPE_LABELS[s.type]}
                      </span>
                    </div>

                    {/* Best time tag */}
                    {s.bestTimeToCall && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        Best time: {s.bestTimeToCall}
                      </div>
                    )}
                  </div>

                  {/* Expand chevron */}
                  <div className="pt-1 shrink-0 text-slate-300 transition-transform duration-200">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-slate-100 p-5 space-y-5 animate-fade-in">
                  {/* Phone number button */}
                  {s.phoneNumber && (
                    <a
                      href={`tel:${s.phoneNumber}`}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      <PhoneCall className="w-4 h-4" />
                      Call {s.phoneNumber}
                    </a>
                  )}

                  {/* Script section */}
                  <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                        Negotiation Script
                      </p>
                      <button
                        onClick={() => handleCopyScript(s.id, s.script)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-100"
                      >
                        {copiedId === s.id ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-sm text-indigo-900 leading-relaxed">
                      "{s.script}"
                    </p>
                  </div>

                  {/* Tips */}
                  {s.tips.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Tips</p>
                      <ul className="space-y-1.5">
                        {s.tips.map((tip, i) => (
                          <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => setCompletedIds(prev => new Set([...prev, s.id]))}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      I called - it worked!
                    </button>
                    <button
                      onClick={() => setCompletedIds(prev => new Set([...prev, s.id]))}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 text-slate-500 text-sm font-medium hover:bg-slate-100 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Not interested
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      {activeSuggestions.length > 0 && (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <DollarSign className="w-4 h-4" />
            <span>
              <span className="font-semibold text-slate-700">{activeSuggestions.length}</span>{' '}
              negotiable bill{activeSuggestions.length !== 1 ? 's' : ''} found
            </span>
          </div>
          <div className="text-slate-700 font-semibold">
            Up to <span className="text-emerald-600">${totalAnnualSavings.toFixed(0)}</span>/year in savings
          </div>
        </div>
      )}
    </div>
  );
}
