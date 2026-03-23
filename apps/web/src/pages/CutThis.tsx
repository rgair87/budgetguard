import { useEffect, useState } from 'react';
import api from '../api/client';

interface Recommendation {
  emoji: string;
  title: string;
  detail: string;
  potentialSavings: number;
  actionSteps: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  timeToComplete: string | null;
}

const DIFFICULTY_BADGES: Record<string, { bg: string; text: string }> = {
  easy: { bg: 'bg-green-100', text: 'text-green-700' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700' },
  hard: { bg: 'bg-red-100', text: 'text-red-700' },
};

export default function CutThis() {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [cached, setCached] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  function loadRecommendations(refresh = false) {
    setLoading(true);
    setError('');
    setDismissed(new Set());
    api.get(`/cut-this${refresh ? '?refresh=true' : ''}`)
      .then(r => {
        setRecs(r.data.recommendations);
        setCached(r.data.cached);
        setCachedAt(r.data.cachedAt);
      })
      .catch(() => setError('Failed to generate recommendations. Try again.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadRecommendations(); }, []);

  const totalSavings = recs
    .filter((_, i) => !dismissed.has(i))
    .reduce((s, r) => s + r.potentialSavings, 0);

  function formatCacheAge(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Cut This</h1>
          <p className="text-sm text-gray-500">
            AI-powered scan of your spending history. 3 specific recommendations.
          </p>
        </div>
        <div className="text-right">
          {cached && cachedAt && (
            <p className="text-xs text-gray-400 mb-1">Scanned {formatCacheAge(cachedAt)}</p>
          )}
          <button
            onClick={() => loadRecommendations(true)}
            disabled={loading}
            className="text-sm text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
          >
            {cached ? 'Rescan now' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-gray-500">Analyzing your spending...</p>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-600 text-sm p-4 rounded-lg">{error}</div>}

      {!loading && !error && (
        <>
          {totalSavings > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium">
                Potential savings: ${totalSavings.toFixed(0)}/month (${(totalSavings * 12).toFixed(0)}/year)
              </p>
            </div>
          )}

          <div className="space-y-4">
            {recs.map((rec, i) => (
              !dismissed.has(i) && (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {rec.emoji} {rec.title}
                        </h3>
                        {rec.difficulty && DIFFICULTY_BADGES[rec.difficulty] && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_BADGES[rec.difficulty].bg} ${DIFFICULTY_BADGES[rec.difficulty].text}`}>
                            {rec.difficulty}
                          </span>
                        )}
                        {rec.timeToComplete && (
                          <span className="text-[10px] text-gray-400 font-medium">{rec.timeToComplete}</span>
                        )}
                      </div>
                      <p className="text-gray-600 mt-2 text-sm leading-relaxed">{rec.detail}</p>

                      {/* Action steps */}
                      {rec.actionSteps && (
                        <div className="mt-3 bg-indigo-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-indigo-800 mb-1">How to do it:</p>
                          <p className="text-xs text-indigo-700 leading-relaxed">{rec.actionSteps}</p>
                        </div>
                      )}

                      {rec.potentialSavings > 0 && (
                        <p className="text-green-600 font-medium mt-2 text-sm">
                          Save ~${rec.potentialSavings.toFixed(0)}/month (${(rec.potentialSavings * 12).toFixed(0)}/year)
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => setDismissed(new Set([...dismissed, i]))}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => setDismissed(new Set([...dismissed, i]))}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      I'll work on it
                    </button>
                  </div>
                </div>
              )
            ))}
          </div>

          {dismissed.size === recs.length && recs.length > 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>All recommendations addressed!</p>
              <button onClick={() => loadRecommendations(true)} className="text-indigo-600 hover:underline mt-2 text-sm">
                Get fresh recommendations
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
