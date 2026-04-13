import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { CATEGORY_NAMES } from '@spenditure/shared';
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

interface UnclassifiedMerchant {
  merchantName: string;
  avgAmount: number;
  minAmount: number;
  maxAmount: number;
  count: number;
  lastDate: string;
  firstDate: string;
  currentCategory: string | null;
}

const CATEGORY_OPTIONS = CATEGORY_NAMES;

function getMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function Transactions() {
  const track = useTrack('transactions');
  const [searchParams, setSearchParams] = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const param = searchParams.get('dateFrom');
    return param === 'this_month' ? getMonthStart() : (param || '');
  });
  const [spendingOnly, setSpendingOnly] = useState(() => searchParams.get('spendingOnly') === 'true');
  const [sort, setSort] = useState('date_desc');
  const [categories, setCategories] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [classifying, setClassifying] = useState(false);
  const [classifyMsg, setClassifyMsg] = useState('');
  const limit = 50;

  // Bulk review state
  const [showBulkReview, setShowBulkReview] = useState(false);
  const [unclassified, setUnclassified] = useState<UnclassifiedMerchant[]>([]);
  const [bulkSelections, setBulkSelections] = useState<Record<string, { category: string; isBill: boolean }>>({});
  const [bulkSaving, setBulkSaving] = useState(false);

  useEffect(() => {
    api.get('/transactions/categories').then(r => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) params.set('search', search);
    if (categoryFilter) params.set('category', categoryFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (spendingOnly) params.set('spendingOnly', 'true');
    if (sort !== 'date_desc') params.set('sort', sort);
    api.get(`/transactions?${params}`)
      .then(r => {
        setTransactions(r.data.transactions);
        setTotal(r.data.total);
      })
      .finally(() => setLoading(false));
  }, [search, categoryFilter, offset, dateFrom, spendingOnly, sort]);

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

  async function loadUnclassified() {
    try {
      const { data } = await api.get('/runway/review-merchants');
      setUnclassified(data.merchants);
      setBulkSelections({});
      setShowBulkReview(true);
    } catch { /* ignore */ }
  }

  async function saveBulkClassifications() {
    const entries = Object.entries(bulkSelections).filter(([, v]) => v.category);
    if (entries.length === 0) return;
    setBulkSaving(true);
    try {
      const classifications = entries.map(([merchantName, { category, isBill }]) => ({
        merchantName, category, isBill,
      }));
      const { data } = await api.post('/runway/classify-merchants-batch', { classifications });
      setClassifyMsg(`Classified ${data.classified} merchants`);
      setShowBulkReview(false);
      // Refresh transactions
      setOffset(0);
      setSearch('');
      setCategoryFilter('');
      const r = await api.get(`/transactions?limit=${limit}&offset=0`);
      setTransactions(r.data.transactions);
      setTotal(r.data.total);
      api.get('/transactions/categories').then(r => setCategories(r.data)).catch(() => {});
    } catch (err: any) {
      setClassifyMsg(err.response?.data?.message || 'Batch classification failed');
    } finally {
      setBulkSaving(false);
    }
  }

  async function autoClassify() {
    setClassifying(true);
    setClassifyMsg('');
    try {
      const { data } = await api.post('/transactions/auto-classify');
      setClassifyMsg(data.message || `Classified ${data.classified} transactions`);
      // Refresh
      setOffset(0);
      setSearch('');
      setCategoryFilter('');
      const r = await api.get(`/transactions?limit=${limit}&offset=0`);
      setTransactions(r.data.transactions);
      setTotal(r.data.total);
      api.get('/transactions/categories').then(r => setCategories(r.data)).catch(() => {});
    } catch (err: any) {
      setClassifyMsg(err.response?.data?.message || 'Classification failed');
    } finally {
      setClassifying(false);
    }
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
        <div className="flex items-center gap-2">
          {classifyMsg && <span className="text-xs text-emerald-600">{classifyMsg}</span>}
          <button
            onClick={loadUnclassified}
            className="text-sm bg-gradient-to-b from-amber-500 to-amber-600 text-white px-3 py-1.5 rounded-lg hover:from-amber-600 hover:to-amber-700 shadow-sm transition-all"
          >
            Bulk Review
          </button>
          <button
            onClick={autoClassify}
            disabled={classifying}
            className="text-sm bg-gradient-to-b from-indigo-500 to-indigo-600 text-white px-3 py-1.5 rounded-lg hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 shadow-sm transition-all"
          >
            {classifying ? 'Classifying...' : 'Auto-Classify'}
          </button>
          <button
            onClick={handleExport}
            className="text-sm bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Bulk Review Panel */}
      {showBulkReview && (
        <div className="bg-white rounded-lg border border-amber-200 shadow-sm">
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between rounded-t-lg">
            <div>
              <h2 className="text-sm font-semibold text-amber-900">Bulk Review: {unclassified.length} unclassified merchants</h2>
              <p className="text-xs text-amber-700 mt-0.5">Select a category for each merchant, then save all at once.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-600">{Object.keys(bulkSelections).length} selected</span>
              <button
                onClick={saveBulkClassifications}
                disabled={bulkSaving || Object.keys(bulkSelections).length === 0}
                className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all"
              >
                {bulkSaving ? 'Saving...' : `Save ${Object.keys(bulkSelections).length}`}
              </button>
              <button onClick={() => setShowBulkReview(false)} className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5">
                Close
              </button>
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-100">
            {unclassified.length === 0 ? (
              <div className="text-center text-gray-500 py-6 text-sm">All merchants are classified!</div>
            ) : (
              unclassified.map(m => (
                <div key={m.merchantName} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{m.merchantName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {m.count}x · ${m.avgAmount.toFixed(0)}/avg
                      {m.minAmount !== m.maxAmount ? ` ($${m.minAmount.toFixed(0)}–$${m.maxAmount.toFixed(0)})` : ''}
                      {' · '}{m.firstDate?.slice(0, 7)} → {m.lastDate?.slice(0, 7)}
                      {m.currentCategory ? ` · ${m.currentCategory}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={bulkSelections[m.merchantName]?.category || ''}
                      onChange={e => {
                        const cat = e.target.value;
                        if (!cat) {
                          setBulkSelections(prev => { const n = { ...prev }; delete n[m.merchantName]; return n; });
                        } else {
                          setBulkSelections(prev => ({
                            ...prev,
                            [m.merchantName]: { category: cat, isBill: prev[m.merchantName]?.isBill || false },
                          }));
                        }
                      }}
                      className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 w-40"
                    >
                      <option value="">Select category...</option>
                      {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bulkSelections[m.merchantName]?.isBill || false}
                        onChange={e => {
                          const isBill = e.target.checked;
                          setBulkSelections(prev => ({
                            ...prev,
                            [m.merchantName]: {
                              category: prev[m.merchantName]?.category || '',
                              isBill,
                            },
                          }));
                        }}
                        className="rounded border-gray-300"
                      />
                      Bill
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

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
        <button
          onClick={() => { setSpendingOnly(!spendingOnly); setOffset(0); }}
          className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
            spendingOnly
              ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-medium'
              : 'border-gray-300 text-gray-500 hover:bg-gray-50'
          }`}
        >
          {spendingOnly ? 'Spending only' : 'All txns'}
        </button>
        <button
          onClick={() => { setCategoryFilter(categoryFilter === 'Uncategorized' ? '' : 'Uncategorized'); setOffset(0); }}
          className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
            categoryFilter === 'Uncategorized'
              ? 'bg-amber-50 border-amber-300 text-amber-700 font-medium'
              : 'border-gray-300 text-gray-500 hover:bg-gray-50'
          }`}
        >
          Uncategorized
        </button>
        <select value={sort} onChange={e => { setSort(e.target.value); setOffset(0); }}
          className="text-xs border border-gray-300 rounded-lg px-2 py-2 text-gray-500">
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
          <option value="amount_desc">Largest first</option>
          <option value="amount_asc">Smallest first</option>
        </select>
      </div>

      {(search || dateFrom || spendingOnly) && (
        <div className="flex items-center gap-2 flex-wrap">
          {search && <span className="text-sm text-gray-500">Results for "{search}"</span>}
          {dateFrom && <span className="text-sm text-slate-500 bg-indigo-50 px-2 py-0.5 rounded-md">Since {dateFrom}</span>}
          {spendingOnly && <span className="text-sm text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">Spending only</span>}
          <button onClick={() => { setSearch(''); setSearchInput(''); setDateFrom(''); setSpendingOnly(false); setSearchParams({}); }} className="text-sm text-indigo-600">Clear filters</button>
        </div>
      )}

      {/* Transaction list */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex justify-between">
              <div className="space-y-1.5 flex-1">
                <div className="h-4 bg-slate-100 rounded w-32" />
                <div className="h-3 bg-slate-100 rounded w-48" />
              </div>
              <div className="h-4 bg-slate-100 rounded w-16" />
            </div>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📋</span>
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            {search || categoryFilter ? 'No transactions match your filters' : 'No transactions yet'}
          </h3>
          <p className="text-sm text-slate-500 mb-4 max-w-xs mx-auto">
            {search || categoryFilter
              ? 'Try adjusting your search or clearing the filters.'
              : 'Import a CSV or connect your bank account to see your spending here.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          {transactions.map((tx, i) => (
            <div key={tx.id} className={`px-4 py-3.5 flex items-center justify-between gap-3 ${i % 2 === 1 ? 'bg-slate-50/50' : ''} ${i > 0 ? 'border-t border-slate-100' : ''}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setSearchInput(tx.merchant_name || ''); setSearch(tx.merchant_name || ''); setOffset(0); }}
                    className="text-sm font-medium text-gray-900 truncate hover:text-indigo-600 hover:underline transition-colors text-left"
                  >{tx.merchant_name || 'Unknown'}</button>
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
                      className="text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 px-2 py-0.5 rounded-full transition-colors"
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
