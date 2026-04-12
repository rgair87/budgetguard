import { Link } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';

interface UpgradeCardProps {
  feature: string;
  description: string;
  tierNeeded: 'plus' | 'pro';
}

const TIER_PRICES = { plus: '$7.99', pro: '$14.99' };
const TIER_COLORS = {
  plus: 'from-indigo-500 to-indigo-600',
  pro: 'from-violet-500 to-violet-600',
};

export default function UpgradeCard({ feature, description, tierNeeded }: UpgradeCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className={`shrink-0 p-2.5 rounded-xl bg-gradient-to-br ${TIER_COLORS[tierNeeded]} shadow-sm`}>
          <Lock className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{feature}</p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
          <Link
            to="/pricing"
            className={`inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-white bg-gradient-to-r ${TIER_COLORS[tierNeeded]} px-4 py-2 rounded-lg hover:opacity-90 transition-opacity`}
          >
            Get this for {TIER_PRICES[tierNeeded]}/mo <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
