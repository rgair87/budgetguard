import { useEffect, useRef, useState } from 'react';
import { X, Heart, ArrowRight } from 'lucide-react';
import api from '../api/client';

interface CancelSaveModalProps {
  tier: 'plus' | 'pro';
  onContinue: () => void;
  onClose: () => void;
}

export default function CancelSaveModal({ tier, onContinue, onClose }: CancelSaveModalProps) {
  const [stats, setStats] = useState<{ transactions: number; categories: number; memberSince: string } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/settings').then(r => {
      const user = r.data.user;
      const since = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
      setStats({ transactions: 0, categories: 0, memberSince: since });
    }).catch(() => {});

    api.get('/transactions?limit=1').then(r => {
      const total = r.data.total || 0;
      setStats(prev => prev ? { ...prev, transactions: total } : prev);
    }).catch(() => {});
  }, []);

  // Escape key closes modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = modal.querySelectorAll<HTMLElement>('button, a, input, [tabindex]:not([tabindex="-1"])');
    if (focusable.length > 0) focusable[0].focus();

    function onTab(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !modal) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onTab);
    return () => window.removeEventListener('keydown', onTab);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} role="presentation">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-modal-title"
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Heart className="w-5 h-5 text-white" />
            <h2 id="cancel-modal-title" className="text-lg font-semibold text-white">Before you go...</h2>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {stats && (
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <p className="text-sm font-medium text-slate-700">Since {stats.memberSince}, you've:</p>
              <ul className="text-sm text-slate-600 space-y-1.5">
                {stats.transactions > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
                    Tracked {stats.transactions.toLocaleString()} transactions
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                  Built a complete picture of your finances
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                  Received personalized spending insights
                </li>
              </ul>
            </div>
          )}

          {tier === 'pro' && (
            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
              <p className="text-sm font-semibold text-indigo-900">Need a lower price?</p>
              <p className="text-xs text-indigo-700 mt-1">Switch to Plus at $7.99/mo. Keep bank sync, advisor, and trends.</p>
              <a href="/pricing" className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors">
                Switch to Plus <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          )}

          <p className="text-xs text-slate-400 text-center">
            If you cancel, you'll keep access until the end of your billing period.
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between gap-3">
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
            Never mind
          </button>
          <button
            onClick={onContinue}
            className="text-sm text-slate-600 hover:text-slate-800 underline underline-offset-2 transition-colors"
          >
            Continue to billing portal
          </button>
        </div>
      </div>
    </div>
  );
}
