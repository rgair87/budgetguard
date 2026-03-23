import { useCallback, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import api from '../api/client';

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
}

export default function PlaidLinkButton({ onSuccess }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  const getLinkToken = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/plaid/create-link-token');
      setLinkToken(data.link_token);
    } catch (err) {
      console.error('Failed to create link token:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken) => {
      try {
        await api.post('/plaid/exchange-token', { public_token: publicToken });
        setConnected(true);
        onSuccess?.();
      } catch (err) {
        console.error('Failed to exchange token:', err);
      }
    },
  });

  if (connected) {
    return (
      <div className="flex items-center gap-2 text-green-600 font-medium">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Bank connected
      </div>
    );
  }

  if (!linkToken) {
    return (
      <button
        onClick={getLinkToken}
        disabled={loading}
        className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Preparing...' : 'Connect your bank'}
      </button>
    );
  }

  return (
    <button
      onClick={() => open()}
      disabled={!ready}
      className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
    >
      {ready ? 'Open Plaid Link' : 'Loading...'}
    </button>
  );
}
