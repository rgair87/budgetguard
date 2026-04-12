import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, Crown, Zap, Shield, BrainCircuit, CreditCard,
  Phone, Scissors, MessageCircle, Calendar, Target,
  Download, Users, BarChart3, Wallet,
} from 'lucide-react';
import api from '../api/client';
import useTrack from '../hooks/useTrack';

const FEATURES = {
  free: [
    { text: 'Spenditure dashboard', icon: Shield, included: true },
    { text: 'View transactions', icon: Wallet, included: true },
    { text: '1-month calendar', icon: Calendar, included: true },
    { text: '5 chat messages/day', icon: MessageCircle, included: true },
    { text: '1 savings goal', icon: Target, included: true },
    { text: 'Bank sync', icon: CreditCard, included: false },
    { text: 'AI Advisor', icon: BrainCircuit, included: false },
    { text: 'Cut This & Negotiate', icon: Scissors, included: false },
  ],
  plus: [
    { text: 'Everything in Free', icon: Check, included: true },
    { text: 'Bank sync (Teller)', icon: CreditCard, included: true },
    { text: 'AI Advisor (1x/month)', icon: BrainCircuit, included: true },
    { text: '15 chat messages/day', icon: MessageCircle, included: true },
    { text: '5 savings goals', icon: Target, included: true },
    { text: '3-month calendar', icon: Calendar, included: true },
    { text: 'CSV export', icon: Download, included: true },
    { text: 'Full spending trends', icon: BarChart3, included: true },
  ],
  pro: [
    { text: 'Everything in Plus', icon: Check, included: true },
    { text: 'Unlimited AI Advisor', icon: BrainCircuit, included: true },
    { text: '50 chat messages/day', icon: MessageCircle, included: true },
    { text: 'Cut This recommendations', icon: Scissors, included: true },
    { text: 'Bill negotiation scripts', icon: Phone, included: true },
    { text: 'Unlimited savings goals', icon: Target, included: true },
    { text: '6-month calendar', icon: Calendar, included: true },
    { text: 'Family accounts', icon: Users, included: true },
  ],
};

const PRICING = {
  month: { plus: '$7.99', pro: '$14.99' },
  year: { plus: '$4.99', pro: '$8.33' },
  yearTotal: { plus: '$59.99', pro: '$99.99' },
  yearSavings: { plus: 'Save $36', pro: 'Save $80' },
  yearPercent: { plus: '37', pro: '44' },
};

export default function Pricing() {
  const track = useTrack('pricing');
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [interval, setInterval] = useState<'month' | 'year'>('month');

  async function handleSubscribe(tier: string) {
    setSubscribing(tier);
    try {
      const { data } = await api.post('/stripe/create-checkout', { tier, interval });
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {}
    setSubscribing(null);
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
          <Zap className="w-3.5 h-3.5" />
          Choose your plan
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Plans that grow with your finances</h1>
        <p className="text-slate-500 text-sm max-w-md mx-auto">Start with a 7-day free trial of Pro. No credit card required. Downgrade or cancel anytime.</p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <button
          onClick={() => setInterval('month')}
          className={`text-sm font-medium px-4 py-2 rounded-lg transition-all ${
            interval === 'month'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setInterval('year')}
          className={`text-sm font-medium px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
            interval === 'year'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Annual
          <span className="text-[10px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">
            Save up to 44%
          </span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Free */}
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 relative">
          <div className="mb-5">
            <p className="text-sm font-bold text-slate-900">Free</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-bold text-slate-900">$0</span>
              <span className="text-sm text-slate-500">after trial</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Basic dashboard and tracking</p>
          </div>
          <div className="space-y-2.5 mb-6">
            {FEATURES.free.map((f, i) => (
              <div key={i} className="flex items-center gap-2.5">
                {f.included ? (
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                )}
                <span className={`text-xs ${f.included ? 'text-slate-700' : 'text-slate-500'}`}>{f.text}</span>
              </div>
            ))}
          </div>
          <div className="w-full text-center text-xs text-slate-500 py-2.5">
            Available after trial ends
          </div>
        </div>

        {/* Plus */}
        <div className="rounded-2xl border-2 border-indigo-300 bg-indigo-50/30 p-6 relative">
          <div className="mb-5">
            <p className="text-sm font-bold text-slate-900">Plus</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-bold text-slate-900">
                {interval === 'month' ? PRICING.month.plus : PRICING.year.plus}
              </span>
              <span className="text-sm text-slate-500">/month</span>
            </div>
            {interval === 'year' ? (
              <p className="text-xs text-emerald-600 font-semibold mt-1">
                {PRICING.yearTotal.plus}/year ({PRICING.yearSavings.plus})
              </p>
            ) : (
              <p className="text-xs text-slate-500 mt-1">Bank sync, advisor, trends</p>
            )}
          </div>
          <div className="space-y-2.5 mb-6">
            {FEATURES.plus.map((f, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-xs text-slate-700">{f.text}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => handleSubscribe('plus')}
            disabled={subscribing === 'plus'}
            className="w-full text-sm py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50 bg-indigo-600 text-white hover:bg-indigo-700"
          >
            {subscribing === 'plus' ? 'Redirecting...' : 'Subscribe to Plus'}
          </button>
        </div>

        {/* Pro */}
        <div className="rounded-2xl border-2 border-violet-300 bg-violet-50/30 p-6 relative">
          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-violet-600 text-white px-3 py-0.5 rounded-full">
            Best value
          </span>
          <div className="mb-5">
            <p className="text-sm font-bold text-slate-900">Pro</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-bold text-slate-900">
                {interval === 'month' ? PRICING.month.pro : PRICING.year.pro}
              </span>
              <span className="text-sm text-slate-500">/month</span>
            </div>
            {interval === 'year' ? (
              <p className="text-xs text-emerald-600 font-semibold mt-1">
                {PRICING.yearTotal.pro}/year ({PRICING.yearSavings.pro})
              </p>
            ) : (
              <p className="text-xs text-slate-500 mt-1">Everything, plus cuts and negotiation</p>
            )}
          </div>
          <div className="space-y-2.5 mb-6">
            {FEATURES.pro.map((f, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-xs text-slate-700">{f.text}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => handleSubscribe('pro')}
            disabled={subscribing === 'pro'}
            className="w-full text-sm py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50 bg-violet-600 text-white hover:bg-violet-700"
          >
            {subscribing === 'pro' ? 'Redirecting...' : 'Subscribe to Pro'}
          </button>
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-12 text-center">
        <p className="text-xs text-slate-500">
          Questions? <Link to="/chat" className="text-indigo-500 hover:underline">Ask the AI assistant</Link> or email support.
        </p>
      </div>
    </div>
  );
}
