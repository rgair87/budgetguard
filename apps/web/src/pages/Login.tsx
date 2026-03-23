import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, ArrowRight, Shield, TrendingDown, Calculator } from 'lucide-react';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
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
      if (isRegister) {
        await register(email, password);
        setRegistered(true);
        navigate('/onboarding');
      } else {
        await login(email, password);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-700/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-slate-700/20 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-20 w-full">
          <h1 className="text-5xl font-bold text-white tracking-tight mb-4">Runway</h1>
          <p className="text-indigo-200 text-lg leading-relaxed mb-12 max-w-md">
            The finance app that plans around your real life — not the other way around.
          </p>

          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Bank-level security</h3>
                <p className="text-indigo-300 text-sm leading-relaxed">
                  256-bit encryption and read-only bank connections keep your data safe.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Cut wasteful spending</h3>
                <p className="text-indigo-300 text-sm leading-relaxed">
                  AI finds subscriptions you forgot about and bills you can negotiate down.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">
                <Calculator className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Know your runway</h3>
                <p className="text-indigo-300 text-sm leading-relaxed">
                  See exactly how many days your money will last with smart forecasting.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center bg-gray-50 px-6 py-12">
        {/* Mobile-only brand header */}
        <div className="lg:hidden text-center mb-10">
          <h1 className="text-3xl font-bold text-indigo-600 tracking-tight">Runway</h1>
          <p className="text-gray-500 text-sm mt-1">Finance that fits your life</p>
        </div>

        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              {isRegister ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="text-gray-500 text-sm mb-8">
              {isRegister
                ? 'Start taking control of your finances today.'
                : 'Sign in to pick up where you left off.'}
            </p>

            {error && (
              <div className="mb-6 flex items-center gap-3 bg-red-50 text-red-600 text-sm p-4 rounded-xl">
                <div className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full" />
                {error}
              </div>
            )}

            {registered && !error && (
              <div className="mb-6 flex items-center gap-3 bg-green-50 text-green-700 text-sm p-4 rounded-xl">
                <div className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full" />
                Account created! Check the server console for your verification link.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full bg-gray-50 rounded-xl pl-12 pr-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder={isRegister ? 'Min 8 characters' : 'Enter your password'}
                    className="w-full bg-gray-50 rounded-xl pl-12 pr-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {!isRegister && (
                <div className="text-right">
                  <Link
                    to="/forgot-password"
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-3.5 rounded-xl text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25"
              >
                {loading ? (
                  <span>Please wait...</span>
                ) : (
                  <>
                    {isRegister ? 'Create account' : 'Sign in'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setError('');
                  }}
                  className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors"
                >
                  {isRegister ? 'Sign in' : 'Create one'}
                </button>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6 leading-relaxed">
            By signing in, you agree to our{' '}
            <Link to="/terms" className="text-indigo-500 hover:text-indigo-600 underline underline-offset-2">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-indigo-500 hover:text-indigo-600 underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
