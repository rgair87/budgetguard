import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { api } from '../lib/api';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post<{ user: any; accessToken: string; refreshToken: string }>('/auth/login', {
        email,
        password,
      });
      const data = response.data!;
      login(
        { accessToken: data.accessToken, refreshToken: data.refreshToken, expiresIn: 3600 },
        data.user,
      );
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel - hidden on mobile */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 text-white flex-col justify-center px-16 py-12">
        <div className="max-w-lg">
          {/* Logo and brand */}
          <div className="flex items-center gap-3 mb-12">
            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.67-3.13 9.06-7 10.2-3.87-1.14-7-5.53-7-10.2V6.3l7-3.12z" />
              <path d="M12 7a3 3 0 100 6 3 3 0 000-6zm0 1.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" opacity=".6" />
            </svg>
            <span className="text-3xl font-bold">BudgetGuard</span>
          </div>

          <h2 className="text-2xl font-semibold mb-2">Take control of your finances.</h2>
          <p className="text-primary-100 mb-12 text-lg">Smart tools powered by AI to help you save more and spend wisely.</p>

          {/* Feature highlights */}
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-0.5 h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 2a5 5 0 00-3 9v2a1 1 0 001 1h4a1 1 0 001-1v-2a5 5 0 00-3-9zM8 16h4m-3 2h2" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">AI-Powered Budgets</h3>
                <p className="text-primary-100 text-sm mt-1">Intelligent budget recommendations that learn from your spending patterns and adapt over time.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-0.5 h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h1.977v.652a7 7 0 01-13.818 1.795M2 9.348h1.977m0 0A7 7 0 0116.023 9.348M3.977 9.348V7m12.046 2.348V7M7.5 13.5l2.5-3 2.5 3" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Subscription Detection</h3>
                <p className="text-primary-100 text-sm mt-1">Automatically find and track recurring charges so you never pay for something you forgot about.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-0.5 h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h4v6H3V3zm0 8h4v6H3v-6zm6-8h4v4H9V3zm0 6h4v8H9V9zm6-6h2v10h-2V3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Smart Savings Tips</h3>
                <p className="text-primary-100 text-sm mt-1">Personalized suggestions to reduce expenses and grow your savings effortlessly.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-white px-4 py-12">
        <div className="w-full max-w-md">
          {/* Mobile-only logo */}
          <div className="text-center mb-8 lg:hidden">
            <div className="flex items-center justify-center gap-2 mb-2">
              <svg className="w-8 h-8 text-primary-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.67-3.13 9.06-7 10.2-3.87-1.14-7-5.53-7-10.2V6.3l7-3.12z" />
                <path d="M12 7a3 3 0 100 6 3 3 0 000-6zm0 1.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" opacity=".6" />
              </svg>
              <h1 className="text-3xl font-bold text-primary-600">BudgetGuard</h1>
            </div>
            <p className="text-gray-500 mt-2">Smart AI-powered finance management</p>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-gray-500 mt-1">Sign in to your account to continue</p>
          </div>

          <div className="card rounded-2xl shadow-card-lg lg:shadow-none lg:rounded-none lg:p-0 lg:border-0 lg:bg-transparent">
            <h2 className="text-xl font-semibold mb-6 lg:hidden">Sign in to your account</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="label">Email</label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="label">Password</label>
                <input
                  id="password"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>

              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-gray-500">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
