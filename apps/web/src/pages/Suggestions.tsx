import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { SuggestionType } from '@budgetguard/shared';

const fmtCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

function Spinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
    </div>
  );
}

const typeBadge: Record<SuggestionType, { bg: string; text: string; label: string }> = {
  cut: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cut' },
  swap: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Swap' },
  trim: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Trim' },
};

interface SuggestionFromApi {
  type: SuggestionType;
  category: string;
  title: string;
  description: string;
  estimatedSavings: number;
  priority: number;
}

interface SuggestionsResponse {
  suggestions: SuggestionFromApi[];
  savingsRate: number;
  income: number;
  spending: number;
}

interface LocalSuggestion extends SuggestionFromApi {
  localId: string;
  localStatus: 'pending' | 'accepted' | 'dismissed';
}

export function SuggestionsPage() {
  const queryClient = useQueryClient();
  const [actionedIds, setActionedIds] = useState<Record<string, 'accepted' | 'dismissed'>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['suggestions'],
    queryFn: async () => {
      const res = await api.post<SuggestionsResponse>('/budgets/suggestions');
      return res.data!;
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      await api.post<SuggestionsResponse>('/budgets/suggestions');
    },
    onSuccess: () => {
      setActionedIds({});
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    },
  });

  function handleAccept(localId: string) {
    setActionedIds((prev) => ({ ...prev, [localId]: 'accepted' }));
  }

  function handleDismiss(localId: string) {
    setActionedIds((prev) => ({ ...prev, [localId]: 'dismissed' }));
  }

  if (isLoading) return <Spinner />;

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-red-700">
        <h3 className="font-semibold">Failed to load suggestions</h3>
        <p className="mt-1 text-sm">{(error as Error).message}</p>
      </div>
    );
  }

  const rawSuggestions = data?.suggestions ?? [];
  const allSuggestions: LocalSuggestion[] = rawSuggestions.map((s, idx) => ({
    ...s,
    localId: `${s.category}-${s.type}-${idx}`,
    localStatus: actionedIds[`${s.category}-${s.type}-${idx}`] ?? 'pending',
  }));

  const pendingSuggestions = allSuggestions.filter((s) => s.localStatus === 'pending');

  const totalMonthlySavings = pendingSuggestions.reduce((sum, s) => sum + s.estimatedSavings, 0);
  const totalAnnualSavings = totalMonthlySavings * 12;
  const total3MonthSavings = totalMonthlySavings * 3;
  const total6MonthSavings = totalMonthlySavings * 6;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Savings</h1>
          <p className="mt-1 text-sm text-gray-500">
            AI-powered suggestions to help you save money.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
        >
          {analyzeMutation.isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Analyzing...
            </span>
          ) : (
            'Analyze My Spending'
          )}
        </button>
      </div>

      {/* Income / Spending Overview */}
      {data && (data.income > 0 || data.spending > 0) && (
        <div className="card">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div>
              <p className="text-xs font-medium uppercase text-gray-400">Monthly Income</p>
              <p className="text-lg font-semibold text-gray-900">{fmtCurrency.format(data.income)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-gray-400">Monthly Spending</p>
              <p className="text-lg font-semibold text-gray-900">{fmtCurrency.format(data.spending)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-gray-400">Savings Rate</p>
              <p className={`text-lg font-semibold ${data.savingsRate >= 0.1 ? 'text-green-600' : 'text-red-600'}`}>
                {(data.savingsRate * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Savings Summary */}
      {pendingSuggestions.length > 0 && (
        <div className="card bg-gradient-to-r from-green-600 to-emerald-600 text-white">
          <p className="text-sm font-medium text-green-100">Potential Savings</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-6">
            <div>
              <p className="text-3xl font-bold">{fmtCurrency.format(totalMonthlySavings)}</p>
              <p className="text-sm text-green-200">per month</p>
            </div>
            <div>
              <p className="text-xl font-bold">{fmtCurrency.format(total3MonthSavings)}</p>
              <p className="text-sm text-green-200">3 months</p>
            </div>
            <div>
              <p className="text-xl font-bold">{fmtCurrency.format(total6MonthSavings)}</p>
              <p className="text-sm text-green-200">6 months</p>
            </div>
            <div>
              <p className="text-xl font-bold">{fmtCurrency.format(totalAnnualSavings)}</p>
              <p className="text-sm text-green-200">12 months</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-green-200">
            Based on {pendingSuggestions.length} actionable suggestion{pendingSuggestions.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Suggestions List */}
      {allSuggestions.length === 0 ? (
        <div className="card py-16 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No suggestions yet</h3>
          <p className="mt-2 text-sm text-gray-500">
            Click "Analyze My Spending" to get personalized savings recommendations.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {allSuggestions.map((suggestion) => {
            const badge = typeBadge[suggestion.type] ?? typeBadge.trim;
            const isAccepted = suggestion.localStatus === 'accepted';
            const isDismissed = suggestion.localStatus === 'dismissed';
            const isActioned = isAccepted || isDismissed;

            return (
              <div
                key={suggestion.localId}
                className={`card transition-opacity ${isActioned ? 'opacity-60' : ''}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  {/* Left: Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                      <h3 className="text-base font-semibold text-gray-900">
                        {suggestion.title}
                      </h3>
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        {suggestion.category}
                      </span>
                      {isAccepted && (
                        <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          Accepted
                        </span>
                      )}
                      {isDismissed && (
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                          Dismissed
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-gray-500">{suggestion.description}</p>

                    {/* Savings info */}
                    <div className="mt-4 flex flex-wrap items-center gap-6">
                      <div className="rounded-lg bg-green-50 px-3 py-2">
                        <p className="text-xs font-medium text-green-600">Estimated Monthly Savings</p>
                        <p className="text-lg font-bold text-green-700">
                          {fmtCurrency.format(suggestion.estimatedSavings)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 px-3 py-2">
                        <p className="text-xs font-medium text-emerald-600">Annual Projection</p>
                        <p className="text-lg font-bold text-emerald-700">
                          {fmtCurrency.format(suggestion.estimatedSavings * 12)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-3 py-2">
                        <p className="text-xs font-medium text-gray-500">Priority</p>
                        <p className="text-lg font-bold text-gray-700">
                          #{suggestion.priority}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  {!isActioned && (
                    <div className="flex shrink-0 gap-2 lg:ml-4">
                      <button
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                        onClick={() => handleAccept(suggestion.localId)}
                      >
                        Accept
                      </button>
                      <button
                        className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                        onClick={() => handleDismiss(suggestion.localId)}
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
