import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

interface Account {
  id: string;
  name: string;
  type: string;
}

interface PaySchedule {
  detected: boolean;
  frequency: string | null;
  amount: number | null;
  nextPayday: string | null;
  confidence: string;
}

interface RecurringExpense {
  name: string;
  monthlyAmount: number;
  frequency: string;
}

interface DetectedDebt {
  merchantName: string;
  displayName: string;
  suggestedType: string;
  monthlyAmount: number;
  occurrences: number;
  lastPaymentDate: string;
}

interface ImportResult {
  imported: number;
  skippedDupes: number;
  categoriesBackfilled: number;
  accountId: string;
  recurringDetected: number;
  aiClassified: number;
  paySchedule: PaySchedule;
  recurringExpenses: RecurringExpense[];
  detectedDebtPayments: DetectedDebt[];
}

export default function CsvUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][] | null>(null);
  const [totalRows, setTotalRows] = useState(0);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');

  // Post-import wizard steps
  const [step, setStep] = useState<'balance' | 'debts' | 'pay' | 'done'>('balance');

  // Debt account additions
  const [addingDebt, setAddingDebt] = useState<string | null>(null);
  const [debtBalance, setDebtBalance] = useState('');
  const [debtApr, setDebtApr] = useState('');
  const [debtType, setDebtType] = useState('');
  const [addedDebts, setAddedDebts] = useState<Set<string>>(new Set());

  // Balance entry
  const [balanceInput, setBalanceInput] = useState('');
  const [savingBalance, setSavingBalance] = useState(false);

  // Pay schedule
  const [editFreq, setEditFreq] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editNextPayday, setEditNextPayday] = useState('');
  const [savingPay, setSavingPay] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    api.get('/settings').then(r => {
      setAccounts(r.data.accounts);
    });
  }, []);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError('');
    setResult(null);
    setStep('balance');

    const form = new FormData();
    form.append('file', f);

    try {
      const { data } = await api.post('/csv/preview', form);
      setPreview(data.preview);
      setTotalRows(data.totalRows);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to parse CSV');
      setPreview(null);
    }
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setError('');

    const form = new FormData();
    form.append('file', file);
    if (selectedAccount) form.append('accountId', selectedAccount);

    try {
      const { data } = await api.post('/csv/import', form);
      setResult(data);
      setStep('balance');
      // Pre-fill editable pay fields from detection
      if (data.paySchedule?.detected) {
        setEditFreq(data.paySchedule.frequency || 'biweekly');
        setEditAmount(String(data.paySchedule.amount || ''));
        setEditNextPayday(data.paySchedule.nextPayday || '');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to import');
    } finally {
      setImporting(false);
    }
  }

  async function saveBalance() {
    if (!balanceInput || !result) return;
    setSavingBalance(true);
    try {
      await api.patch(`/settings/accounts/${result.accountId}`, {
        balance: parseFloat(balanceInput),
      });
      // Go to debts step if there are detected debt payments, otherwise pay
      if (result.detectedDebtPayments?.length > 0) {
        setStep('debts');
      } else {
        setStep('pay');
      }
    } catch {
      setError('Failed to save balance');
    } finally {
      setSavingBalance(false);
    }
  }

  async function savePaySchedule() {
    if (!editFreq || !editAmount || !editNextPayday) return;
    setSavingPay(true);
    try {
      await api.put('/runway/paycheck', {
        pay_frequency: editFreq,
        next_payday: editNextPayday,
        take_home_pay: parseFloat(editAmount),
      });
      setStep('done');
    } catch {
      setError('Failed to save pay schedule');
    } finally {
      setSavingPay(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Upload CSV</h1>
        <p className="text-sm text-gray-500">Import bank transactions from a CSV export. Supports Chase, BofA, Wells Fargo, Capital One, Discover, and most banks.</p>
      </div>

      {/* File picker */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Select CSV file</span>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
          />
        </label>

        {accounts.length > 0 && (
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Import into account</span>
            <select
              value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)}
              className="mt-1 block w-full text-sm border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Create new "CSV Import" account</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm p-4 rounded-lg">{error}</div>}

      {/* Preview */}
      {preview && !result && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <p className="text-sm font-medium text-gray-700">
              Preview — {totalRows} transactions detected
            </p>
            {totalRows === 0 && (
              <p className="text-xs text-red-500 mt-1">
                No transactions could be parsed. Make sure your CSV has columns for date and amount.
              </p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {preview[0].map((header, i) => (
                    <th key={i} className="text-left px-4 py-2 text-gray-500 font-medium">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(1).map((row, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {row.map((cell, j) => (
                      <td key={j} className="px-4 py-2 text-gray-700">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalRows > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={handleImport}
                disabled={importing}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {importing ? 'Importing...' : `Import ${totalRows} transactions`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Post-import flow */}
      {result && (
        <div className="space-y-4">
          {/* Import success banner */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 font-medium">
              Imported {result.imported} transactions
              {result.recurringDetected > 0 && ` — found ${result.recurringDetected} recurring`}
            </p>
            {result.skippedDupes > 0 && (
              <p className="text-green-600 text-sm mt-1">
                {result.skippedDupes} duplicate{result.skippedDupes > 1 ? 's' : ''} skipped.
                {result.categoriesBackfilled > 0 && ` Updated ${result.categoriesBackfilled} transaction categories.`}
              </p>
            )}
            {result.aiClassified > 0 && (
              <p className="text-indigo-600 text-sm mt-1 flex items-center gap-1">
                <span>&#x2728;</span> AI auto-classified {result.aiClassified} merchant{result.aiClassified > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Detected recurring expenses */}
          {result.recurringExpenses && result.recurringExpenses.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Detected recurring expenses</h3>
                <p className="text-sm text-gray-500 mt-1">
                  These will show up in your Paycheck Plan as bills to set aside for. Remove any that aren't real bills.
                </p>
              </div>
              <div className="divide-y divide-gray-100">
                {result.recurringExpenses.slice(0, 10).map((exp, i) => (
                  <div key={i} className="flex justify-between items-center py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{exp.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{exp.frequency}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-gray-900">
                        ${exp.monthlyAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo
                      </p>
                      <button
                        onClick={async () => {
                          await api.post('/csv/recurring/remove', { merchantName: exp.name });
                          setResult({ ...result, recurringExpenses: result.recurringExpenses.filter((_, j) => j !== i) });
                        }}
                        className="text-red-400 hover:text-red-600 text-xs"
                        title="Not a bill — remove"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {result.recurringExpenses.length > 10 && (
                <p className="text-xs text-gray-500">
                  +{result.recurringExpenses.length - 10} more — view all in Settings
                </p>
              )}
            </div>
          )}

          {/* Step 1: Enter actual balance */}
          {step === 'balance' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-amber-900">What's your current balance?</h3>
                <p className="text-sm text-amber-700 mt-1">
                  Your CSV only has transactions — we need your actual account balance so the numbers are right.
                  Check your bank app and enter what it says right now.
                </p>
              </div>
              <div className="flex gap-3 items-end">
                <label className="flex-1 block">
                  <span className="text-xs font-medium text-gray-600">Current balance</span>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      value={balanceInput}
                      onChange={e => setBalanceInput(e.target.value)}
                      placeholder="e.g. 1,250"
                      className="block w-full text-sm border border-gray-300 rounded-md pl-7 pr-3 py-2"
                    />
                  </div>
                </label>
                <button
                  onClick={saveBalance}
                  disabled={savingBalance || !balanceInput}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingBalance ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setStep(result?.detectedDebtPayments?.length ? 'debts' : 'pay')}
                  className="text-sm text-gray-500 hover:text-gray-700 py-2"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Detected debt payments */}
          {step === 'debts' && result?.detectedDebtPayments && result.detectedDebtPayments.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-5 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-rose-900">We found loan payments in your transactions</h3>
                <p className="text-sm text-rose-700 mt-1">
                  These look like monthly debt payments. Add them so we can track your payoff and give smarter advice.
                </p>
              </div>
              <div className="space-y-3">
                {result.detectedDebtPayments.map((debt) => {
                  const isAdded = addedDebts.has(debt.merchantName);
                  const isExpanded = addingDebt === debt.merchantName;
                  const typeLabels: Record<string, string> = {
                    credit: 'Credit Card',
                    mortgage: 'Mortgage',
                    auto_loan: 'Auto Loan',
                    student_loan: 'Student Loan',
                    personal_loan: 'Personal Loan',
                  };

                  return (
                    <div key={debt.merchantName} className={`bg-white rounded-lg border ${isAdded ? 'border-green-200 bg-green-50' : 'border-rose-100'} p-4`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">{debt.displayName}</p>
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {typeLabels[debt.suggestedType] || debt.suggestedType}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {debt.occurrences} payments found · last: {new Date(debt.lastPaymentDate + 'T00:00:00').toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-semibold text-rose-700">
                            ${debt.monthlyAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo
                          </p>
                          {isAdded ? (
                            <span className="text-xs text-green-600 font-medium">✓ Added</span>
                          ) : (
                            <button
                              onClick={() => {
                                if (isExpanded) {
                                  setAddingDebt(null);
                                } else {
                                  setAddingDebt(debt.merchantName);
                                  setDebtBalance('');
                                  setDebtApr('');
                                  setDebtType(debt.suggestedType);
                                }
                              }}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
                            >
                              {isExpanded ? 'Cancel' : 'Add as debt'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded form for adding balance + APR */}
                      {isExpanded && !isAdded && (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                          <p className="text-xs text-gray-500">
                            We know the monthly payment. Confirm the type and enter details if you know them — or skip and add later.
                          </p>
                          <label className="block">
                            <span className="text-xs font-medium text-gray-600">Debt type</span>
                            <select
                              value={debtType}
                              onChange={e => setDebtType(e.target.value)}
                              className="mt-1 block w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white"
                            >
                              <option value="credit">Credit Card</option>
                              <option value="mortgage">Mortgage</option>
                              <option value="auto_loan">Auto Loan</option>
                              <option value="student_loan">Student Loan</option>
                              <option value="personal_loan">Personal Loan</option>
                            </select>
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                              <span className="text-xs font-medium text-gray-600">Total balance owed</span>
                              <div className="relative mt-1">
                                <span className="absolute left-2.5 top-1.5 text-gray-400 text-sm">$</span>
                                <input
                                  type="number"
                                  value={debtBalance}
                                  onChange={e => setDebtBalance(e.target.value)}
                                  placeholder="e.g. 15000"
                                  className="block w-full text-sm border border-gray-300 rounded-md pl-6 pr-3 py-1.5"
                                />
                              </div>
                            </label>
                            <label className="block">
                              <span className="text-xs font-medium text-gray-600">Interest rate (APR %)</span>
                              <div className="relative mt-1">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={debtApr}
                                  onChange={e => setDebtApr(e.target.value)}
                                  placeholder="e.g. 6.5"
                                  className="block w-full text-sm border border-gray-300 rounded-md px-3 py-1.5"
                                />
                                <span className="absolute right-2.5 top-1.5 text-gray-400 text-sm">%</span>
                              </div>
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  await api.post('/csv/add-debt', {
                                    name: debt.displayName,
                                    type: debtType || debt.suggestedType,
                                    monthlyPayment: debt.monthlyAmount,
                                    balance: debtBalance || undefined,
                                    interestRate: debtApr || undefined,
                                  });
                                  setAddedDebts(prev => new Set([...prev, debt.merchantName]));
                                  setAddingDebt(null);
                                } catch {
                                  setError('Failed to add debt account');
                                }
                              }}
                              className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-indigo-700"
                            >
                              Add debt account
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  await api.post('/csv/add-debt', {
                                    name: debt.displayName,
                                    type: debtType || debt.suggestedType,
                                    monthlyPayment: debt.monthlyAmount,
                                  });
                                  setAddedDebts(prev => new Set([...prev, debt.merchantName]));
                                  setAddingDebt(null);
                                } catch {
                                  setError('Failed to add debt account');
                                }
                              }}
                              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5"
                            >
                              Skip details, just add
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep('pay')}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
                >
                  Continue
                </button>
                <button
                  onClick={() => setStep('pay')}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Skip all
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Pay schedule — editable */}
          {step === 'pay' && (
            <>
              {result.paySchedule?.detected ? (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-5 space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-indigo-900">Set up your pay schedule</h3>
                    <p className="text-sm text-indigo-700 mt-1">
                      We guessed from your deposits — fix anything that's wrong:
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">How often are you paid?</span>
                      <select
                        value={editFreq}
                        onChange={e => setEditFreq(e.target.value)}
                        className="mt-1 block w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-white"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Every 2 weeks</option>
                        <option value="twice_monthly">Twice a month</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">Take-home per paycheck</span>
                      <input
                        type="number"
                        value={editAmount}
                        onChange={e => setEditAmount(e.target.value)}
                        placeholder="e.g. 2800"
                        className="mt-1 block w-full text-sm border border-gray-300 rounded-md px-3 py-2"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">Next payday</span>
                      <input
                        type="date"
                        value={editNextPayday}
                        onChange={e => setEditNextPayday(e.target.value)}
                        className="mt-1 block w-full text-sm border border-gray-300 rounded-md px-3 py-2"
                      />
                    </label>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={savePaySchedule}
                      disabled={savingPay || !editFreq || !editAmount || !editNextPayday}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {savingPay ? 'Saving...' : 'Save pay schedule'}
                    </button>
                    <button
                      onClick={() => setStep('done')}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ) : (
                // No pay detected — let them enter manually
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Set up your pay schedule</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      We couldn't detect your paychecks automatically. You can enter it now or set it up later in Settings.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">How often are you paid?</span>
                      <select
                        value={editFreq}
                        onChange={e => setEditFreq(e.target.value)}
                        className="mt-1 block w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-white"
                      >
                        <option value="">Select...</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Every 2 weeks</option>
                        <option value="twice_monthly">Twice a month</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">Take-home per paycheck</span>
                      <input
                        type="number"
                        value={editAmount}
                        onChange={e => setEditAmount(e.target.value)}
                        placeholder="e.g. 2800"
                        className="mt-1 block w-full text-sm border border-gray-300 rounded-md px-3 py-2"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">Next payday</span>
                      <input
                        type="date"
                        value={editNextPayday}
                        onChange={e => setEditNextPayday(e.target.value)}
                        className="mt-1 block w-full text-sm border border-gray-300 rounded-md px-3 py-2"
                      />
                    </label>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={savePaySchedule}
                      disabled={savingPay || !editFreq || !editAmount || !editNextPayday}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {savingPay ? 'Saving...' : 'Save pay schedule'}
                    </button>
                    <button
                      onClick={() => setStep('done')}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Skip — I'll do it in Settings
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
              You're all set! Your data is ready.
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/')}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
            >
              Go to dashboard
            </button>
            <button
              onClick={() => { setFile(null); setPreview(null); setResult(null); setStep('balance'); setBalanceInput(''); }}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
            >
              Upload another CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
