import { useEffect, useState } from 'react';
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

const DIFFICULTY_STYLES: Record<string, { bg: string; text: string }> = {
  easy: { bg: 'bg-green-100', text: 'text-green-700' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700' },
  hard: { bg: 'bg-red-100', text: 'text-red-700' },
};

const TYPE_LABELS: Record<string, string> = {
  call_to_negotiate: 'Call to negotiate',
  switch_provider: 'Switch provider',
  cancel_downgrade: 'Cancel/downgrade',
  rate_reduction: 'Request rate cut',
};

export default function Negotiate() {
  const [suggestions, setSuggestions] = useState<NegotiationSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get('/negotiate')
      .then(r => setSuggestions(r.data.suggestions))
      .catch(() => setError('Failed to load negotiation suggestions.'))
      .finally(() => setLoading(false));
  }, []);

  const totalSavings = suggestions
    .filter(s => !completedIds.has(s.id))
    .reduce((sum, s) => sum + s.estimatedSavings.high, 0);

  if (loading) return <div className="text-gray-500 text-center py-12">Scanning your bills...</div>;
  if (error) return <div className="bg-red-50 text-red-600 text-sm p-4 rounded-lg">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Negotiate Your Bills</h1>
        <p className="text-sm text-gray-500">Scripts and phone numbers to lower your bills today.</p>
      </div>

      {suggestions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🤝</p>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No negotiable bills found</h2>
          <p className="text-sm text-gray-500">We couldn't find recurring bills that match our negotiation database. Add more transaction history for better results.</p>
        </div>
      )}

      {totalSavings > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <p className="text-emerald-800 font-semibold">
            Up to ${totalSavings.toFixed(0)}/month in potential savings (${(totalSavings * 12).toFixed(0)}/year)
          </p>
          <p className="text-xs text-emerald-600 mt-0.5">Click each bill to see the negotiation script.</p>
        </div>
      )}

      <div className="space-y-3">
        {suggestions.map(s => {
          const isExpanded = expandedId === s.id;
          const isDone = completedIds.has(s.id);
          if (isDone) return null;
          const diff = DIFFICULTY_STYLES[s.difficulty];

          return (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header — always visible */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : s.id)}
                className="w-full text-left p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{s.billName}</h3>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${diff.bg} ${diff.text}`}>
                        {s.difficulty}
                      </span>
                      <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                        {TYPE_LABELS[s.type]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Currently ${s.currentAmount.toFixed(0)}/mo &middot; Save ${s.estimatedSavings.low}-${s.estimatedSavings.high}/mo
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-emerald-600">
                      ${s.annualSavings.high.toFixed(0)}
                    </p>
                    <p className="text-[10px] text-gray-400">/year potential</p>
                  </div>
                </div>
              </button>

              {/* Expanded — script + tips */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-5 space-y-4">
                  {/* Phone + timing */}
                  {(s.phoneNumber || s.bestTimeToCall) && (
                    <div className="flex flex-wrap gap-4">
                      {s.phoneNumber && (
                        <div>
                          <p className="text-xs font-medium text-gray-500">Call</p>
                          <a href={`tel:${s.phoneNumber}`} className="text-sm font-semibold text-indigo-600">
                            {s.phoneNumber}
                          </a>
                        </div>
                      )}
                      {s.bestTimeToCall && (
                        <div>
                          <p className="text-xs font-medium text-gray-500">Best time</p>
                          <p className="text-sm text-gray-900">{s.bestTimeToCall}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium text-gray-500">Success rate</p>
                        <p className="text-sm text-gray-900">{s.successRate}</p>
                      </div>
                    </div>
                  )}

                  {/* Script */}
                  <div className="bg-indigo-50 rounded-lg p-4">
                    <p className="text-xs font-semibold text-indigo-800 mb-2">What to say:</p>
                    <p className="text-sm text-indigo-900 leading-relaxed italic">"{s.script}"</p>
                  </div>

                  {/* Tips */}
                  {s.tips.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-2">Tips:</p>
                      <ul className="space-y-1.5">
                        {s.tips.map((tip, i) => (
                          <li key={i} className="text-sm text-gray-600 flex gap-2">
                            <span className="text-indigo-400 shrink-0">&#8226;</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => setCompletedIds(prev => new Set([...prev, s.id]))}
                      className="text-sm text-emerald-600 font-medium hover:text-emerald-700"
                    >
                      Done — I called
                    </button>
                    <button
                      onClick={() => setCompletedIds(prev => new Set([...prev, s.id]))}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Not interested
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {completedIds.size === suggestions.length && suggestions.length > 0 && (
        <div className="text-center py-8 text-gray-500">
          <p className="text-2xl mb-2">🎉</p>
          <p>All suggestions reviewed!</p>
        </div>
      )}
    </div>
  );
}
