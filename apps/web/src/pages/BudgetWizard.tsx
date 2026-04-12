import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt, CreditCard, Wallet, DollarSign, CheckCircle,
  Plus, Trash2, ChevronRight, ChevronLeft, Sparkles, Shield,
} from 'lucide-react';
import api from '../api/client';
import { BUDGETABLE_CATEGORIES } from '@spenditure/shared';

/* ── Types ──────────────────────────────────────────────── */

interface BillItem {
  name: string;
  monthlyAmount: number;
  type: 'bill' | 'debt' | 'subscription' | 'remove';
  category: string;
  apr?: number;
  minimumPayment?: number;
}

interface DebtItem {
  id?: string; // existing account ID
  name: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  type: string;
}

interface BudgetItem {
  category: string;
  monthlyAvg: number;
  suggested: number;
  monthlyLimit: number;
}

interface IncomeData {
  payFrequency: string;
  takeHomePay: number;
  nextPayday: string;
  isVariable: boolean;
  detectedMonthly: number;
}

/* ── Progress Bar ───────────────────────────────────────── */

const STEPS = ['Bills', 'Debt', 'Spending', 'Income', 'Review'];

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i < step ? 'bg-emerald-500 text-white'
                : i === step ? 'bg-indigo-600 text-white'
                : 'bg-slate-200 text-slate-400'
            }`}>
              {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${
              i <= step ? 'text-slate-700' : 'text-slate-400'
            }`}>{label}</span>
          </div>
        ))}
      </div>
      <div className="w-full bg-slate-200 rounded-full h-1.5">
        <div className="h-1.5 rounded-full bg-indigo-600 transition-all duration-300"
          style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} />
      </div>
    </div>
  );
}

/* ── Step 1: Bills ──────────────────────────────────────── */

function StepBills({ bills, onChange }: { bills: BillItem[]; onChange: (b: BillItem[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const activeBills = bills.filter(b => b.type !== 'remove');

  function updateBill(idx: number, updates: Partial<BillItem>) {
    const next = [...bills];
    next[idx] = { ...next[idx], ...updates };
    onChange(next);
  }

  function addBill() {
    if (!newName || !newAmount) return;
    onChange([...bills, { name: newName, monthlyAmount: parseFloat(newAmount), type: 'bill', category: 'Bills' }]);
    setNewName(''); setNewAmount(''); setAdding(false);
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <Receipt className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Confirm Your Bills</h2>
          <p className="text-sm text-slate-500">We detected these recurring charges. Confirm what each one is.</p>
        </div>
      </div>

      {activeBills.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">No recurring bills detected. Add your bills below.</p>
      )}

      <div className="space-y-2 mt-4">
        {bills.map((bill, i) => {
          if (bill.type === 'remove') return null;
          return (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <input value={bill.name} onChange={e => updateBill(i, { name: e.target.value })}
                    className="text-sm font-medium text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-400 focus:outline-none w-full" />
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-slate-400">$</span>
                    <input type="number" value={bill.monthlyAmount} onChange={e => updateBill(i, { monthlyAmount: parseFloat(e.target.value) || 0 })}
                      className="text-xs text-slate-600 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-400 focus:outline-none w-16" />
                    <span className="text-xs text-slate-400">/mo</span>
                  </div>
                </div>
                <select value={bill.type} onChange={e => updateBill(i, { type: e.target.value as BillItem['type'] })}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700">
                  <option value="bill">Bill</option>
                  <option value="debt">Debt Payment</option>
                  <option value="subscription">Subscription</option>
                  <option value="remove">Not a bill</option>
                </select>
                <button onClick={() => updateBill(i, { type: 'remove' })} className="text-slate-300 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {bill.type === 'debt' && (
                <div className="flex gap-3 mt-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">APR:</span>
                    <input type="number" step="0.1" value={bill.apr || ''} placeholder="0" onChange={e => updateBill(i, { apr: parseFloat(e.target.value) || 0 })}
                      className="text-xs w-14 border border-slate-200 rounded px-1.5 py-1 text-right" />
                    <span className="text-[10px] text-slate-400">%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">Min:</span>
                    <span className="text-[10px] text-slate-400">$</span>
                    <input type="number" value={bill.minimumPayment || ''} placeholder="0" onChange={e => updateBill(i, { minimumPayment: parseFloat(e.target.value) || 0 })}
                      className="text-xs w-16 border border-slate-200 rounded px-1.5 py-1 text-right" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className="mt-3 bg-slate-50 rounded-xl p-3 flex items-center gap-2">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Bill name"
            className="flex-1 text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5" />
          <input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="$/mo"
            className="w-20 text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5" />
          <button onClick={addBill} className="text-sm font-medium text-indigo-600 hover:text-indigo-700 px-2">Add</button>
          <button onClick={() => setAdding(false)} className="text-sm text-slate-400 px-2">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 py-2.5 rounded-xl border border-dashed border-indigo-200 hover:border-indigo-300 transition-colors">
          <Plus className="w-4 h-4" /> Add a bill
        </button>
      )}
    </div>
  );
}

/* ── Step 2: Debt ───────────────────────────────────────── */

function StepDebt({ debts, onChange }: { debts: DebtItem[]; onChange: (d: DebtItem[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [newDebt, setNewDebt] = useState({ name: '', balance: '', apr: '', minimumPayment: '', type: 'credit' });

  function updateDebt(idx: number, updates: Partial<DebtItem>) {
    const next = [...debts];
    next[idx] = { ...next[idx], ...updates };
    onChange(next);
  }

  function addDebt() {
    if (!newDebt.name || !newDebt.balance) return;
    onChange([...debts, {
      name: newDebt.name,
      balance: parseFloat(newDebt.balance) || 0,
      apr: parseFloat(newDebt.apr) || 0,
      minimumPayment: parseFloat(newDebt.minimumPayment) || 0,
      type: newDebt.type,
    }]);
    setNewDebt({ name: '', balance: '', apr: '', minimumPayment: '', type: 'credit' });
    setAdding(false);
  }

  const DEBT_TYPES: Record<string, string> = {
    credit: 'Credit Card', mortgage: 'Mortgage', auto_loan: 'Auto Loan',
    student_loan: 'Student Loan', personal_loan: 'Personal Loan',
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Confirm Your Debt</h2>
          <p className="text-sm text-slate-500">Verify balances and interest rates for accurate payoff plans.</p>
        </div>
      </div>

      {debts.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">No debts detected. Add any debts below, or skip this step.</p>
      )}

      <div className="space-y-2 mt-4">
        {debts.map((debt, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-3 mb-2">
              <input value={debt.name} onChange={e => updateDebt(i, { name: e.target.value })}
                className="flex-1 text-sm font-medium text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-400 focus:outline-none" />
              <select value={debt.type} onChange={e => updateDebt(i, { type: e.target.value })}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
                {Object.entries(DEBT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button onClick={() => onChange(debts.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block">Balance</label>
                <div className="flex items-center gap-0.5">
                  <span className="text-xs text-slate-400">$</span>
                  <input type="number" value={debt.balance || ''} onChange={e => updateDebt(i, { balance: parseFloat(e.target.value) || 0 })}
                    className="text-xs w-full border border-slate-200 rounded px-1.5 py-1" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block">APR</label>
                <div className="flex items-center gap-0.5">
                  <input type="number" step="0.1" value={debt.apr || ''} placeholder="0" onChange={e => updateDebt(i, { apr: parseFloat(e.target.value) || 0 })}
                    className="text-xs w-full border border-slate-200 rounded px-1.5 py-1" />
                  <span className="text-xs text-slate-400">%</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block">Min Payment</label>
                <div className="flex items-center gap-0.5">
                  <span className="text-xs text-slate-400">$</span>
                  <input type="number" value={debt.minimumPayment || ''} placeholder="0" onChange={e => updateDebt(i, { minimumPayment: parseFloat(e.target.value) || 0 })}
                    className="text-xs w-full border border-slate-200 rounded px-1.5 py-1" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="mt-3 bg-slate-50 rounded-xl p-3 space-y-2">
          <div className="flex gap-2">
            <input value={newDebt.name} onChange={e => setNewDebt(p => ({ ...p, name: e.target.value }))} placeholder="Debt name"
              className="flex-1 text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5" />
            <select value={newDebt.type} onChange={e => setNewDebt(p => ({ ...p, type: e.target.value }))}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5">
              {Object.entries(DEBT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" value={newDebt.balance} onChange={e => setNewDebt(p => ({ ...p, balance: e.target.value }))} placeholder="Balance"
              className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5" />
            <input type="number" value={newDebt.apr} onChange={e => setNewDebt(p => ({ ...p, apr: e.target.value }))} placeholder="APR %"
              className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5" />
            <input type="number" value={newDebt.minimumPayment} onChange={e => setNewDebt(p => ({ ...p, minimumPayment: e.target.value }))} placeholder="Min $"
              className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5" />
          </div>
          <div className="flex gap-2">
            <button onClick={addDebt} className="text-sm font-medium text-indigo-600">Add</button>
            <button onClick={() => setAdding(false)} className="text-sm text-slate-400">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 py-2.5 rounded-xl border border-dashed border-indigo-200 hover:border-indigo-300 transition-colors">
          <Plus className="w-4 h-4" /> Add a debt
        </button>
      )}
    </div>
  );
}

/* ── Step 3: Spending Targets ───────────────────────────── */

function StepSpending({ budgets, onChange }: { budgets: BudgetItem[]; onChange: (b: BudgetItem[]) => void }) {
  function updateBudget(idx: number, value: string) {
    const next = [...budgets];
    next[idx] = { ...next[idx], monthlyLimit: parseFloat(value) || 0 };
    onChange(next);
  }

  function applyAll() {
    onChange(budgets.map(b => ({ ...b, monthlyLimit: b.monthlyLimit || b.suggested })));
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Set Spending Targets</h2>
          <p className="text-sm text-slate-500">Based on your last 3 months. Adjust to what you want to spend.</p>
        </div>
      </div>

      <button onClick={applyAll}
        className="mt-3 mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg">
        <Sparkles className="w-3.5 h-3.5" /> Apply all suggestions
      </button>

      <div className="space-y-1">
        {budgets.map((b, i) => {
          const catDef = BUDGETABLE_CATEGORIES.find(c => c.name === b.category);
          return (
            <div key={b.category} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">{b.category}</p>
                <p className="text-xs text-slate-400">Avg ~${Math.round(b.monthlyAvg)}/mo
                  {catDef?.type === 'necessity' && <span className="ml-1 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">need</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-slate-400">$</span>
                <input type="number" min="0" step="25" value={b.monthlyLimit || ''} placeholder={String(b.suggested)}
                  onChange={e => updateBudget(i, e.target.value)}
                  className="w-20 text-right text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
                <span className="text-xs text-slate-400">/mo</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Step 4: Income ─────────────────────────────────────── */

function StepIncome({ income, onChange }: { income: IncomeData; onChange: (i: IncomeData) => void }) {
  const FREQ_OPTIONS = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Every 2 weeks' },
    { value: 'twice_monthly', label: '1st & 15th' },
    { value: 'monthly', label: 'Monthly' },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Confirm Your Income</h2>
          <p className="text-sm text-slate-500">
            {income.detectedMonthly > 0
              ? `We detected ~$${Math.round(income.detectedMonthly).toLocaleString()}/month from your deposits.`
              : 'Tell us about your income for accurate projections.'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">How often do you get paid?</label>
          <div className="grid grid-cols-2 gap-2">
            {FREQ_OPTIONS.map(f => (
              <button key={f.value}
                onClick={() => onChange({ ...income, payFrequency: f.value })}
                className={`text-sm py-2.5 rounded-xl border transition-colors ${
                  income.payFrequency === f.value
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-medium'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Take-home pay per paycheck</label>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">$</span>
            <input type="number" value={income.takeHomePay || ''} placeholder={income.detectedMonthly > 0 ? String(Math.round(income.detectedMonthly / 2)) : '0'}
              onChange={e => onChange({ ...income, takeHomePay: parseFloat(e.target.value) || 0 })}
              className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Next payday</label>
          <input type="date" value={income.nextPayday || ''} onChange={e => onChange({ ...income, nextPayday: e.target.value })}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={income.isVariable} onChange={e => onChange({ ...income, isVariable: e.target.checked })}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
          <span className="text-sm text-slate-600">My income varies month to month</span>
        </label>

        {income.isVariable && (
          <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-xl p-3">
            No problem. We'll use your deposit history to calculate a rolling average. Enter your best estimate above and we'll adjust as we see your actual deposits.
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Step 5: Review ─────────────────────────────────────── */

function StepReview({ bills, debts, budgets, income }: {
  bills: BillItem[]; debts: DebtItem[]; budgets: BudgetItem[]; income: IncomeData;
}) {
  const activeBills = bills.filter(b => b.type === 'bill' || b.type === 'subscription');
  const totalBills = activeBills.reduce((s, b) => s + b.monthlyAmount, 0);
  const debtPayments = bills.filter(b => b.type === 'debt');
  const totalDebtPayments = debtPayments.reduce((s, b) => s + b.monthlyAmount, 0);
  const totalBudgeted = budgets.reduce((s, b) => s + (b.monthlyLimit || 0), 0);

  const freq = income.payFrequency;
  const multiplier = freq === 'weekly' ? 4.33 : freq === 'biweekly' ? 2.167 : freq === 'twice_monthly' ? 2 : 1;
  const monthlyIncome = income.takeHomePay ? income.takeHomePay * multiplier : income.detectedMonthly;
  const savingsAmount = Math.round(monthlyIncome * 0.1);
  const spendingMoney = monthlyIncome - totalBills - totalDebtPayments - savingsAmount;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
          <Shield className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Your Plan</h2>
          <p className="text-sm text-slate-500">Here's how your money breaks down each month.</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white mb-4">
        <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Monthly Income</p>
        <p className="text-3xl font-bold">${Math.round(monthlyIncome).toLocaleString()}</p>
      </div>

      <div className="space-y-3">
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-semibold text-blue-800">Bills & Fixed Costs</p>
            <p className="text-sm font-bold text-blue-800">${Math.round(totalBills).toLocaleString()}/mo</p>
          </div>
          {activeBills.map((b, i) => (
            <div key={i} className="flex justify-between text-xs text-blue-600 py-0.5">
              <span>{b.name}</span><span>${Math.round(b.monthlyAmount)}</span>
            </div>
          ))}
        </div>

        <div className="bg-amber-50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-semibold text-amber-800">Debt Payments</p>
            <p className="text-sm font-bold text-amber-800">${Math.round(totalDebtPayments).toLocaleString()}/mo</p>
          </div>
          {debtPayments.map((b, i) => (
            <div key={i} className="flex justify-between text-xs text-amber-600 py-0.5">
              <span>{b.name}</span><span>${Math.round(b.monthlyAmount)}</span>
            </div>
          ))}
          {debts.length > 0 && (
            <p className="text-[10px] text-amber-500 mt-1">{debts.length} debt account{debts.length > 1 ? 's' : ''} tracked for payoff planning</p>
          )}
        </div>

        <div className="bg-emerald-50 rounded-xl p-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-emerald-800">Savings (10%)</p>
            <p className="text-sm font-bold text-emerald-800">${savingsAmount.toLocaleString()}/mo</p>
          </div>
        </div>

        <div className={`rounded-xl p-4 ${spendingMoney >= 0 ? 'bg-purple-50' : 'bg-red-50'}`}>
          <div className="flex justify-between items-center mb-2">
            <p className={`text-sm font-semibold ${spendingMoney >= 0 ? 'text-purple-800' : 'text-red-800'}`}>Spending Money</p>
            <p className={`text-sm font-bold ${spendingMoney >= 0 ? 'text-purple-800' : 'text-red-800'}`}>${Math.round(Math.abs(spendingMoney)).toLocaleString()}/mo</p>
          </div>
          {spendingMoney < 0 && (
            <p className="text-xs text-red-600">Your expenses exceed your income by ${Math.round(Math.abs(spendingMoney))}/mo. Consider adjusting your plan.</p>
          )}
          {totalBudgeted > 0 && (
            <p className="text-xs text-purple-500">{budgets.filter(b => b.monthlyLimit > 0).length} spending categories budgeted</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Wizard ────────────────────────────────────────── */

export default function BudgetWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [bills, setBills] = useState<BillItem[]>([]);
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [income, setIncome] = useState<IncomeData>({
    payFrequency: 'biweekly', takeHomePay: 0, nextPayday: '', isVariable: false, detectedMonthly: 0,
  });

  useEffect(() => {
    api.get('/runway/wizard/data')
      .then(r => {
        const d = r.data;

        // Pre-fill bills from detected recurring
        const billItems: BillItem[] = (d.bills || [])
          .filter((s: any) => s.isActive)
          .map((s: any) => ({
            name: s.name,
            monthlyAmount: s.monthlyAmount,
            type: s.category as BillItem['type'],
            category: s.category === 'debt' ? 'Debt Payments' : s.category === 'subscription' ? 'Entertainment' : 'Bills',
          }));
        setBills(billItems);

        // Pre-fill debts
        const debtItems: DebtItem[] = (d.debtAccounts || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          balance: a.current_balance,
          apr: a.interest_rate || 0,
          minimumPayment: a.minimum_payment || 0,
          type: a.type || 'credit',
        }));
        setDebts(debtItems);

        // Pre-fill budgets from spending averages
        const budgetItems: BudgetItem[] = (d.spendingByCategory || []).map((s: any) => {
          const existing = (d.existingBudgets || []).find((b: any) => b.category === s.category);
          return {
            category: s.category,
            monthlyAvg: s.monthlyAvg,
            suggested: s.suggested,
            monthlyLimit: existing?.monthly_limit || 0,
          };
        });
        setBudgets(budgetItems);

        // Pre-fill income
        setIncome({
          payFrequency: d.user?.payFrequency || 'biweekly',
          takeHomePay: d.user?.takeHomePay || 0,
          nextPayday: d.user?.nextPayday || '',
          isVariable: d.income?.incomeIsVariable || false,
          detectedMonthly: d.income?.monthlyIncome || 0,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.post('/runway/wizard/save', {
        bills: bills.filter(b => b.type !== 'remove').map(b => ({
          name: b.name,
          amount: b.monthlyAmount,
          type: b.type,
          category: b.category,
          apr: b.apr,
          minimumPayment: b.minimumPayment,
        })),
        debts: debts.map(d => ({
          id: d.id,
          name: d.name,
          balance: d.balance,
          apr: d.apr,
          minimumPayment: d.minimumPayment,
          type: d.type,
        })),
        budgets: budgets.filter(b => b.monthlyLimit > 0).map(b => ({
          category: b.category,
          monthlyLimit: b.monthlyLimit,
        })),
        income: {
          payFrequency: income.payFrequency,
          takeHomePay: income.takeHomePay || null,
          nextPayday: income.nextPayday || null,
        },
      });
      navigate('/');
    } catch {
      alert('Failed to save. Please try again.');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center animate-pulse">
        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
          <Wallet className="w-6 h-6 text-indigo-400" />
        </div>
        <p className="text-slate-400">Loading your financial data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto pb-8">
      <ProgressBar step={step} />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        {step === 0 && <StepBills bills={bills} onChange={setBills} />}
        {step === 1 && <StepDebt debts={debts} onChange={setDebts} />}
        {step === 2 && <StepSpending budgets={budgets} onChange={setBudgets} />}
        {step === 3 && <StepIncome income={income} onChange={setIncome} />}
        {step === 4 && <StepReview bills={bills} debts={debts} budgets={budgets} income={income} />}
      </div>

      <div className="flex items-center justify-between mt-4">
        {step > 0 ? (
          <button onClick={() => setStep(s => s - 1)}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        ) : <div />}

        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-6 py-2.5 rounded-xl shadow-sm transition-colors">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 rounded-xl shadow-sm transition-colors disabled:opacity-50">
            <CheckCircle className="w-4 h-4" /> {saving ? 'Saving...' : 'Save My Plan'}
          </button>
        )}
      </div>
    </div>
  );
}
