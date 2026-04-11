import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, Crown, Zap, Shield, BrainCircuit, CreditCard,
  Phone, Scissors, MessageCircle, Calendar, Target,
  Download, Users, BarChart3, Wallet,
} from 'lucide-react';
import api from '../api/client';
import useTrack from '../hooks/useTrack';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'after trial',
    desc: 'Basic dashboard and tracking',
    color: 'border-slate-200 bg-white',
    buttonClass: 'bg-slate-200 text-slate-500 cursor-default',
    buttonText: 'Current after trial',
    tier: 'free',
    features: [
      { text: 'Runway dashboard', icon: Shield, included: true },
      { text: 'View transactions', icon: Wallet, included: true },
      { text: '1-month calendar', icon: Calendar, included: true },
      { text: '5 chat messages/day', icon: MessageCircle, included: true },
      { text: '1 savings goal', icon: Target, included: true },
      { text: 'Bank sync', icon: CreditCard, included: false },
      { text: 'AI Advisor', icon: BrainCircuit, included: false },
      { text: 'Cut This & Negotiate', icon: Scissors, included: false },
    ],
  },
  {
    name: 'Plus',
    price: '$7.99',
    period: '/month',
    desc: 'Bank sync + AI insights',
    color: 'border-indigo-300 bg-indigo-50/30',
    buttonClass: 'bg-indigo-600 text-white hover:bg-indigo-700',
    buttonText: 'Subscribe to Plus',
    tier: 'plus',
    features: [
      { text: 'Everything in Free', icon: Check, included: true },
      { text: 'Bank sync (Teller)', icon: CreditCard, included: true },
      { text: 'AI Advisor (1x/month)', icon: BrainCircuit, included: true },
      { text: '15 chat messages/day', icon: MessageCircle, included: true },
      { text: '5 savings goals', icon: Target, included: true },
      { text: '3-month calendar', icon: Calendar, included: true },
      { text: 'CSV export', icon: Download, included: true },
      { text: 'Full spending trends', icon: BarChart3, included: true },
    ],
  },
  {
    name: 'Pro',
    price: '$14.99',
    period: '/month',
    desc: 'Unlimited AI + premium tools',
    color: 'border-violet-300 bg-violet-50/30',
    buttonClass: 'bg-violet-600 text-white hover:bg-violet-700',
    buttonText: 'Subscribe to Pro',
    tier: 'pro',
    badge: 'Best value',
    features: [
      { text: 'Everything in Plus', icon: Check, included: true },
      { text: 'Unlimited AI Advisor', icon: BrainCircuit, included: true },
      { text: '50 chat messages/day', icon: MessageCircle, included: true },
      { text: 'Cut This recommendations', icon: Scissors, included: true },
      { text: 'Bill negotiation scripts', icon: Phone, included: true },
      { text: 'Unlimited savings goals', icon: Target, included: true },
      { text: '6-month calendar', icon: Calendar, included: true },
      { text: 'Family accounts', icon: Users, included: true },
    ],
  },
];

export default function Pricing() {
  const track = useTrack('pricing');
  const [subscribing, setSubscribing] = useState<string | null>(null);

  async function handleSubscribe(tier: string) {
    setSubscribing(tier);
    try {
      const { data } = await api.post('/stripe/create-checkout', { tier });
      if (data.url) {
        window.location.href = data.url;
      } else {
        await api.post('/settings/upgrade', { tier });
        window.location.reload();
      }
    } catch {
      await api.post('/settings/upgrade', { tier });
      window.location.reload();
    }
    setSubscribing(null);
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
          <Zap className="w-3.5 h-3.5" />
          Choose your plan
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Plans that grow with your finances</h1>
        <p className="text-slate-500 text-sm max-w-md mx-auto">Start with a 7-day free trial of Pro. No credit card required. Downgrade or cancel anytime.</p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map(plan => (
          <div key={plan.name} className={`rounded-2xl border-2 p-6 relative ${plan.color}`}>
            {plan.badge && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-violet-600 text-white px-3 py-0.5 rounded-full">
                {plan.badge}
              </span>
            )}
            <div className="mb-5">
              <p className="text-sm font-bold text-slate-900">{plan.name}</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                <span className="text-sm text-slate-400">{plan.period}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{plan.desc}</p>
            </div>

            <div className="space-y-2.5 mb-6">
              {plan.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  {f.included ? (
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                  )}
                  <span className={`text-xs ${f.included ? 'text-slate-700' : 'text-slate-400'}`}>{f.text}</span>
                </div>
              ))}
            </div>

            {plan.tier === 'free' ? (
              <div className="w-full text-center text-xs text-slate-400 py-2.5">
                Available after trial ends
              </div>
            ) : (
              <button
                onClick={() => handleSubscribe(plan.tier)}
                disabled={subscribing === plan.tier}
                className={`w-full text-sm py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50 ${plan.buttonClass}`}
              >
                {subscribing === plan.tier ? 'Redirecting...' : plan.buttonText}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="mt-12 text-center">
        <p className="text-xs text-slate-400">
          Questions? <Link to="/chat" className="text-indigo-500 hover:underline">Ask the AI assistant</Link> or email support.
        </p>
      </div>
    </div>
  );
}
