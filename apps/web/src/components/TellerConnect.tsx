import { useCallback, useEffect, useRef, useState } from 'react';
import { Landmark, CheckCircle2, Loader2 } from 'lucide-react';
import api from '../api/client';

// Teller Connect application ID
const TELLER_APP_ID = 'app_pq8bujpq2bv1virlra000';
const TELLER_ENV = 'development'; // 'sandbox' | 'development' | 'production'

interface TellerConnectButtonProps {
  onSuccess?: () => void;
  className?: string;
}

declare global {
  interface Window {
    TellerConnect?: {
      setup: (config: {
        applicationId: string;
        environment: string;
        onSuccess: (enrollment: { accessToken: string; enrollment: { id: string; institution: { name: string } } }) => void;
        onExit?: () => void;
        onFailure?: (error: { message: string }) => void;
      }) => { open: () => void };
    };
  }
}

export default function TellerConnectButton({ onSuccess, className }: TellerConnectButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'connecting' | 'syncing' | 'done' | 'pending' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [bankName, setBankName] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const scriptLoaded = useRef(false);

  // Load Teller Connect script
  useEffect(() => {
    if (scriptLoaded.current || document.getElementById('teller-connect-script')) return;
    scriptLoaded.current = true;

    const script = document.createElement('script');
    script.id = 'teller-connect-script';
    script.src = 'https://cdn.teller.io/connect/connect.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const handleConnect = useCallback(() => {
    if (!window.TellerConnect) {
      setErrorMsg('Teller Connect is still loading. Please try again in a moment.');
      setStatus('error');
      return;
    }

    setStatus('connecting');
    setErrorMsg('');

    const tellerConnect = window.TellerConnect.setup({
      applicationId: TELLER_APP_ID,
      environment: TELLER_ENV,
      onSuccess: async (enrollment) => {
        setStatus('syncing');
        setBankName(enrollment.enrollment?.institution?.name || 'your bank');
        try {
          const { data: result } = await api.post('/teller/enroll', {
            accessToken: enrollment.accessToken,
          });
          if (result.pendingTransactions) {
            setStatus('pending');
            setSyncMessage(result.message);
          } else {
            setStatus('done');
          }
          onSuccess?.();
        } catch (err: any) {
          console.error('Failed to enroll:', err);
          setErrorMsg(err.response?.data?.message || 'Failed to sync bank data');
          setStatus('error');
        }
      },
      onExit: () => {
        if (status === 'connecting') setStatus('idle');
      },
      onFailure: (error) => {
        console.error('Teller Connect error:', error);
        setErrorMsg(error.message || 'Connection failed');
        setStatus('error');
      },
    });

    tellerConnect.open();
  }, [onSuccess, status]);

  if (status === 'done') {
    return (
      <div className="flex items-center gap-2.5 text-emerald-600 font-medium text-sm">
        <CheckCircle2 className="w-5 h-5" />
        <span>{bankName ? `${bankName} connected!` : 'Bank connected!'}</span>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="space-y-2 text-center">
        <div className="flex items-center gap-2.5 text-amber-600 font-medium text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>{bankName ? `${bankName} connected!` : 'Bank connected!'}</span>
        </div>
        <p className="text-xs text-slate-500">{syncMessage || 'Your bank is still processing transactions. Use "Sync Bank Accounts" in a minute to pull them in.'}</p>
      </div>
    );
  }

  if (status === 'syncing') {
    return (
      <div className="flex items-center gap-2.5 text-indigo-600 font-medium text-sm">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Syncing {bankName || 'your accounts'}...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleConnect}
        disabled={status === 'loading' || status === 'connecting'}
        className={className || `inline-flex items-center gap-2 text-sm bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition`}
      >
        <Landmark className="w-4 h-4" />
        {status === 'connecting' ? 'Connecting...' : status === 'loading' ? 'Preparing...' : 'Connect Your Bank'}
      </button>
      {status === 'error' && errorMsg && (
        <p className="text-xs text-red-500">{errorMsg}</p>
      )}
    </div>
  );
}
