import { useEffect, useState } from 'react';
import api from '../api/client';
import useTrack from '../hooks/useTrack';

interface Transaction {
  id: string;
  amount: number;
  date: string;
  merchant_name: string;
  category: string;
  is_recurring: boolean;
  account_name: string;
}

const CATEGORY_OPTIONS = [
  'Groceries', 'Restaurants', 'Shopping', 'Entertainment', 'Transportation',
  'Utilities', 'Healthcare', 'Housing', 'Insurance', 'Phone', 'Internet',
  'Debt Payments', 'Education', 'Personal', 'Travel', 'Services', 'Other',
];

export default function Transactions() {
  const track = useTrack('transactions');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const limit = 50;

  useEffect(() => {
    api.get('/transactions/categories').then(r => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) params.set('search', search);
    if (categoryFilter) params.set('category', categoryFilter);
    api.get(`/transactions?${params}`)
      .then(r => {
        setTransactions(r.data.transactions);
        setTotal(r.data.total);
      })
      .finally(() => setLoading(false));
  }, [search, categoryFilter, offset]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setOffset(0);
    setSearch(searchInput.trim());
  }

  async function saveCategory(id: string) {
    if (!editCategory) return;
    await api.patch(`/transactions/${id}`, { category: editCategory });
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, category: editCategory } : t));
    setEditingId(null);
  }

  async function handleExport() {
    try {
      const response = await api.get('/transactions/export', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'runway-transactions.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      if (err.response?.status === 403) {
        alert('Export is a Pro feature. Upgrade in Settings.');
      }
    }
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Transactions</h1>
          <p className="text-sm text-gray-500">{total} total</p>
        </div>
        <button
          onClick={handleExport}
          className="text-sm bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50"
        >
          Export CSV
        </button>
      </div>

      {/* Search & filters */}
      <div className="flex gap-2">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search merchants or categories..."
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button type="submit" className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg">
            Search
          </button>
        </form>
        <select
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); setOffset(0); }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2"
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {search && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Showing results for "{search}"</span>
          <button onClick={() => { setSearch(''); setSearchInput(''); }} className="text-sm text-indigo-600">Clear</button>
        </div>
      )}

      {/* Transaction list */}
      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading...</div>
      ) : transactions.length === 0 ? (
        <div className="text-center text-gray-500 py-8">No transactions found</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {transactions.map(tx => (
            <div key={tx.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{tx.merchant_name || 'Unknown'}</p>
                  {tx.is_recurring ? <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Recurring</span> : null}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">
                    {new Date(tx.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">{tx.account_name}</span>
                  <span className="text-xs text-gray-300">·</span>
                  {editingId === tx.id ? (
                    <div className="flex items-center gap-1">
                      <select
                        value={editCategory}
                        onChange={e => setEditCategory(e.target.value)}
                        className="text-xs border border-gray-300 rounded px-1.5 py-0.5"
                        autoFocus
                      >
                        {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button onClick={() => saveCategory(tx.id)} className="text-xs text-indigo-600">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingId(tx.id); setEditCategory(tx.category || 'Other'); }}
                      className="text-xs text-gray-500 hover:text-indigo-600"
                      title="Click to recategorize"
                    >
                      {tx.category || 'Uncategorized'}
                    </button>
                  )}
                </div>
              </div>
              <p className={`text-sm font-semibold shrink-0 ${tx.amount >= 0 ? 'text-green-600' : 'text-gray-900'}`}>
                {tx.amount >= 0 ? '+' : '-'}${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
            className="text-sm text-indigo-600 disabled:text-gray-300 px-3 py-1.5"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {currentPage} of {totalPages}</span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => setOffset(offset + limit)}
            className="text-sm text-indigo-600 disabled:text-gray-300 px-3 py-1.5"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
