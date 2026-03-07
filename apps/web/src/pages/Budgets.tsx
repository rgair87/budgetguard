import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { SPENDING_CATEGORIES, CATEGORY_LABELS } from '@budgetguard/shared';
import type { Budget, CreateBudgetInput, UpdateBudgetInput } from '@budgetguard/shared';

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

export function BudgetsPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const { data: budgets, isLoading, error } = useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const res = await api.get<Budget[]>('/budgets');
      return res.data!;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      await api.post('/budgets/generate');
    },
    onSuccess: () => {
      showToast('Smart budget generation started! This may take a moment.');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
    onError: (err: Error) => {
      showToast(`Generation failed: ${err.message}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateBudgetInput) => {
      await api.post('/budgets', input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setShowCreateModal(false);
      resetCreateForm();
      showToast('Budget created successfully.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateBudgetInput }) => {
      await api.patch(`/budgets/${id}`, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setEditingId(null);
      setEditAmount('');
    },
  });

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  }

  function resetCreateForm() {
    setNewName('');
    setNewCategory('');
    setNewAmount('');
  }

  function handleCreate() {
    if (!newName.trim() || !newCategory || !newAmount) return;
    createMutation.mutate({
      name: newName.trim(),
      category: newCategory,
      amountLimit: parseFloat(newAmount),
      period: 'monthly',
    });
  }

  function startEdit(budget: Budget) {
    setEditingId(budget.id);
    setEditAmount(String(budget.amountLimit));
  }

  function saveEdit() {
    if (!editingId || !editAmount) return;
    updateMutation.mutate({
      id: editingId,
      input: { amountLimit: parseFloat(editAmount) },
    });
  }

  if (isLoading) return <Spinner />;

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-red-700">
        <h3 className="font-semibold">Failed to load budgets</h3>
        <p className="mt-1 text-sm">{(error as Error).message}</p>
      </div>
    );
  }

  const budgetsList = budgets ?? [];

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed right-6 top-20 z-50 rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track your spending limits by category.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="btn-primary"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Generating...
              </span>
            ) : (
              'Generate Smart Budget'
            )}
          </button>
          <button
            className="btn-secondary"
            onClick={() => setShowCreateModal(true)}
          >
            Add Manual Budget
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Create New Budget</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="budgetName" className="label">Budget Name</label>
                <input
                  id="budgetName"
                  type="text"
                  className="input"
                  placeholder="e.g., Dining Out"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="budgetCategory" className="label">Category</label>
                <select
                  id="budgetCategory"
                  className="input"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                >
                  <option value="">Select a category</option>
                  {SPENDING_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="budgetAmount" className="label">Monthly Limit ($)</label>
                <input
                  id="budgetAmount"
                  type="number"
                  className="input"
                  placeholder="500"
                  min="1"
                  step="1"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="btn-secondary"
                onClick={() => { setShowCreateModal(false); resetCreateForm(); }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreate}
                disabled={createMutation.isPending || !newName.trim() || !newCategory || !newAmount}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Budget'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Budget Grid */}
      {budgetsList.length === 0 ? (
        <div className="card py-16 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No budgets yet</h3>
          <p className="mt-2 text-sm text-gray-500">
            Create a manual budget or let AI generate smart budgets based on your spending.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgetsList.map((budget) => {
            const pct = budget.amountLimit > 0
              ? Math.min(100, Math.round((budget.amountSpent / budget.amountLimit) * 100))
              : 0;
            const barColor =
              pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-primary-500';
            const pctColor =
              pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-yellow-600' : 'text-primary-600';
            const isEditing = editingId === budget.id;
            const categoryLabel =
              (CATEGORY_LABELS as Record<string, string>)[budget.category] ?? budget.category;

            return (
              <div
                key={budget.id}
                className="card cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => {
                  if (!isEditing) startEdit(budget);
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">{budget.name}</h3>
                  <div className="flex items-center gap-2">
                    {budget.isAiGenerated && (
                      <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                        AI
                      </span>
                    )}
                    {!budget.isActive && (
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>

                <p className="mb-3 text-xs text-gray-400">{categoryLabel}</p>

                {/* Progress Bar */}
                <div className="mb-2 h-3 w-full rounded-full bg-gray-200">
                  <div
                    className={`h-3 rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {fmtCurrency.format(budget.amountSpent)} / {fmtCurrency.format(budget.amountLimit)}
                  </span>
                  <span className={`text-sm font-bold ${pctColor}`}>{pct}%</span>
                </div>

                {/* Inline Edit */}
                {isEditing && (
                  <div
                    className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <label htmlFor={`editAmount-${budget.id}`} className="label">
                      New Limit ($)
                    </label>
                    <div className="flex gap-2">
                      <input
                        id={`editAmount-${budget.id}`}
                        type="number"
                        className="input flex-1"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        min="1"
                      />
                      <button
                        className="btn-primary text-sm"
                        onClick={saveEdit}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        className="btn-secondary text-sm"
                        onClick={() => { setEditingId(null); setEditAmount(''); }}
                      >
                        Cancel
                      </button>
                    </div>
                    {budget.isAiGenerated && budget.aiReasoning && (
                      <p className="mt-2 text-xs text-gray-400">
                        AI reasoning: {budget.aiReasoning}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
