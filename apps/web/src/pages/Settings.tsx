import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, DollarSign, Landmark, Upload, Download, Shield, Users, CreditCard, PiggyBank, Trash2, LogOut, Crown, ChevronRight, AlertTriangle, Car, GraduationCap, Home, Banknote, Settings as SettingsIcon, ChevronDown, Plus, FileText, Calendar, Repeat, Wallet, BarChart3, RefreshCw, Target, Check, Sparkles } from 'lucide-react';
import api from '../api/client';
import { BUDGETABLE_CATEGORIES } from '@spenditure/shared';
import type { BudgetWithSuggestion } from '@spenditure/shared';
import { useAuth } from '../context/AuthContext';
import useTrack from '../hooks/useTrack';
import TellerConnectButton from '../components/TellerConnect';
import CancelSaveModal from '../components/CancelSaveModal';

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
  teller_account_id: string | null;
  institution_name: string | null;
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

function AccountTypeIcon({ type, className = 'w-4 h-4' }: { type: string; className?: string }) {
  switch (type) {
    case 'checking': return <Landmark className={`${className} text-indigo-500`} />;
    case 'savings': return <PiggyBank className={`${className} text-emerald-500`} />;
    case 'credit': return <CreditCard className={`${className} text-red-500`} />;
    case 'auto_loan': return <Car className={`${className} text-orange-500`} />;
    case 'student_loan': return <GraduationCap className={`${className} text-violet-500`} />;
    case 'mortgage': return <Home className={`${className} text-blue-500`} />;
    case 'personal_loan': return <Banknote className={`${className} text-slate-500`} />;
    default: return <Landmark className={`${className} text-slate-400`} />;
  }
}

const RATE_HELP: Record<string, string> = {
  credit: 'Check your statement or app - usually 18-30%',
  mortgage: 'On your loan statement or closing docs - usually 5-8%',
  auto_loan: 'On your loan agreement or payment portal - usually 5-12%',
  student_loan: 'On studentaid.gov or your servicer - usually 4-8%',
  personal_loan: 'On your loan agreement - usually 8-20%',
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

/* ───────── Section header outside cards (iOS-style) ───────── */
function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 px-1 mb-1.5">
      <Icon className="w-4 h-4 text-indigo-500" />
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</h2>
    </div>
  );
}

/* ───────── Generic settings row ───────── */
function SettingsRow({ children, last = false, className = '' }: { children: React.ReactNode; last?: boolean; className?: string }) {
  return (
    <div className={`px-4 py-3.5 ${!last ? 'border-b border-slate-100' : ''} ${className}`}>
      {children}
    </div>
  );
}

/* ───────── Budget Editor ───────── */
function BudgetEditor() {
  const [budgets, setBudgets] = useState<BudgetWithSuggestion[]>([]);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.get('/runway/budgets')
      .then(r => {
        const items: BudgetWithSuggestion[] = r.data.budgets || [];
        setBudgets(items);
        // Pre-fill edits with existing budget values
        const initial: Record<string, number> = {};
        for (const b of items) {
          if (b.monthly_limit > 0) initial[b.category] = b.monthly_limit;
        }
        setEdits(initial);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function setEditValue(category: string, value: string) {
    const num = parseFloat(value);
    if (value === '' || value === '0') {
      const next = { ...edits };
      delete next[category];
      setEdits(next);
    } else if (!isNaN(num) && num >= 0) {
      setEdits(prev => ({ ...prev, [category]: num }));
    }
  }

  function applySuggestions() {
    const next = { ...edits };
    for (const b of budgets) {
      if (b.suggested && !next[b.category]) {
        next[b.category] = b.suggested;
      }
    }
    setEdits(next);
  }

  async function saveBudgets() {
    setSaving(true);
    setSaved(false);
    try {
      // Build array: include categories that have a value OR had a value (to clear removed ones)
      const allCategories = new Set([
        ...budgets.map(b => b.category),
        ...Object.keys(edits),
      ]);
      const payload = [...allCategories].map(category => ({
        category,
        monthly_limit: edits[category] || 0,
      }));
      await api.put('/runway/budgets', { budgets: payload });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  }

  const hasEdits = budgets.some(b => {
    const edited = edits[b.category];
    const original = b.monthly_limit || 0;
    return (edited || 0) !== original;
  });

  const hasSuggestions = budgets.some(b => b.suggested && !edits[b.category]);

  return (
    <>
      <SectionHeader icon={Target} label="Monthly Budgets" />
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-700 font-medium">
              {Object.keys(edits).length > 0
                ? `${Object.keys(edits).length} budget${Object.keys(edits).length !== 1 ? 's' : ''} set`
                : 'Set spending limits by category'}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="border-t border-slate-100">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">Loading spending data...</div>
            ) : budgets.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-slate-500">No spending data yet.</p>
                <p className="text-xs text-slate-400 mt-1">Import transactions to see budget suggestions.</p>
              </div>
            ) : (
              <>
                {/* Suggest all button */}
                {hasSuggestions && (
                  <div className="px-4 py-2.5 bg-indigo-50/50 border-b border-slate-100">
                    <button
                      onClick={applySuggestions}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Apply all suggestions (based on your 3-month average)
                    </button>
                  </div>
                )}

                {/* Category rows */}
                <div className="divide-y divide-slate-100">
                  {budgets.map(b => {
                    const catDef = BUDGETABLE_CATEGORIES.find(c => c.name === b.category);
                    const isNecessity = catDef?.type === 'necessity';
                    return (
                      <div key={b.category} className="px-4 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-slate-700 truncate">{b.category}</p>
                            {isNecessity && (
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">need</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Spent ${b.currentSpend.toLocaleString()} this month
                            {b.suggested ? ` · Avg ~$${b.suggested}/mo` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-slate-400">$</span>
                          <input
                            type="number"
                            min="0"
                            step="25"
                            value={edits[b.category] ?? ''}
                            placeholder={b.suggested ? String(b.suggested) : '0'}
                            onChange={e => setEditValue(b.category, e.target.value)}
                            className="w-20 text-right text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                          />
                          <span className="text-xs text-slate-400">/mo</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Save bar */}
                <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-xs text-slate-400">
                    {saved ? (
                      <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Saved
                      </span>
                    ) : hasEdits ? (
                      'You have unsaved changes'
                    ) : (
                      'Set limits to get budget alerts'
                    )}
                  </p>
                  <button
                    onClick={saveBudgets}
                    disabled={saving || !hasEdits}
                    className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ───────── Import Data (redesigned as rows) ───────── */
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

  const keys = Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[];

  return (
    <>
      <SectionHeader icon={Upload} label="Import Data" />
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50/60 border-b border-slate-100">
          <p className="text-xs text-slate-400">Download a template, fill it in, then upload it back.</p>
        </div>
        {keys.map((key, i) => {
          const t = TEMPLATES[key];
          const result = results[key];
          return (
            <SettingsRow key={key} last={i === keys.length - 1}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{t.label}</p>
                    <p className="text-xs text-slate-400 truncate">{t.desc}</p>
                    {result && (
                      <p className={`text-xs mt-0.5 ${result.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                        {result.msg}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <button
                    onClick={() => downloadTemplate(key)}
                    className="text-xs font-medium text-indigo-600 active:text-indigo-800 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    Template
                  </button>
                  <button
                    onClick={() => fileRefs[key].current?.click()}
                    disabled={uploading === key}
                    className="text-xs font-medium bg-gradient-to-b from-indigo-500 to-indigo-600 text-white px-3.5 py-1.5 rounded-xl active:from-indigo-600 active:to-indigo-700 disabled:opacity-50 shadow-sm transition-all"
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
            </SettingsRow>
          );
        })}
      </div>
    </>
  );
}

interface TierInfo {
  tier: 'free' | 'plus' | 'pro';
  limits: Record<string, any>;
  trialDaysLeft?: number | null;
}

/* ───────── Privacy & Data section ───────── */
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
    <>
      <SectionHeader icon={Shield} label="Data & Privacy" />
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        {/* Export JSON row */}
        <SettingsRow>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <Download className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Export as JSON</p>
                <p className="text-xs text-slate-400">All your data in one file</p>
              </div>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="text-sm font-medium text-indigo-600 active:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50 disabled:opacity-50 transition-colors"
            >
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </SettingsRow>
        {/* Export CSV row */}
        <SettingsRow last>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Export as Spreadsheet</p>
                <p className="text-xs text-slate-400">CSV format for Excel / Sheets</p>
              </div>
            </div>
            <button
              onClick={handleExportCsv}
              disabled={exportingCsv}
              className="text-sm font-medium text-indigo-600 active:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50 disabled:opacity-50 transition-colors"
            >
              {exportingCsv ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </SettingsRow>
      </div>

      {/* Delete account - red-tinted separate card */}
      <div className="mt-4 bg-red-50/50 rounded-2xl shadow-sm border border-red-200/40 overflow-hidden">
        <SettingsRow last>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100/80 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-600">Delete Account</p>
                <p className="text-xs text-red-400">Permanently erase all data</p>
              </div>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="text-sm font-medium bg-gradient-to-b from-red-500 to-red-600 text-white px-4 py-1.5 rounded-xl hover:from-red-600 hover:to-red-700 shadow-sm transition-all"
            >
              Delete
            </button>
          </div>
        </SettingsRow>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm p-6 shadow-xl safe-area-bottom">
            <h3 className="text-lg font-semibold text-red-600 mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Delete Account
            </h3>
            <p className="text-sm text-slate-600 mb-1">
              This action is <strong>permanent and irreversible</strong>. All your data will be deleted immediately:
            </p>
            <ul className="text-xs text-slate-500 list-disc ml-4 mb-4 space-y-0.5">
              <li>Accounts and transactions</li>
              <li>Budgets and savings goals</li>
              <li>Chat history and AI insights</li>
              <li>All settings and preferences</li>
            </ul>
            <label className="block text-sm text-slate-700 mb-1">Enter your password to confirm</label>
            <input
              type="password"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDeleteAccount()}
              placeholder="Your password"
              className="w-full text-sm border border-slate-200 rounded-xl bg-slate-50 px-3 py-3 mb-3 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 outline-none transition-all"
              autoFocus
            />
            {deleteError && (
              <p className="text-xs text-red-600 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError(''); }}
                className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2.5 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || !deletePassword}
                className="text-sm bg-gradient-to-b from-red-500 to-red-600 text-white px-5 py-2.5 rounded-xl hover:from-red-600 hover:to-red-700 disabled:opacity-50 shadow-sm transition-all"
              >
                {deleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════
   Main Settings page
   ═══════════════════════════════════════════ */
export default function Settings() {
  const track = useTrack('settings');
  const [activeTab, setActiveTab] = useState<'profile' | 'accounts' | 'income' | 'data'>('profile');
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '', type: 'checking', balance: '', purpose: 'general',
    income_allocation: '', interest_rate: '', minimum_payment: ''
  });
  const [editingBalance, setEditingBalance] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [editingPaycheck, setEditingPaycheck] = useState(false);
  const [payFreq, setPayFreq] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payNextDate, setPayNextDate] = useState('');
  const [savingPaycheck, setSavingPaycheck] = useState(false);
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [expandedAcct, setExpandedAcct] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/settings')
      .then(r => {
        setData(r.data);
        setTierInfo({ tier: r.data.tier, limits: r.data.limits, trialDaysLeft: r.data.trialDaysLeft });
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleUpgrade() {
    track('settings', 'upgrade_pro');
    await api.post('/settings/upgrade');
    setTierInfo(t => t ? { ...t, tier: 'pro' } : null);
    setData(d => d ? { ...d, user: { ...d.user, subscription_status: 'active' } } : null);
  }

  async function handleDowngrade() {
    await api.post('/settings/downgrade');
    setTierInfo(t => t ? { ...t, tier: 'free' } : null);
    setData(d => d ? { ...d, user: { ...d.user, subscription_status: 'trial' } } : null);
  }

  async function syncBank() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const { data: result } = await api.post('/teller/sync');
      setSyncMsg(result.message || 'Synced!');
      // Refresh accounts
      const r = await api.get('/settings');
      setData(r.data);
      // Auto-retry if bank is still processing
      if (result.pendingTransactions) {
        setTimeout(() => {
          setSyncMsg(prev => prev ? prev + ' Retrying...' : 'Retrying...');
          syncBank();
        }, 30000); // retry in 30s
      } else {
        setTimeout(() => setSyncMsg(''), 5000);
      }
    } catch (err: any) {
      setSyncMsg(err.response?.data?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function disconnectBank() {
    if (!confirm('This will remove all bank-linked accounts and their transactions. You can reconnect anytime.')) return;
    try {
      await api.delete('/settings/bank');
      const r = await api.get('/settings');
      setData(r.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to disconnect');
    }
  }

  async function removeAccount(id: string) {
    await api.delete(`/settings/accounts/${id}`);
    setData(d => d ? { ...d, accounts: d.accounts.filter(a => a.id !== id) } : null);
  }

  async function addAccount() {
    if (!newAccount.name) return;
    const { data: acct } = await api.post('/settings/accounts', newAccount);
    setData(d => d ? { ...d, accounts: [...d.accounts, { ...acct, plaid_account_id: null, teller_account_id: null, last_synced_at: null }] } : null);
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

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );
  if (!data) return null;

  const cashAccounts = data.accounts.filter(a => CASH_TYPES.includes(a.type));
  const debtAccounts = data.accounts.filter(a => isDebtType(a.type));
  const freqLabel: Record<string, string> = { weekly: 'Weekly', biweekly: 'Every 2 weeks', twice_monthly: '1st & 15th', monthly: 'Monthly', irregular: 'Irregular / Variable' };
  const memberSince = data.user.created_at ? new Date(data.user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '';

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 pb-8">

      {/* ────────── PROFILE CARD ────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 px-5 py-6 flex items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/[0.03] rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-28 h-28 bg-white/[0.03] rounded-full translate-y-1/2 -translate-x-1/3" />
          {/* Avatar */}
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
            <span className="text-xl font-bold text-white">{data.user.email?.[0]?.toUpperCase() || 'U'}</span>
          </div>
          <div className="relative flex-1 min-w-0">
            <p className="text-base font-semibold text-white truncate">{data.user.email}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                tierInfo?.tier === 'pro'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-amber-900'
                  : tierInfo?.tier === 'plus'
                    ? 'bg-indigo-400/30 text-indigo-200'
                    : 'bg-white/15 text-white/80'
              }`}>
                {tierInfo?.tier === 'pro' ? 'Pro' : tierInfo?.tier === 'plus' ? 'Plus' : 'Free'}
              </span>
              {memberSince && (
                <span className="text-[11px] text-white/40">Member since {memberSince}</span>
              )}
            </div>
            {tierInfo?.tier !== 'pro' && (
              <Link to="/pricing" className="text-xs text-indigo-300 hover:text-indigo-200 mt-1.5 font-medium transition-colors inline-block">
                {tierInfo?.tier === 'plus' ? 'Upgrade to Pro' : 'View plans'} &rarr;
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ────────── TAB NAVIGATION ────────── */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {[
          { key: 'profile' as const, label: 'Profile' },
          { key: 'accounts' as const, label: 'Accounts' },
          { key: 'income' as const, label: 'Income' },
          { key: 'data' as const, label: 'Data' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 text-xs font-medium py-2.5 rounded-lg transition-all ${
              activeTab === tab.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ────────── PROFILE TAB ────────── */}
      {activeTab === 'profile' && (
        <>
          {/* Subscription */}
          {tierInfo?.tier !== 'pro' && (
            <Link to="/pricing" className="block bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-300" />
                    {tierInfo?.trialDaysLeft && tierInfo.trialDaysLeft > 0
                      ? `${tierInfo.trialDaysLeft} days left in your free trial`
                      : 'Upgrade your plan'}
                  </p>
                  <p className="text-xs text-white/70 mt-1">Starting at $7.99/mo. Bank sync, advisor, and more.</p>
                </div>
                <ChevronRight className="w-5 h-5 text-white/50" />
              </div>
            </Link>
          )}
          {(tierInfo?.tier === 'plus' || tierInfo?.tier === 'pro') && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <SettingsRow>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{tierInfo.tier === 'pro' ? 'Pro' : 'Plus'} Plan</p>
                    <p className="text-xs text-slate-400">{tierInfo.tier === 'pro' ? '$14.99' : '$7.99'}/month</p>
                  </div>
                  <button onClick={() => setShowCancelModal(true)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                    Manage subscription
                  </button>
                </div>
              </SettingsRow>
            </div>
          )}

          {/* Family */}
          <Link to="/family" className="block bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden hover:border-indigo-200 hover:shadow-md transition-all">
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Family</p>
                  <p className="text-xs text-slate-400">Invite members to share finances</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          </Link>

          {/* Budgets link */}
          <Link to="/budgets" className="block bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden hover:border-indigo-200 hover:shadow-md transition-all">
            <div className="px-4 py-3.5 flex items-center justify-between">
              <span className="text-sm text-slate-700 font-medium">Manage spending budgets</span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          </Link>
        </>
      )}

      {/* ────────── INCOME TAB ────────── */}
      {activeTab === 'income' && (
        <>

      {/* ────────── PAYCHECK / INCOME ────────── */}
      <SectionHeader icon={DollarSign} label="Income" />
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        {editingPaycheck ? (
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Pay frequency</label>
              <select
                value={payFreq}
                onChange={e => setPayFreq(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl bg-slate-50 px-3 py-3 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 outline-none transition-all"
              >
                <option value="">Select...</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="twice_monthly">Twice a month (1st & 15th)</option>
                <option value="monthly">Monthly</option>
                <option value="irregular">Irregular / Variable</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {payFreq === 'irregular' ? 'Average monthly income' : 'Take-home pay (per paycheck)'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-sm text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl bg-slate-50 pl-7 pr-3 py-3 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 outline-none transition-all"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Next payday</label>
              <input
                type="date"
                value={payNextDate}
                onChange={e => setPayNextDate(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl bg-slate-50 px-3 py-3 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setEditingPaycheck(false)}
                className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2.5 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={savePaycheck}
                disabled={savingPaycheck || !payFreq || !payAmount || !payNextDate}
                className="text-sm bg-gradient-to-b from-indigo-500 to-indigo-600 text-white px-5 py-2.5 rounded-xl hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-500/25 transition-all"
              >
                {savingPaycheck ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Frequency row */}
            <SettingsRow>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <Repeat className="w-4 h-4 text-indigo-500" />
                  </div>
                  <span className="text-sm text-slate-500">Pay frequency</span>
                </div>
                <button onClick={startEditPaycheck} className="text-sm font-medium text-slate-900 hover:text-indigo-600 transition-colors">
                  {freqLabel[data.user.pay_frequency] || data.user.pay_frequency?.replace('_', ' ') || 'Not set'}
                </button>
              </div>
            </SettingsRow>
            {/* Amount row */}
            <SettingsRow>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span className="text-sm text-slate-500">Take-home pay</span>
                </div>
                <button onClick={startEditPaycheck} className="text-sm font-semibold text-slate-900 hover:text-indigo-600 transition-colors">
                  {data.user.take_home_pay ? `$${data.user.take_home_pay.toLocaleString()}` : 'Not set'}
                </button>
              </div>
            </SettingsRow>
            {/* Next payday row */}
            <SettingsRow last>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4 text-amber-500" />
                  </div>
                  <span className="text-sm text-slate-500">Next payday</span>
                </div>
                <button onClick={startEditPaycheck} className="text-sm font-medium text-slate-900 hover:text-indigo-600 transition-colors">
                  {data.user.next_payday ? new Date(data.user.next_payday + 'T00:00:00').toLocaleDateString() : 'Not set'}
                </button>
              </div>
            </SettingsRow>
          </>
        )}
      </div>

        </>
      )}

      {/* ────────── ACCOUNTS TAB ────────── */}
      {activeTab === 'accounts' && (
        <>

      {/* ────────── ACCOUNTS ────────── */}
      <SectionHeader icon={Landmark} label="Accounts" />
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        {/* Cash sub-header */}
        {cashAccounts.length > 0 && (
          <>
            <div className="px-4 pt-3 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <PiggyBank className="w-3 h-3" /> Cash
              </p>
            </div>
            {cashAccounts.map((acct, i) => (
              <div key={acct.id}>
                <SettingsRow last={i === cashAccounts.length - 1 && debtAccounts.length === 0}>
                  {/* Main row: tap to expand */}
                  <div
                    className="flex items-center justify-between cursor-pointer -mx-4 -my-3.5 px-4 py-3.5 active:bg-slate-50 transition-colors"
                    onClick={() => setExpandedAcct(expandedAcct === acct.id ? null : acct.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                        <AccountTypeIcon type={acct.type} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{acct.name}</p>
                        <p className="text-xs text-slate-400">
                          {acct.institution_name ? `${acct.institution_name} · ` : ''}{ACCOUNT_TYPES[acct.type] || acct.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {editingBalance === acct.id ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <span className="text-sm text-slate-400">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={editBalance}
                            onChange={e => setEditBalance(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveBalance(acct.id)}
                            className="w-24 text-sm border border-slate-200 rounded-xl bg-slate-50 px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                            autoFocus
                          />
                          <button onClick={() => saveBalance(acct.id)} className="text-xs font-medium text-indigo-600">Save</button>
                          <button onClick={() => setEditingBalance(null)} className="text-xs text-slate-400">Cancel</button>
                        </div>
                      ) : (
                        <span className="text-sm font-semibold text-slate-900 tabular-nums">
                          ${(acct.current_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      )}
                      <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${expandedAcct === acct.id ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expandedAcct === acct.id && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Purpose</span>
                        <select
                          value={acct.purpose || 'general'}
                          onChange={e => updateAccountField(acct.id, 'purpose', e.target.value)}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-700 bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                        >
                          {Object.entries(PURPOSE_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Per paycheck</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-400">$</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="--"
                            value={acct.income_allocation || ''}
                            onChange={e => updateAccountField(acct.id, 'income_allocation', e.target.value || null)}
                            className="w-20 text-xs border border-slate-200 rounded-lg bg-slate-50 px-2 py-1 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Balance</span>
                        <button
                          onClick={() => { setEditingBalance(acct.id); setEditBalance(String(acct.current_balance || 0)); }}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          Edit balance
                        </button>
                      </div>
                      <div className="pt-1">
                        <button onClick={() => removeAccount(acct.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">
                          Remove account
                        </button>
                      </div>
                    </div>
                  )}
                </SettingsRow>
                {/* Divider between cash and debt if needed */}
                {i === cashAccounts.length - 1 && debtAccounts.length > 0 && (
                  <div className="border-b border-slate-100" />
                )}
              </div>
            ))}
          </>
        )}

        {/* Debt sub-header */}
        {debtAccounts.length > 0 && (
          <>
            <div className="px-4 pt-3 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <CreditCard className="w-3 h-3" /> Debt
              </p>
            </div>
            {/* APR warning */}
            {debtAccounts.some(a => !a.interest_rate) && (
              <div className="mx-4 mb-2 bg-amber-50 border border-amber-200/60 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Some accounts use estimated APRs
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Enter your real APR for accurate payoff calculations. Check your latest statement.
                </p>
              </div>
            )}
            {debtAccounts.map((acct, i) => (
              <SettingsRow key={acct.id} last={i === debtAccounts.length - 1}>
                {/* Main row */}
                <div
                  className="flex items-center justify-between cursor-pointer -mx-4 -my-3.5 px-4 py-3.5 active:bg-slate-50 transition-colors"
                  onClick={() => setExpandedAcct(expandedAcct === acct.id ? null : acct.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                      <AccountTypeIcon type={acct.type} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{acct.name}</p>
                      <p className="text-xs text-slate-400">
                        {acct.institution_name ? `${acct.institution_name} · ` : ''}{ACCOUNT_TYPES[acct.type] || acct.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {editingBalance === acct.id ? (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <span className="text-sm text-slate-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={editBalance}
                          onChange={e => setEditBalance(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveBalance(acct.id)}
                          className="w-24 text-sm border border-slate-200 rounded-xl bg-slate-50 px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                          autoFocus
                        />
                        <button onClick={() => saveBalance(acct.id)} className="text-xs font-medium text-indigo-600">Save</button>
                        <button onClick={() => setEditingBalance(null)} className="text-xs text-slate-400">Cancel</button>
                      </div>
                    ) : (
                      <span className="text-sm font-semibold text-red-600 tabular-nums">
                        ${(acct.current_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${expandedAcct === acct.id ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedAcct === acct.id && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">APR</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          placeholder={`~${DEFAULT_RATES[acct.type] || 22}`}
                          value={acct.interest_rate || ''}
                          onChange={e => updateAccountField(acct.id, 'interest_rate', e.target.value || null)}
                          className="w-16 text-xs border border-slate-200 rounded-lg bg-slate-50 px-2 py-1 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-right"
                        />
                        <span className="text-xs text-slate-400">%</span>
                        {!acct.interest_rate && (
                          <span className="text-amber-500 text-xs ml-1" title={RATE_HELP[acct.type]}>est.</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Min payment</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="--"
                          value={acct.minimum_payment || ''}
                          onChange={e => updateAccountField(acct.id, 'minimum_payment', e.target.value || null)}
                          className="w-20 text-xs border border-slate-200 rounded-lg bg-slate-50 px-2 py-1 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-right"
                        />
                        {!acct.minimum_payment && (
                          <span className="text-amber-500 text-xs" title="Estimated as 2% of balance">est.</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Balance</span>
                      <button
                        onClick={() => { setEditingBalance(acct.id); setEditBalance(String(acct.current_balance || 0)); }}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        Edit balance
                      </button>
                    </div>
                    <div className="pt-1">
                      <button onClick={() => removeAccount(acct.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">
                        Remove account
                      </button>
                    </div>
                  </div>
                )}
              </SettingsRow>
            ))}
          </>
        )}

        {data.accounts.length === 0 && (
          <div className="px-4 py-8 text-center">
            <Landmark className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No accounts yet</p>
            <p className="text-xs text-slate-400 mt-0.5">Add one to get started</p>
          </div>
        )}

        {/* Add account button / slide-down panel */}
        {showAddAccount ? (
          <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">New Account</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Name (e.g. Chase Visa)"
                value={newAccount.name}
                onChange={e => setNewAccount({ ...newAccount, name: e.target.value })}
                className="sm:col-span-2 text-sm border border-slate-200 rounded-xl bg-white px-3 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
              <select
                value={newAccount.type}
                onChange={e => {
                  const t = e.target.value;
                  const rate = DEFAULT_RATES[t];
                  setNewAccount({ ...newAccount, type: t, interest_rate: rate ? String(rate) : '' });
                }}
                className="text-sm border border-slate-200 rounded-xl bg-white px-3 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="number"
                step="0.01"
                placeholder={isDebtType(newAccount.type) ? 'Amount owed' : 'Current balance'}
                value={newAccount.balance}
                onChange={e => setNewAccount({ ...newAccount, balance: e.target.value })}
                className="text-sm border border-slate-200 rounded-xl bg-white px-3 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
              {!isDebtType(newAccount.type) ? (
                <select
                  value={newAccount.purpose}
                  onChange={e => setNewAccount({ ...newAccount, purpose: e.target.value })}
                  className="text-sm border border-slate-200 rounded-xl bg-white px-3 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
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
                  className="text-sm border border-slate-200 rounded-xl bg-white px-3 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              )}
            </div>

            {isDebtType(newAccount.type) && (
              <div className="space-y-1">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Monthly minimum payment"
                  value={newAccount.minimum_payment}
                  onChange={e => setNewAccount({ ...newAccount, minimum_payment: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-xl bg-white px-3 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
                <p className="text-xs text-slate-400 px-1">
                  Don't know your rate? We'll estimate ~{DEFAULT_RATES[newAccount.type] || 22}%. {RATE_HELP[newAccount.type] || ''}
                </p>
              </div>
            )}

            {CASH_TYPES.includes(newAccount.type) && (
              <div>
                <input
                  type="number"
                  step="0.01"
                  placeholder="How much of each paycheck goes here? (optional)"
                  value={newAccount.income_allocation}
                  onChange={e => setNewAccount({ ...newAccount, income_allocation: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-xl bg-white px-3 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
                <p className="text-xs text-slate-400 mt-1 px-1">e.g. $935 if you send $935 from each paycheck to this account</p>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setShowAddAccount(false)} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2.5 rounded-xl">
                Cancel
              </button>
              <button onClick={addAccount} className="text-sm bg-gradient-to-b from-indigo-500 to-indigo-600 text-white px-5 py-2.5 rounded-xl hover:from-indigo-600 hover:to-indigo-700 shadow-lg shadow-indigo-500/25 transition-all">
                Add Account
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-dashed border-slate-200">
            <button
              onClick={() => setShowAddAccount(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50/50 active:bg-indigo-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          </div>
        )}

        {/* Sync bank + CSV upload */}
        {!showAddAccount && (
          <>
            {data?.accounts.some(a => a.teller_account_id) && (
              <>
                <div className="border-t border-slate-100">
                  <button
                    onClick={syncBank}
                    disabled={syncing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50/50 active:bg-emerald-50 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Sync Bank Accounts'}
                    {syncMsg && <span className="text-xs text-slate-500 ml-2">{syncMsg}</span>}
                  </button>
                </div>
                <div className="border-t border-slate-100">
                  <button
                    onClick={disconnectBank}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs text-red-400 hover:text-red-600 hover:bg-red-50/50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Disconnect Bank & Remove Linked Accounts
                  </button>
                </div>
              </>
            )}
            <div className="border-t border-slate-100 px-4 py-3.5 flex justify-center">
              <TellerConnectButton onSuccess={async () => {
                const r = await api.get('/settings');
                setData(r.data);
              }} />
            </div>
            <div className="border-t border-slate-100">
              <button
                onClick={() => navigate('/csv-upload')}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs text-slate-400 hover:text-indigo-600 hover:bg-slate-50/50 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                Or upload accounts via CSV
              </button>
            </div>
          </>
        )}
      </div>

        </>
      )}

      {/* ────────── DATA TAB ────────── */}
      {activeTab === 'data' && (
        <>
          <PrivacySection />

        </>
      )}

      {/* ────────── LOGOUT ────────── */}
      <div className="pt-2 pb-4">
        <button
          onClick={logout}
          className="w-full bg-white border border-slate-200/60 rounded-2xl shadow-sm py-3.5 text-sm font-medium text-red-500 hover:bg-red-50 active:bg-red-100 transition-all flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </button>
      </div>

      {/* Cancellation save modal */}
      {showCancelModal && tierInfo && (tierInfo.tier === 'plus' || tierInfo.tier === 'pro') && (
        <CancelSaveModal
          tier={tierInfo.tier as 'plus' | 'pro'}
          onClose={() => setShowCancelModal(false)}
          onContinue={async () => {
            setShowCancelModal(false);
            try {
              const { data: portal } = await api.post('/stripe/portal');
              if (portal.url) window.location.href = portal.url;
            } catch {}
          }}
        />
      )}
    </div>
  );
}
