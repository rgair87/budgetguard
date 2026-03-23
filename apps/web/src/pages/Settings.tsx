import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Account {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  purpose: string;
  income_allocation: number | null;
  interest_rate: number | null;
  minimum_payment: number | null;
  plaid_account_id: string | null;
  last_synced_at: string | null;
}

interface SettingsData {
  user: { id: string; email: string; subscription_status: string; pay_frequency: string; next_payday: string; take_home_pay: number; created_at: string };
  accounts: Account[];
}

const PURPOSE_LABELS: Record<string, string> = {
  general: 'General',
  spending: 'Daily spending',
  bills: 'Bills & fixed costs',
  savings: 'Savings',
  emergency: 'Emergency fund',
};

const ACCOUNT_TYPES: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit: 'Credit Card',
  mortgage: 'Mortgage',
  auto_loan: 'Auto Loan',
  student_loan: 'Student Loan',
  personal_loan: 'Personal Loan',
};

const DEBT_TYPES = ['credit', 'mortgage', 'auto_loan', 'student_loan', 'personal_loan'];
const CASH_TYPES = ['checking', 'savings'];

function isDebtType(type: string) {
  return DEBT_TYPES.includes(type);
}

const DEFAULT_RATES: Record<string, number> = {
  credit: 24.0,
  mortgage: 7.0,
  auto_loan: 8.5,
  student_loan: 6.0,
  personal_loan: 12.0,
};

const RATE_HELP: Record<string, string> = {
  credit: 'Check your statement or app — usually 18-30%',
  mortgage: 'On your loan statement or closing docs — usually 5-8%',
  auto_loan: 'On your loan agreement or payment portal — usually 5-12%',
  student_loan: 'On studentaid.gov or your servicer — usually 4-8%',
  personal_loan: 'On your loan agreement — usually 8-20%',
};

const TEMPLATES = {
  debts: {
    label: 'Debts',
    desc: 'Credit cards, loans, mortgage',
    endpoint: '/csv/import-debts',
    filename: 'debts-template.csv',
    content: `name,type,balance,apr,minimum_payment\nChase Visa,credit card,5200,24.99,130\nCar Loan,auto loan,18500,6.9,350\nStudent Loan,student loan,35000,5.5,400`,
  },
  budget: {
    label: 'Budget',
    desc: 'Monthly spending limits by category',
    endpoint: '/csv/import-budget',
    filename: 'budget-template.csv',
    content: `category,monthly_limit\nGroceries,400\nGas,150\nDining Out,100\nEntertainment,50\nClothing,75`,
  },
  bills: {
    label: 'Bills',
    desc: 'Rent, utilities, subscriptions',
    endpoint: '/csv/import-bills',
    filename: 'bills-template.csv',
    content: `name,amount,frequency\nRent,1200,monthly\nElectric,150,monthly\nCar Insurance,180,monthly\nPhone,85,monthly\nInternet,60,monthly\nNetflix,15.99,monthly\nGym,30,monthly`,
  },
};

function downloadTemplate(key: keyof typeof TEMPLATES) {
  const t = TEMPLATES[key];
  const blob = new Blob([t.content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = t.filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ImportData() {
  const [results, setResults] = useState<Record<string, { msg: string; ok: boolean }>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRefs = {
    debts: useRef<HTMLInputElement>(null),
    budget: useRef<HTMLInputElement>(null),
    bills: useRef<HTMLInputElement>(null),
  };

  async function handleUpload(key: keyof typeof TEMPLATES, file: File) {
    setUploading(key);
    setResults(r => ({ ...r, [key]: undefined as any }));
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(TEMPLATES[key].endpoint, form);
      setResults(r => ({ ...r, [key]: { msg: data.message, ok: true } }));
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Upload failed';
      setResults(r => ({ ...r, [key]: { msg, ok: false } }));
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h2 className="font-medium text-gray-900 mb-1">Import Data</h2>
      <p className="text-xs text-gray-500 mb-4">
        Download a template, fill it in with your info, and upload it back. Or upload your own CSV with similar columns.
      </p>
      <div className="space-y-3">
        {(Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]).map(key => {
          const t = TEMPLATES[key];
          const result = results[key];
          return (
            <div key={key} className="flex items-center justify-between py-2 border-t border-gray-50 first:border-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{t.label}</p>
                <p className="text-xs text-gray-400">{t.desc}</p>
                {result && (
                  <p className={`text-xs mt-1 ${result.ok ? 'text-green-600' : 'text-red-600'}`}>
                    {result.msg}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <button
                  onClick={() => downloadTemplate(key)}
                  className="text-xs text-indigo-600 active:text-indigo-800 px-2 py-1.5"
                >
                  Template
                </button>
                <button
                  onClick={() => fileRefs[key].current?.click()}
                  disabled={uploading === key}
                  className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md active:bg-indigo-700 disabled:opacity-50"
                >
                  {uploading === key ? '...' : 'Upload'}
                </button>
                <input
                  ref={fileRefs[key]}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(key, file);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TierInfo {
  tier: 'free' | 'pro';
  limits: Record<string, any>;
}

function PrivacySection() {
  const [exporting, setExporting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const { logout } = useAuth();

  async function handleExport() {
    setExporting(true);
    try {
      const { data } = await api.get('/settings/export-data');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `runway-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  async function handleExportCsv() {
    setExportingCsv(true);
    try {
      const { data } = await api.get('/settings/export-csv', { responseType: 'blob' });
      const blob = new Blob([data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `runway-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export CSV. Please try again.');
    } finally {
      setExportingCsv(false);
    }
  }

  async function handleDeleteAccount() {
    if (!deletePassword) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete('/settings/delete-account', { data: { password: deletePassword } });
      logout();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to delete account';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h2 className="font-medium text-gray-900 mb-1">Privacy & Data</h2>
      <p className="text-xs text-gray-500 mb-4">
        Export or delete all your data. These actions comply with GDPR data portability and right-to-erasure requirements.
      </p>

      <div className="space-y-3">
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-gray-900">Export My Data</p>
            <p className="text-xs text-gray-400">Download all your data as a JSON file</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {exporting ? 'Exporting...' : 'Export'}
            </button>
            <button
              onClick={handleExportCsv}
              disabled={exportingCsv}
              className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {exportingCsv ? 'Exporting...' : 'Export as Spreadsheet'}
            </button>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Delete My Account</p>
              <p className="text-xs text-gray-400">Permanently delete your account and all data</p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="text-sm bg-red-600 text-white px-4 py-1.5 rounded-md hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-red-600 mb-2">Delete Account</h3>
            <p className="text-sm text-gray-600 mb-1">
              This action is <strong>permanent and irreversible</strong>. All your data will be deleted immediately:
            </p>
            <ul className="text-xs text-gray-500 list-disc ml-4 mb-4 space-y-0.5">
              <li>Accounts and transactions</li>
              <li>Budgets and savings goals</li>
              <li>Chat history and AI insights</li>
              <li>All settings and preferences</li>
            </ul>
            <label className="block text-sm text-gray-700 mb-1">Enter your password to confirm</label>
            <input
              type="password"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDeleteAccount()}
              placeholder="Your password"
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 mb-3"
              autoFocus
            />
            {deleteError && (
              <p className="text-xs text-red-600 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError(''); }}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || !deletePassword}
                className="text-sm bg-red-600 text-white px-4 py-1.5 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '', type: 'checking', balance: '', purpose: 'general',
    income_allocation: '', interest_rate: '', minimum_payment: ''
  });
  const [editingBalance, setEditingBalance] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState('');
  const [editingPaycheck, setEditingPaycheck] = useState(false);
  const [payFreq, setPayFreq] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payNextDate, setPayNextDate] = useState('');
  const [savingPaycheck, setSavingPaycheck] = useState(false);
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/settings')
      .then(r => {
        setData(r.data);
        setTierInfo({ tier: r.data.tier, limits: r.data.limits });
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleUpgrade() {
    await api.post('/settings/upgrade');
    setTierInfo(t => t ? { ...t, tier: 'pro' } : null);
    setData(d => d ? { ...d, user: { ...d.user, subscription_status: 'active' } } : null);
  }

  async function handleDowngrade() {
    await api.post('/settings/downgrade');
    setTierInfo(t => t ? { ...t, tier: 'free' } : null);
    setData(d => d ? { ...d, user: { ...d.user, subscription_status: 'trial' } } : null);
  }

  async function removeAccount(id: string) {
    await api.delete(`/settings/accounts/${id}`);
    setData(d => d ? { ...d, accounts: d.accounts.filter(a => a.id !== id) } : null);
  }

  async function addAccount() {
    if (!newAccount.name) return;
    const { data: acct } = await api.post('/settings/accounts', newAccount);
    setData(d => d ? { ...d, accounts: [...d.accounts, { ...acct, plaid_account_id: null, last_synced_at: null }] } : null);
    setNewAccount({ name: '', type: 'checking', balance: '', purpose: 'general', income_allocation: '', interest_rate: '', minimum_payment: '' });
    setShowAddAccount(false);
  }

  function startEditPaycheck() {
    setPayFreq(data?.user.pay_frequency || '');
    setPayAmount(data?.user.take_home_pay ? String(data.user.take_home_pay) : '');
    setPayNextDate(data?.user.next_payday || '');
    setEditingPaycheck(true);
  }

  async function savePaycheck() {
    if (!payFreq || !payAmount || !payNextDate) return;
    setSavingPaycheck(true);
    try {
      await api.put('/runway/paycheck', {
        pay_frequency: payFreq,
        take_home_pay: parseFloat(payAmount),
        next_payday: payNextDate,
      });
      setData(d => d ? {
        ...d,
        user: { ...d.user, pay_frequency: payFreq, take_home_pay: parseFloat(payAmount), next_payday: payNextDate }
      } : null);
      setEditingPaycheck(false);
    } finally {
      setSavingPaycheck(false);
    }
  }

  async function saveBalance(id: string) {
    await api.patch(`/settings/accounts/${id}`, { balance: editBalance });
    setData(d => d ? {
      ...d,
      accounts: d.accounts.map(a => a.id === id ? { ...a, current_balance: parseFloat(editBalance) || 0 } : a)
    } : null);
    setEditingBalance(null);
  }

  async function updateAccountField(id: string, field: string, value: any) {
    await api.patch(`/settings/accounts/${id}`, { [field]: value });
    setData(d => d ? {
      ...d,
      accounts: d.accounts.map(a => a.id === id ? { ...a, [field]: value } : a)
    } : null);
  }

  if (loading) return <div className="text-gray-500 text-center py-12">Loading...</div>;
  if (!data) return null;

  const cashAccounts = data.accounts.filter(a => CASH_TYPES.includes(a.type));
  const debtAccounts = data.accounts.filter(a => isDebtType(a.type));

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900">Settings</h1>

      {/* Account info + Tier */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="font-medium text-gray-900 mb-3">Account</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Email</span>
            <span className="text-gray-900">{data.user.email}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Plan</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                tierInfo?.tier === 'pro' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {tierInfo?.tier === 'pro' ? 'Pro' : 'Free'}
              </span>
              {tierInfo?.tier !== 'pro' ? (
                <button onClick={handleUpgrade} className="text-xs text-indigo-600 font-medium">
                  Upgrade to Pro
                </button>
              ) : (
                <button onClick={handleDowngrade} className="text-xs text-gray-400">
                  Downgrade
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tier comparison */}
        {tierInfo?.tier !== 'pro' && (
          <div className="mt-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100">
            <p className="text-sm font-semibold text-indigo-900 mb-2">Pro features</p>
            <ul className="text-xs text-indigo-700 space-y-1">
              <li>50 AI chat messages/day (vs 15 free)</li>
              <li>Bank sync via Plaid</li>
              <li>Weekly advisor refresh (vs biweekly)</li>
              <li>6-month calendar projections (vs 2)</li>
              <li>Transaction export (CSV)</li>
              <li>Unlimited CSV imports &amp; savings goals</li>
              <li>Subscription management (dismiss/reclassify)</li>
            </ul>
            <button
              onClick={handleUpgrade}
              className="mt-3 w-full bg-indigo-600 text-white text-sm py-2 rounded-md font-medium hover:bg-indigo-700"
            >
              Upgrade to Pro
            </button>
          </div>
        )}
      </div>

      {/* Paycheck info */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-gray-900">Paycheck</h2>
          {!editingPaycheck && (
            <button onClick={startEditPaycheck} className="text-sm text-indigo-600 hover:text-indigo-700">
              Edit
            </button>
          )}
        </div>

        {editingPaycheck ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Pay frequency</label>
              <select
                value={payFreq}
                onChange={e => setPayFreq(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Select...</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="twice_monthly">Twice a month (1st & 15th)</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Take-home pay (per paycheck)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-md pl-7 pr-3 py-2"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Next payday</label>
              <input
                type="date"
                value={payNextDate}
                onChange={e => setPayNextDate(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setEditingPaycheck(false)}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={savePaycheck}
                disabled={savingPaycheck || !payFreq || !payAmount || !payNextDate}
                className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingPaycheck ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Frequency</span>
              <span className="text-gray-900 capitalize">{data.user.pay_frequency?.replace('_', ' ') || 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Next payday</span>
              <span className="text-gray-900">
                {data.user.next_payday ? new Date(data.user.next_payday + 'T00:00:00').toLocaleDateString() : 'Not set'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Take-home</span>
              <span className="text-gray-900">
                {data.user.take_home_pay ? `$${data.user.take_home_pay.toLocaleString()}` : 'Not set'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Accounts & Debts */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-medium text-gray-900">Your Accounts & Debts</h2>
            <p className="text-xs text-gray-500 mt-0.5">Add all your accounts — checking, savings, credit cards, loans, mortgage</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/csv-upload')} className="text-sm text-indigo-600 hover:text-indigo-700">
              Upload CSV
            </button>
            <button onClick={() => setShowAddAccount(true)} className="text-sm text-indigo-600 hover:text-indigo-700">
              + Add
            </button>
          </div>
        </div>

        {/* Add account form */}
        {showAddAccount && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Name (e.g. Chase Visa, Car Loan)"
                value={newAccount.name}
                onChange={e => setNewAccount({ ...newAccount, name: e.target.value })}
                className="col-span-2 text-sm border border-gray-300 rounded-md px-3 py-2"
              />
              <select
                value={newAccount.type}
                onChange={e => {
                  const t = e.target.value;
                  const rate = DEFAULT_RATES[t];
                  setNewAccount({ ...newAccount, type: t, interest_rate: rate ? String(rate) : '' });
                }}
                className="text-sm border border-gray-300 rounded-md px-3 py-2"
              >
                <optgroup label="Cash">
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                </optgroup>
                <optgroup label="Debt">
                  <option value="credit">Credit Card</option>
                  <option value="mortgage">Mortgage</option>
                  <option value="auto_loan">Auto Loan</option>
                  <option value="student_loan">Student Loan</option>
                  <option value="personal_loan">Personal Loan</option>
                </optgroup>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                step="0.01"
                placeholder={isDebtType(newAccount.type) ? 'Amount owed' : 'Current balance'}
                value={newAccount.balance}
                onChange={e => setNewAccount({ ...newAccount, balance: e.target.value })}
                className="text-sm border border-gray-300 rounded-md px-3 py-2"
              />
              {!isDebtType(newAccount.type) ? (
                <select
                  value={newAccount.purpose}
                  onChange={e => setNewAccount({ ...newAccount, purpose: e.target.value })}
                  className="text-sm border border-gray-300 rounded-md px-3 py-2"
                >
                  {Object.entries(PURPOSE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  step="0.01"
                  placeholder={`Rate % (avg ~${DEFAULT_RATES[newAccount.type] || 22}%)`}
                  value={newAccount.interest_rate}
                  onChange={e => setNewAccount({ ...newAccount, interest_rate: e.target.value })}
                  className="text-sm border border-gray-300 rounded-md px-3 py-2"
                />
              )}
            </div>

            {/* Debt minimum payment + helper */}
            {isDebtType(newAccount.type) && (
              <div className="space-y-1">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Monthly minimum payment"
                  value={newAccount.minimum_payment}
                  onChange={e => setNewAccount({ ...newAccount, minimum_payment: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-2"
                />
                <p className="text-xs text-gray-400">
                  Don't know your rate? We'll estimate ~{DEFAULT_RATES[newAccount.type] || 22}%. {RATE_HELP[newAccount.type] || ''}
                </p>
              </div>
            )}

            {/* Income allocation for cash accounts */}
            {CASH_TYPES.includes(newAccount.type) && (
              <div>
                <input
                  type="number"
                  step="0.01"
                  placeholder="How much of each paycheck goes here? (optional)"
                  value={newAccount.income_allocation}
                  onChange={e => setNewAccount({ ...newAccount, income_allocation: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-2"
                />
                <p className="text-xs text-gray-400 mt-1">e.g. $935 if you send $935 from each paycheck to this account</p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAddAccount(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1">
                Cancel
              </button>
              <button onClick={addAccount} className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-md hover:bg-indigo-700">
                Add
              </button>
            </div>
          </div>
        )}

        {data.accounts.length === 0 && (
          <p className="text-sm text-gray-500">No accounts yet. Add one to get started.</p>
        )}

        {/* Cash accounts */}
        {cashAccounts.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Cash Accounts</h3>
            <div className="space-y-3">
              {cashAccounts.map(acct => (
                <div key={acct.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{acct.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{ACCOUNT_TYPES[acct.type] || acct.type}</span>
                        <select
                          value={acct.purpose || 'general'}
                          onChange={e => updateAccountField(acct.id, 'purpose', e.target.value)}
                          className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-600"
                        >
                          {Object.entries(PURPOSE_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {editingBalance === acct.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-400">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={editBalance}
                            onChange={e => setEditBalance(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveBalance(acct.id)}
                            className="w-28 text-sm border border-gray-300 rounded px-2 py-1"
                            autoFocus
                          />
                          <button onClick={() => saveBalance(acct.id)} className="text-xs text-indigo-600">Save</button>
                          <button onClick={() => setEditingBalance(null)} className="text-xs text-gray-400">Cancel</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingBalance(acct.id); setEditBalance(String(acct.current_balance || 0)); }}
                          className="text-sm font-medium text-gray-900 hover:text-indigo-600"
                          title="Click to edit balance"
                        >
                          ${(acct.current_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </button>
                      )}
                      <button onClick={() => removeAccount(acct.id)} className="text-xs text-red-500 hover:text-red-700">
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="text-gray-500">Per paycheck:</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="—"
                      value={acct.income_allocation || ''}
                      onChange={e => updateAccountField(acct.id, 'income_allocation', e.target.value || null)}
                      className="w-24 border border-gray-200 rounded px-2 py-1 text-gray-700"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Debt accounts */}
        {debtAccounts.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Debts</h3>
            {/* APR warning banner */}
            {debtAccounts.some(a => !a.interest_rate) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                <p className="text-xs font-semibold text-amber-800">Some accounts are using estimated APRs</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Accounts marked "est." use national averages, which may be off by 5-10%. Enter your real APR for accurate debt payoff calculations.
                  Check your latest statement or log into your lender's website.
                </p>
              </div>
            )}
            <div className="space-y-3">
              {debtAccounts.map(acct => (
                <div key={acct.id} className="border border-red-100 rounded-lg p-3 bg-red-50/30">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{acct.name}</p>
                      <span className="text-xs text-gray-500">{ACCOUNT_TYPES[acct.type] || acct.type}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {editingBalance === acct.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-400">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={editBalance}
                            onChange={e => setEditBalance(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveBalance(acct.id)}
                            className="w-28 text-sm border border-gray-300 rounded px-2 py-1"
                            autoFocus
                          />
                          <button onClick={() => saveBalance(acct.id)} className="text-xs text-indigo-600">Save</button>
                          <button onClick={() => setEditingBalance(null)} className="text-xs text-gray-400">Cancel</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingBalance(acct.id); setEditBalance(String(acct.current_balance || 0)); }}
                          className="text-sm font-semibold text-red-600 hover:text-red-700"
                          title="Click to edit balance owed"
                        >
                          ${(acct.current_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </button>
                      )}
                      <button onClick={() => removeAccount(acct.id)} className="text-xs text-red-500 hover:text-red-700">
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">APR:</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder={`~${DEFAULT_RATES[acct.type] || 22}`}
                        value={acct.interest_rate || ''}
                        onChange={e => updateAccountField(acct.id, 'interest_rate', e.target.value || null)}
                        className="w-16 border border-gray-200 rounded px-2 py-1 text-gray-700"
                      />
                      <span className="text-gray-400">%</span>
                      {!acct.interest_rate && (
                        <span className="text-amber-500 ml-1" title={RATE_HELP[acct.type]}>est.</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Min payment:</span>
                      <span className="text-gray-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="—"
                        value={acct.minimum_payment || ''}
                        onChange={e => updateAccountField(acct.id, 'minimum_payment', e.target.value || null)}
                        className="w-20 border border-gray-200 rounded px-2 py-1 text-gray-700"
                      />
                      {!acct.minimum_payment && (
                        <span className="text-amber-500" title="Estimated as 2% of balance">est.</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Import Data */}
      <ImportData />

      {/* Privacy & Data */}
      <PrivacySection />

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={logout}
          className="w-full bg-white border border-gray-200 rounded-lg py-2 text-sm text-red-600 hover:bg-red-50"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
