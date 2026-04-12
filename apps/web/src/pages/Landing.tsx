import { Link } from 'react-router-dom';
import {
  TrendingUp, Shield, BrainCircuit, CreditCard, Scissors,
  Phone, BarChart3, Target, MessageCircle, CheckCircle,
  ArrowRight, Sparkles, Zap,
} from 'lucide-react';

const FEATURES = [
  {
    icon: BarChart3,
    title: 'Financial Dashboard',
    desc: 'See exactly how many days your money will last at your current spending rate.',
    color: 'from-indigo-500 to-indigo-600',
  },
  {
    icon: BrainCircuit,
    title: 'AI Financial Advisor',
    desc: 'Get a personalized health score and actionable recommendations tailored to your accounts.',
    color: 'from-violet-500 to-violet-600',
  },
  {
    icon: Scissors,
    title: 'Cut Wasteful Spending',
    desc: 'AI finds subscriptions you forgot about and spending habits you can change.',
    color: 'from-rose-500 to-rose-600',
  },
  {
    icon: Phone,
    title: 'Bill Negotiation Scripts',
    desc: 'Get word-for-word scripts and phone numbers to lower your bills. 60% success rate.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: CreditCard,
    title: 'Smart Debt Payoff',
    desc: 'See which debt to attack first, how much interest you\'ll save, and when you\'ll be free.',
    color: 'from-amber-500 to-orange-500',
  },
  {
    icon: MessageCircle,
    title: 'Ask Anything',
    desc: '"Can I afford this?" "How much did I spend on food?" Get instant answers from your real data.',
    color: 'from-emerald-500 to-emerald-600',
  },
];

const STEPS = [
  { num: '1', title: 'Connect your bank', desc: 'Link in 2 minutes. We read transactions, never move money.' },
  { num: '2', title: 'AI analyzes everything', desc: 'Spending categorized, bills detected, patterns found — automatically.' },
  { num: '3', title: 'Get your game plan', desc: 'A personalized dashboard showing exactly where to save and what to cut.' },
];

const CHECKLIST = [
  '7-day free trial with full access',
  'No credit card required',
  'Bank-level security',
  'Cancel anytime, keep your data',
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-600" strokeWidth={2.25} />
            <span className="text-[15px] font-bold tracking-[0.15em] uppercase text-slate-900">Spenditure</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Sign in
            </Link>
            <Link to="/login?register=true" className="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors">
              Start free trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/20" />
        <div className="absolute top-20 right-20 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-20 w-72 h-72 bg-violet-200/20 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            AI-powered personal finance
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-[1.1] mb-6 max-w-3xl mx-auto">
            Take control of{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">every dollar</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Connect your bank and see exactly where your money goes.
            AI finds what to cut, what to negotiate, and how to make every paycheck last longer.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <Link
              to="/login?register=true"
              className="inline-flex items-center gap-2 text-base font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-500/25"
            >
              Start free trial <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-sm text-slate-500">No credit card required</p>
          </div>

          {/* Trust signals */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {CHECKLIST.map(item => (
              <div key={item} className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-slate-600">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">How it works</h2>
            <p className="text-slate-500">Set up in minutes. Insights in seconds.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {STEPS.map(step => (
              <div key={step.num} className="text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-lg font-bold flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/25">
                  {step.num}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Everything you need to master your money</h2>
            <p className="text-slate-500">Powered by AI. Built for real people.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 shadow-sm`}>
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">Simple pricing</h2>
          <p className="text-slate-500 mb-10">Start free. Upgrade when you're ready.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="rounded-2xl border-2 border-slate-200 p-6">
              <p className="text-sm font-bold text-slate-900">Free</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">$0</p>
              <p className="text-xs text-slate-500 mt-1">Basic dashboard + 5 AI chats/day</p>
            </div>
            <div className="rounded-2xl border-2 border-indigo-300 bg-indigo-50/30 p-6">
              <p className="text-sm font-bold text-slate-900">Plus</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">$7.99<span className="text-sm text-slate-500 font-normal">/mo</span></p>
              <p className="text-xs text-slate-500 mt-1">Bank sync + AI Advisor + trends</p>
            </div>
            <div className="rounded-2xl border-2 border-violet-300 bg-violet-50/30 p-6 relative">
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-violet-600 text-white px-3 py-0.5 rounded-full">
                Best value
              </span>
              <p className="text-sm font-bold text-slate-900">Pro</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">$14.99<span className="text-sm text-slate-500 font-normal">/mo</span></p>
              <p className="text-xs text-slate-500 mt-1">Cut This + Negotiate + unlimited AI</p>
            </div>
          </div>

          <Link
            to="/login?register=true"
            className="inline-flex items-center gap-2 mt-10 text-base font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-500/25"
          >
            Start your 7-day free trial <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-slate-950 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-indigo-400" strokeWidth={2.25} />
          <span className="text-sm font-bold tracking-[0.15em] uppercase text-slate-300">Spenditure</span>
        </div>
        <p className="text-xs text-slate-500 mb-4">Stop guessing, start knowing.</p>
        <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
          <Link to="/terms" className="hover:text-slate-300 transition-colors">Terms</Link>
          <Link to="/privacy" className="hover:text-slate-300 transition-colors">Privacy</Link>
          <Link to="/login" className="hover:text-slate-300 transition-colors">Sign in</Link>
        </div>
        <p className="text-xs text-slate-600 mt-6">&copy; {new Date().getFullYear()} Spenditure. All rights reserved.</p>
      </footer>
    </div>
  );
}
