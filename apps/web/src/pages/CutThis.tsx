import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Scissors,
  RefreshCw,
  TrendingDown,
  CreditCard,
  Repeat,
  Zap,
  ShoppingCart,
  Utensils,
  Car,
  Wifi,
  Home,
  Smartphone,
  CheckCircle2,
  Clock,
  X,
  ThumbsUp,
} from 'lucide-react';
import api from '../api/client';
import useTrack from '../hooks/useTrack';

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

/** Map common emoji patterns to Lucide icons */
function recIcon(emoji: string) {
  const iconMap: Record<string, React.ReactNode> = {
    '\u2702': <Scissors className="w-5 h-5" />,
    '\uD83D\uDCB3': <CreditCard className="w-5 h-5" />,
    '\uD83D\uDD01': <Repeat className="w-5 h-5" />,
    '\u26A1': <Zap className="w-5 h-5" />,
    '\uD83D\uDED2': <ShoppingCart className="w-5 h-5" />,
    '\uD83C\uDF54': <Utensils className="w-5 h-5" />,
    '\uD83D\uDE97': <Car className="w-5 h-5" />,
    '\uD83C\uDF10': <Wifi className="w-5 h-5" />,
    '\uD83C\uDFE0': <Home className="w-5 h-5" />,
    '\uD83D\uDCF1': <Smartphone className="w-5 h-5" />,
    '\uD83D\uDCB0': <TrendingDown className="w-5 h-5" />,
  };
  return iconMap[emoji] || <Scissors className="w-5 h-5" />;
}

export default function CutThis() {
  const track = useTrack('cut_this');
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
      {/* Gradient hero section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-600 via-pink-600 to-orange-500 p-6 text-white shadow-lg shadow-rose-500/25">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Scissors className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Cut This</h1>
              <p className="text-sm text-rose-100">
                AI-powered scan of your spending. 3 specific recommendations.
              </p>
            </div>
          </div>
          <div className="text-right">
            {cached && cachedAt && (
              <p className="text-xs text-rose-200 mb-1">Scanned {formatCacheAge(cachedAt)}</p>
            )}
            <button
              onClick={() => loadRecommendations(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 backdrop-blur-sm px-4 py-2 text-sm font-medium text-white hover:bg-white/30 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {cached ? 'Rescan now' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-gray-500">Analyzing your spending...</p>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-600 text-sm p-4 rounded-2xl border border-red-200/60">{error}</div>}

      {!loading && !error && (
        <>
          {totalSavings > 0 && (
            <div className="bg-emerald-50 border border-emerald-200/60 rounded-2xl p-4 shadow-sm flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                <TrendingDown className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="text-emerald-800 font-semibold">
                Potential savings: ${totalSavings.toFixed(0)}/month (${(totalSavings * 12).toFixed(0)}/year)
              </p>
            </div>
          )}

          <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Recommendations</p>

          <div className="space-y-4">
            {recs.map((rec, i) => (
              !dismissed.has(i) && (
                <div key={i} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                          {recIcon(rec.emoji)}
                        </div>
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {rec.title}
                        </h3>
                        {rec.difficulty && DIFFICULTY_BADGES[rec.difficulty] && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_BADGES[rec.difficulty].bg} ${DIFFICULTY_BADGES[rec.difficulty].text}`}>
                            {rec.difficulty}
                          </span>
                        )}
                        {rec.timeToComplete && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                            <Clock className="h-3 w-3" />
                            {rec.timeToComplete}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 mt-2 text-sm leading-relaxed">{rec.detail}</p>

                      {/* Action steps */}
                      {rec.actionSteps && (
                        <div className="mt-3 bg-indigo-50 rounded-xl p-3">
                          <p className="text-xs font-semibold text-indigo-800 mb-1">How to do it:</p>
                          <p className="text-xs text-indigo-700 leading-relaxed">{rec.actionSteps}</p>
                        </div>
                      )}

                      {rec.potentialSavings > 0 && (
                        <p className="text-emerald-600 font-medium mt-2 text-sm">
                          Save ~${rec.potentialSavings.toFixed(0)}/month (${(rec.potentialSavings * 12).toFixed(0)}/year)
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => setDismissed(new Set([...dismissed, i]))}
                      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
                    >
                      <X className="h-4 w-4" />
                      Dismiss
                    </button>
                    <Link
                      to="/subscriptions"
                      onClick={() => track('cut_this', 'cut_subscription')}
                      className="inline-flex items-center gap-1.5 text-sm bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-1.5 rounded-xl font-medium shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-indigo-800 transition"
                    >
                      <ThumbsUp className="h-4 w-4" />
                      View in Recurring
                    </Link>
                  </div>
                </div>
              )
            ))}
          </div>

          {dismissed.size === recs.length && recs.length > 0 && (
            <div className="text-center py-8">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-emerald-100 mb-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-gray-500">All recommendations addressed!</p>
              <button
                onClick={() => loadRecommendations(true)}
                className="inline-flex items-center gap-1.5 mt-3 text-sm bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-2 rounded-xl font-medium shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-indigo-800 transition"
              >
                <RefreshCw className="h-4 w-4" />
                Get fresh recommendations
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
