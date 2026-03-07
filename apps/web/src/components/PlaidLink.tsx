import { useState, useCallback, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { api } from '../lib/api';

interface PlaidLinkProps {
  onSuccess: () => void;
  children?: React.ReactNode;
}

export function PlaidLinkButton({ onSuccess, children }: PlaidLinkProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createLinkToken = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post<{ linkToken: string; expiration: string }>('/plaid/create-link-token');
      setLinkToken(res.data!.linkToken);
    } catch (err) {
      setError('Failed to initialize Plaid Link');
      setIsLoading(false);
    }
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      try {
        await api.post('/plaid/exchange-token', {
          public_token: publicToken,
          metadata: {
            institution: metadata.institution,
            accounts: metadata.accounts,
          },
        });
        onSuccess();
      } catch (err) {
        setError('Failed to link account');
      }
    },
    onExit: () => {
      setLinkToken(null);
      setIsLoading(false);
    },
  });

  // Auto-open when link token is ready
  useEffect(() => {
    if (linkToken && ready) {
      open();
      setIsLoading(false);
    }
  }, [linkToken, ready, open]);

  return (
    <>
      <button
        className="btn-primary"
        onClick={createLinkToken}
        disabled={isLoading}
      >
        {isLoading ? 'Connecting...' : children || 'Link New Account'}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </>
  );
}
