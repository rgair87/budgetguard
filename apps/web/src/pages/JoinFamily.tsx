import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function JoinFamily() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || localStorage.getItem('pending_family_token');
  const { token: authToken, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'login_required'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!token) {
      setStatus('error');
      setMessage('Invalid invite link. No token found.');
      return;
    }

    if (!authToken) {
      // Save the token so it survives login/register
      localStorage.setItem('pending_family_token', token);
      setStatus('login_required');
      return;
    }

    // Logged in — accept the invite
    api.post('/family/accept', { token })
      .then(r => {
        localStorage.removeItem('pending_family_token');
        setStatus('success');
        setMessage(r.data.message || 'You have joined the family plan!');
      })
      .catch(err => {
        localStorage.removeItem('pending_family_token');
        setStatus('error');
        setMessage(err.response?.data?.message || 'This invite may have expired or already been used.');
      });
  }, [token, authToken, authLoading]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <TrendingUp className="w-5 h-5 text-indigo-600" strokeWidth={2.25} />
          <span className="text-[14px] font-bold tracking-[0.15em] uppercase text-slate-900">Spenditure</span>
        </div>

        {status === 'loading' && (
          <div>
            <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-slate-500">Joining family plan...</p>
          </div>
        )}

        {status === 'login_required' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Sign in to join</h2>
            <p className="text-sm text-slate-500 mb-4">
              Create a free account and you'll automatically join the family plan.
            </p>
            <Link
              to="/login?register=true"
              className="inline-flex items-center gap-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 rounded-lg transition-colors"
            >
              Create account
            </Link>
            <p className="text-xs text-slate-400 mt-3">
              Already have an account? <Link to="/login" className="text-indigo-600">Sign in</Link>
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">You're in!</h2>
            <p className="text-sm text-slate-500 mb-4">{message}</p>
            <Link to="/family" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
              Go to Family page
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Could not join</h2>
            <p className="text-sm text-slate-500 mb-4">{message}</p>
            <Link to="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
              Go to Home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
