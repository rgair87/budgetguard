import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { SPENDING_CATEGORIES, CATEGORY_LABELS } from '@budgetguard/shared';
import type { Transaction, PaginatedResponse } from '@budgetguard/shared';

const fmtCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const fmtDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function Spinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
    </div>
  );
}

const PAGE_SIZE = 20;

export function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [category, setCategory] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const queryParams: Record<string, string | number | boolean | undefined> = {
    page,
    limit: PAGE_SIZE,
  };
  if (startDate) queryParams.startDate = startDate;
  if (endDate) queryParams.endDate = endDate;
  if (category) queryParams.category = category;

  const { data, isLoading, error } = useQuery({
    queryKey: ['transactions', page, startDate, endDate, category],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<Transaction>>('/transactions', queryParams);
      return res.data!;
    },
  });

  const minAmountNum = minAmount ? parseFloat(minAmount) : null;
  const maxAmountNum = maxAmount ? parseFloat(maxAmount) : null;

  let transactions = data?.data ?? [];

  // Client-side amount filtering (API may not support amount range)
  if (minAmountNum != null) {
    transactions = transactions.filter((t) => Math.abs(t.amount) >= minAmountNum);
  }
  if (maxAmountNum != null) {
    transactions = transactions.filter((t) => Math.abs(t.amount) <= maxAmountNum);
  }

  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;

  function clearFilters() {
    setStartDate('');
    setEndDate('');
    setCategory('');
    setMinAmount('');
    setMaxAmount('');
    setPage(1);
  }

  const hasFilters = startDate || endDate || category || minAmount || maxAmount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <p className="mt-1 text-sm text-gray-500">
          View and filter your transaction history.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="card">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[140px]">
            <label htmlFor="startDate" className="label">Start Date</label>
            <input
              id="startDate"
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            />
          </div>
          <div className="min-w-[140px]">
            <label htmlFor="endDate" className="label">End Date</label>
            <input
              id="endDate"
              type="date"
              className="input"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            />
          </div>
          <div className="min-w-[160px]">
            <label htmlFor="category" className="label">Category</label>
            <select
              id="category"
              className="input"
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            >
              <option value="">All Categories</option>
              {SPENDING_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[100px]">
            <label htmlFor="minAmount" className="label">Min Amount</label>
            <input
              id="minAmount"
              type="number"
              className="input"
              placeholder="0"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
            />
          </div>
          <div className="min-w-[100px]">
            <label htmlFor="maxAmount" className="label">Max Amount</label>
            <input
              id="maxAmount"
              type="number"
              className="input"
              placeholder="9999"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
            />
          </div>
          {hasFilters && (
            <button
              className="btn-secondary"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Loading / Error */}
      {isLoading && <Spinner />}

      {error && (
        <div className="rounded-lg bg-red-50 p-6 text-red-700">
          <h3 className="font-semibold">Failed to load transactions</h3>
          <p className="mt-1 text-sm">{(error as Error).message}</p>
        </div>
      )}

      {/* Transaction List */}
      {!isLoading && !error && (
        <>
          {transactions.length === 0 ? (
            <div className="card py-16 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">No transactions found</h3>
              <p className="mt-2 text-sm text-gray-500">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Merchant</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map((txn) => {
                      const isCredit = txn.amount < 0;
                      const displayAmount = Math.abs(txn.amount);
                      const categoryLabel = txn.personalFinanceCategoryPrimary
                        ? (CATEGORY_LABELS as Record<string, string>)[txn.personalFinanceCategoryPrimary] ?? txn.personalFinanceCategoryPrimary
                        : '--';

                      return (
                        <tr key={txn.id} className="hover:bg-gray-50 transition-colors">
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                            {fmtDate.format(new Date(txn.date))}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                              {txn.name}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {txn.merchantName ?? '--'}
                          </td>
                          <td className={`whitespace-nowrap px-4 py-3 text-right text-sm font-semibold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                            {isCredit ? '+' : '-'}{fmtCurrency.format(displayAmount)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                              {categoryLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {txn.isRecurring && (
                                <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                  Recurring
                                </span>
                              )}
                              {txn.pending && (
                                <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                                  Pending
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
                {pagination?.total != null && (
                  <> &middot; {pagination.total.toLocaleString()} total transactions</>
                )}
              </p>
              <div className="flex gap-2">
                <button
                  className="btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  className="btn-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
