import { useEffect, useState } from 'react';
import { Zap, Flame, Droplets, Fuel, ShoppingBag, CreditCard, Lightbulb, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api/client';

interface SmartTip {
  id: string;
  title: string;
  body: string;
  category: string;
  merchantName: string;
  icon: string;
}

const ICON_MAP: Record<string, { icon: React.ElementType; bg: string; color: string }> = {
  electric: { icon: Zap, bg: 'bg-amber-100', color: 'text-amber-600' },
  gas: { icon: Flame, bg: 'bg-orange-100', color: 'text-orange-600' },
  water: { icon: Droplets, bg: 'bg-blue-100', color: 'text-blue-600' },
  fuel: { icon: Fuel, bg: 'bg-slate-100', color: 'text-slate-600' },
  food: { icon: ShoppingBag, bg: 'bg-emerald-100', color: 'text-emerald-600' },
  shopping: { icon: ShoppingBag, bg: 'bg-violet-100', color: 'text-violet-600' },
  debt: { icon: CreditCard, bg: 'bg-red-100', color: 'text-red-600' },
  general: { icon: Lightbulb, bg: 'bg-indigo-100', color: 'text-indigo-600' },
};

export default function SmartTips() {
  const [tips, setTips] = useState<SmartTip[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/runway/smart-tips')
      .then(r => setTips(r.data.tips || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || tips.length === 0) return null;

  const tip = tips[current];
  const iconConfig = ICON_MAP[tip.icon] || ICON_MAP.general;
  const Icon = iconConfig.icon;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl ${iconConfig.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${iconConfig.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800">{tip.title}</p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{tip.body}</p>
        </div>
      </div>

      {tips.length > 1 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <button
            onClick={() => setCurrent(c => (c - 1 + tips.length) % tips.length)}
            className="text-slate-300 hover:text-slate-500 transition-colors"
            aria-label="Previous tip"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex gap-1.5">
            {tips.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === current ? 'bg-indigo-500' : 'bg-slate-200'}`} />
            ))}
          </div>
          <button
            onClick={() => setCurrent(c => (c + 1) % tips.length)}
            className="text-slate-300 hover:text-slate-500 transition-colors"
            aria-label="Next tip"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
