import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Mail, Lock, ArrowRight, Shield, TrendingDown, Calculator,
  Zap, Clock, BrainCircuit, CreditCard, Target, BarChart3,
  CheckCircle, TrendingUp,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Clock,
    title: 'Know your runway',
    desc: 'See how many days your money will last at your current pace.',
  },
  {
    icon: BrainCircuit,
    title: 'Personal advisor',
    desc: 'Get personalized insights that actually make sense for your situation.',
  },
  {
    icon: TrendingDown,
    title: 'Cut wasteful spending',
    desc: 'Find subscriptions you forgot about and bills you can negotiate down.',
  },
  {
    icon: CreditCard,
    title: 'Smart debt payoff',
    desc: 'See exactly which debt to attack first and how much you\'ll save.',
  },
];

const CHECKLIST = [
  '7-day free trial, full access, no card required',
  'Connect your bank in 2 minutes',
  'AI analyzes your spending automatically',
  'Cancel anytime, keep your data',
];

export default function Login() {
  const params = new URLSearchParams(window.location.search);
  const [isRegister, setIsRegister] = useState(params.get('register') === 'true');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const pendingFamily = localStorage.getItem('pending_family_token');
      if (isRegister) {
        await register(email, password);
        setRegistered(true);
        navigate(pendingFamily ? '/join-family' : '/onboarding');
      } else {
        await login(email, password);
        navigate(pendingFamily ? '/join-family' : '/');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-400/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-20 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-8 h-8 text-indigo-400" strokeWidth={2.25} />
            <h1 className="text-2xl font-bold tracking-[0.15em] uppercase text-white">Spenditure</h1>
          </div>
          <p className="text-xs tracking-[0.2em] uppercase text-indigo-300/70 mb-8 ml-11">Stop guessing, start knowing</p>

          {/* Headline */}
          <h2 className="text-4xl xl:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
            Take control of<br />
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">every dollar</span>
          </h2>
          <p className="text-slate-300 text-lg leading-relaxed mb-12 max-w-lg">
            Connect your bank and see exactly where your money goes. Then make it go further.
          </p>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-5 mb-12">
            {FEATURES.map(f => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/[0.08] flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold mb-0.5">{f.title}</p>
                  <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'].map((c, i) => (
                <div key={i} className={`w-8 h-8 rounded-full ${c} border-2 border-slate-900 flex items-center justify-center text-white text-[10px] font-bold`}>
                  {['RG', 'JT', 'KM', 'AL'][i]}
                </div>
              ))}
            </div>
            <p className="text-slate-500 text-sm">
              Trusted by <span className="text-slate-300 font-medium">people who want to stop worrying about money</span>
            </p>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="w-full lg:w-[45%] flex flex-col items-center justify-center bg-white px-6 py-12">
        {/* Mobile-only brand header */}
        <div className="lg:hidden text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-1">
            <TrendingUp className="w-6 h-6 text-indigo-600" strokeWidth={2.25} />
            <h1 className="text-xl font-bold tracking-[0.15em] uppercase text-slate-900">Spenditure</h1>
          </div>
          <p className="text-[10px] tracking-[0.2em] uppercase text-slate-400">Stop guessing, start knowing</p>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">
              {isRegister ? 'Start your free trial' : 'Welcome back'}
            </h2>
            <p className="text-slate-500 text-sm">
              {isRegister
                ? '7 days free. No credit card required.'
                : 'Sign in to your Spenditure account.'}
            </p>
          </div>

          {/* Trial checklist (register only) */}
          {isRegister && (
            <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="space-y-2">
                {CHECKLIST.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-xs text-emerald-800">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-5 flex items-center gap-3 bg-red-50 text-red-600 text-sm p-4 rounded-xl border border-red-200">
              <div className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full" />
              {error}
            </div>
          )}

          {registered && !error && (
            <div className="mb-5 flex items-center gap-3 bg-emerald-50 text-emerald-700 text-sm p-4 rounded-xl border border-emerald-200">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Account created! Setting up your dashboard...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full bg-slate-50 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white border border-slate-200 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder={isRegister ? 'Min 8 characters' : 'Enter your password'}
                  className="w-full bg-slate-50 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white border border-slate-200 transition-all"
                />
              </div>
            </div>

            {!isRegister && (
              <div className="text-right">
                <Link to="/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  Forgot password?
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25"
            >
              {loading ? (
                <span>Please wait...</span>
              ) : (
                <>
                  {isRegister ? 'Start free trial' : 'Sign in'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => { setIsRegister(!isRegister); setError(''); }}
                className="text-indigo-600 hover:text-indigo-700 font-semibold"
              >
                {isRegister ? 'Sign in' : 'Start free trial'}
              </button>
            </p>
          </div>

          <p className="text-center text-[11px] text-slate-400 mt-6 leading-relaxed">
            By signing up, you agree to our{' '}
            <Link to="/terms" className="text-indigo-500 hover:underline">Terms</Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-indigo-500 hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
