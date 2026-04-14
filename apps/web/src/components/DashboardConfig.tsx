import { X, GripVertical, RotateCcw } from 'lucide-react';
import type { DashboardCard } from '../hooks/useDashboardConfig';

interface Props {
  cards: DashboardCard[];
  onToggle: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onReset: () => void;
  onClose: () => void;
}

export default function DashboardConfig({ cards, onToggle, onMove, onReset, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Customize Dashboard</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 max-h-[400px] overflow-y-auto">
          <p className="text-xs text-slate-400 mb-3">Toggle sections on or off. Drag to reorder.</p>
          <div className="space-y-1">
            {cards.map((card, i) => (
              <div
                key={card.id}
                className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-slate-50 transition-colors group"
              >
                {/* Drag handle */}
                <div className="flex flex-col gap-0.5 cursor-grab active:cursor-grabbing text-slate-300 group-hover:text-slate-400">
                  <button
                    onClick={() => i > 0 && onMove(i, i - 1)}
                    disabled={i === 0}
                    className="text-[10px] text-slate-300 hover:text-slate-600 disabled:opacity-20"
                    aria-label="Move up"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => i < cards.length - 1 && onMove(i, i + 1)}
                    disabled={i === cards.length - 1}
                    className="text-[10px] text-slate-300 hover:text-slate-600 disabled:opacity-20"
                    aria-label="Move down"
                  >
                    ▼
                  </button>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => onToggle(card.id)}
                  className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${
                    card.visible ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    card.visible ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>

                {/* Label */}
                <span className={`text-sm flex-1 ${card.visible ? 'text-slate-800' : 'text-slate-400'}`}>
                  {card.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
          <button onClick={onReset} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors">
            <RotateCcw className="w-3 h-3" /> Reset to default
          </button>
          <button onClick={onClose} className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
