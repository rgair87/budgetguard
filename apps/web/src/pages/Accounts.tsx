import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Account } from '@budgetguard/shared';
import { PlaidLinkButton } from '../components/PlaidLink';
import { CardGridSkeleton } from '../components/Skeletons';

const fmtCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const typeIcons: Record<string, string> = {
  depository: 'Bank Account',
  credit: 'Credit Card',
  loan: 'Loan',
  investment: 'Investment',
};

const typeBadgeColors: Record<string, string> = {
  depository: 'bg-blue-100 text-blue-700',
  credit: 'bg-purple-100 text-purple-700',
  loan: 'bg-orange-100 text-orange-700',
  investment: 'bg-green-100 text-green-700',
};

export function AccountsPage() {
  const queryClient = useQueryClient();
  const [confirmUnlink, setConfirmUnlink] = useState<string | null>(null);

  const { data: accounts, isLoading, error, refetch } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await api.get<Account[]>('/accounts');
      return res.data ?? [];
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (accountId: string) => {
      await api.delete(`/accounts/${accountId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setConfirmUnlink(null);
    },
  });

  if (isLoading) return <CardGridSkeleton />;

  if (error) {
    return (
      <div className="card flex flex-col items-center py-16 text-center">
        <svg className="h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Something went wrong</h3>
        <p className="mt-1 text-sm text-gray-500">{(error as Error).message}</p>
        <button className="btn-secondary mt-6" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const accountsList = accounts ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your linked bank accounts and credit cards.
          </p>
        </div>
        <PlaidLinkButton onSuccess={() => queryClient.invalidateQueries({ queryKey: ['accounts'] })}>
          Link New Account
        </PlaidLinkButton>
      </div>

      {/* Accounts List */}
      {accountsList.length === 0 ? (
        <div className="card py-16 text-center">
          <svg className="mx-auto h-12 w-12 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
          <h3 className="mt-4 text-xl font-semibold text-gray-900">No accounts linked</h3>
          <p className="mt-2 text-sm text-gray-500">
            Get started by linking your bank account or credit card.
          </p>
          <div className="mt-6">
            <PlaidLinkButton onSuccess={() => queryClient.invalidateQueries({ queryKey: ['accounts'] })}>
              Link Your First Account
            </PlaidLinkButton>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {accountsList.map((account, i) => (
            <div
              key={account.id}
              className="card animate-fade-in-up flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
              style={{ animationDelay: `${(i + 1) * 100}ms`, opacity: 0 }}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                  account.type === 'depository' ? 'bg-blue-100' :
                  account.type === 'credit' ? 'bg-purple-100' :
                  account.type === 'loan' ? 'bg-orange-100' : 'bg-green-100'
                }`}>
                  <svg className={`h-6 w-6 ${
                    account.type === 'depository' ? 'text-blue-600' :
                    account.type === 'credit' ? 'text-purple-600' :
                    account.type === 'loan' ? 'text-orange-600' : 'text-green-600'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {account.type === 'credit' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                      />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    )}
                  </svg>
                </div>

                {/* Details */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{account.name}</h3>
                  {account.officialName && (
                    <p className="text-sm text-gray-500">{account.officialName}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${typeBadgeColors[account.type] ?? 'bg-gray-100 text-gray-700'}`}>
                      {typeIcons[account.type] ?? account.type}
                    </span>
                    {account.subtype && (
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        {account.subtype}
                      </span>
                    )}
                    {account.mask && (
                      <span className="text-xs text-gray-400">
                        ****{account.mask}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Balance + Actions */}
              <div className="flex items-center gap-6 sm:text-right">
                <div className="flex-1 sm:flex-initial">
                  <p className="text-xs font-medium uppercase text-gray-400">Balance</p>
                  <p className="mt-0.5 text-xl font-bold text-gray-900">
                    {account.currentBalance != null
                      ? fmtCurrency.format(account.currentBalance)
                      : '--'}
                  </p>
                  {account.availableBalance != null && account.availableBalance !== account.currentBalance && (
                    <p className="text-xs text-gray-400">
                      Available: {fmtCurrency.format(account.availableBalance)}
                    </p>
                  )}
                </div>

                {/* Unlink */}
                {confirmUnlink === account.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      onClick={() => unlinkMutation.mutate(account.id)}
                      disabled={unlinkMutation.isPending}
                    >
                      {unlinkMutation.isPending ? 'Unlinking...' : 'Confirm'}
                    </button>
                    <button
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
                      onClick={() => setConfirmUnlink(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    onClick={() => setConfirmUnlink(account.id)}
                  >
                    Unlink
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
