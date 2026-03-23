import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/client';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    api.get(`/auth/verify-email?token=${token}`)
      .then((res) => {
        setStatus('success');
        setMessage(res.data.message);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Verification failed');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-3xl font-bold text-indigo-600 mb-6">Runway</h1>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          {status === 'loading' && (
            <p className="text-gray-500">Verifying your email...</p>
          )}

          {status === 'success' && (
            <>
              <div className="text-green-500 text-4xl mb-3">&#10003;</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Email Verified</h2>
              <p className="text-gray-600 text-sm mb-4">{message}</p>
              <Link
                to="/login"
                className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
              >
                Go to Login
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="text-red-500 text-4xl mb-3">&#10007;</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Verification Failed</h2>
              <p className="text-gray-600 text-sm mb-4">{message}</p>
              <Link
                to="/login"
                className="inline-block text-indigo-600 hover:underline text-sm"
              >
                Back to Login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
