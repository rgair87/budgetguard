import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import api from '../api/client';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded">
              Invalid reset link. No token provided.
            </div>
            <Link to="/login" className="block text-center text-sm text-indigo-600 hover:underline">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <TrendingUp className="w-6 h-6 text-indigo-600" strokeWidth={2.25} />
          <h1 className="text-xl font-bold tracking-[0.15em] uppercase text-indigo-600">Spenditure</h1>
        </div>
        <p className="text-center text-gray-500 mb-8 text-sm">Set a new password</p>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
          {success ? (
            <>
              <div className="bg-green-50 text-green-700 text-sm p-3 rounded">
                Password reset successfully! Redirecting to sign in...
              </div>
              <Link to="/login" className="block text-center text-sm text-indigo-600 hover:underline">
                Go to sign in now
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Reset password</h2>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Min 8 characters"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Please wait...' : 'Reset password'}
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
