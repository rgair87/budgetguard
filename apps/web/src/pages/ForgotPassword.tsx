import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import api from '../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <TrendingUp className="w-6 h-6 text-indigo-600" strokeWidth={2.25} />
          <h1 className="text-xl font-bold tracking-[0.15em] uppercase text-indigo-600">Spenditure</h1>
        </div>
        <p className="text-center text-gray-500 mb-8 text-sm">Reset your password</p>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
          {submitted ? (
            <>
              <div className="bg-green-50 text-green-700 text-sm p-3 rounded">
                If an account exists with that email, a reset link has been sent. Check your console for the link.
              </div>
              <Link
                to="/login"
                className="block text-center text-sm text-indigo-600 hover:underline"
              >
                Back to sign in
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Forgot password</h2>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{error}</div>
              )}

              <p className="text-sm text-gray-500">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Please wait...' : 'Send reset link'}
              </button>

              <p className="text-center text-sm text-gray-500">
                <Link to="/login" className="text-indigo-600 hover:underline">
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
