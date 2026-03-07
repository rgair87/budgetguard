import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ListSkeleton } from '../components/Skeletons';
import type { Subscription, SubscriptionStatus, ClassifySubscriptionInput } from '@budgetguard/shared';

interface CancelGuide {
  subscriptionId: string;
  merchantName: string;
  cancelUrl?: string;
  cancelInstructions?: string;
  steps: string[];
}

const fmtCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

type FilterTab = 'all' | 'detected' | 'safe' | 'cancelled';

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'detected', label: 'Detected' },
  { key: 'safe', label: 'Safe' },
  { key: 'cancelled', label: 'Cancelled' },
];

const statusBadge: Record<SubscriptionStatus, { bg: string; text: string; label: string }> = {
  detected: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Detected' },
  confirmed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Confirmed' },
  safe: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Safe List' },
  cancel_requested: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Cancel Requested' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Cancelled' },
  dismissed: { bg: 'bg-gray-100', text: 'text-gray-400', label: 'Dismissed' },
};

function matchesFilter(sub: Subscription, tab: FilterTab): boolean {
  if (tab === 'all') return true;
  if (tab === 'detected') return sub.status === 'detected' || sub.status === 'confirmed';
  if (tab === 'safe') return sub.status === 'safe';
  if (tab === 'cancelled') return sub.status === 'cancelled' || sub.status === 'cancel_requested';
  return true;
}

function statusBorderClass(status: SubscriptionStatus): string {
  switch (status) {
    case 'detected':
    case 'confirmed':
      return 'border-l-[3px] border-l-blue-400';
    case 'safe':
      return 'border-l-[3px] border-l-emerald-400';
    case 'cancel_requested':
    case 'cancelled':
      return 'border-l-[3px] border-l-gray-300';
    case 'dismissed':
      return 'border-l-[3px] border-l-gray-200';
    default:
      return '';
  }
}

export function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [classifyId, setClassifyId] = useState<string | null>(null);
  const [keepUntil, setKeepUntil] = useState('');
  const [keepReason, setKeepReason] = useState('');

  const { data: subscriptions, isLoading, error, refetch } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const res = await api.get<any[]>('/subscriptions');
      const raw = res.data ?? [];
      // Map snake_case DB fields to camelCase Subscription interface
      return raw.map((s: any): Subscription => ({
        id: s.id,
        userId: s.user_id ?? s.userId,
        merchantName: s.merchant_name ?? s.merchantName ?? '',
        normalizedName: s.normalized_merchant_name ?? s.normalizedName ?? '',
        description: s.description,
        estimatedAmount: parseFloat(s.estimated_amount ?? s.estimatedAmount ?? 0),
        currencyCode: s.currency_code ?? s.currencyCode ?? 'USD',
        frequency: s.frequency,
        confidenceScore: parseFloat(s.confidence ?? s.confidenceScore ?? s.confidence_score ?? 0),
        status: s.status,
        category: s.category,
        cancelUrl: s.cancel_url ?? s.cancelUrl,
        cancelInstructions: s.cancel_instructions ?? s.cancelInstructions,
        firstSeenDate: s.first_seen_date ?? s.firstSeenDate ?? s.created_at ?? '',
        lastChargeDate: s.last_charge_date ?? s.lastChargeDate,
        nextExpectedDate: s.next_expected_date ?? s.nextExpectedDate,
        totalCharges: parseInt(s.total_charges ?? s.totalCharges ?? 0, 10),
        totalSpent: parseFloat(s.total_spent ?? s.totalSpent ?? 0),
        classifiedAt: s.classified_at ?? s.classifiedAt,
        detectedAt: s.detected_at ?? s.detectedAt ?? s.created_at ?? '',
      }));
    },
  });

  const [cancelGuide, setCancelGuide] = useState<CancelGuide | null>(null);
  const [cancelGuideLoading, setCancelGuideLoading] = useState(false);

  const classifyMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ClassifySubscriptionInput }) => {
      await api.patch(`/subscriptions/${id}/classify`, {
        action: input.action,
        ...(input.keepUntil ? { keep_until: input.keepUntil } : {}),
        ...(input.keepReason ? { keep_reason: input.keepReason } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      setClassifyId(null);
      setKeepUntil('');
      setKeepReason('');
      setCancelGuide(null);
    },
  });

  if (isLoading) return <ListSkeleton />;

  if (error) {
    return (
      <div className="card py-12 text-center">
        <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <h3 className="mt-3 text-sm font-medium text-gray-900">Something went wrong</h3>
        <p className="mt-1 text-sm text-gray-500">{(error as Error).message}</p>
        <button className="btn-secondary mt-4" onClick={() => refetch()}>Try again</button>
      </div>
    );
  }

  const allSubs = subscriptions ?? [];
  const filtered = allSubs.filter((s) => matchesFilter(s, activeTab));

  const monthlyCost = allSubs
    .filter((s) => s.status !== 'cancelled' && s.status !== 'dismissed')
    .reduce((sum, s) => {
      if (s.frequency === 'weekly') return sum + s.estimatedAmount * 4.33;
      if (s.frequency === 'bi-weekly') return sum + s.estimatedAmount * 2.17;
      if (s.frequency === 'monthly') return sum + s.estimatedAmount;
      if (s.frequency === 'quarterly') return sum + s.estimatedAmount / 3;
      if (s.frequency === 'yearly') return sum + s.estimatedAmount / 12;
      return sum + s.estimatedAmount;
    }, 0);

  function handleKeep(id: string) {
    setClassifyId(id);
  }

  function submitKeep() {
    if (!classifyId) return;
    const input: ClassifySubscriptionInput = {
      action: 'safe_list',
      ...(keepUntil ? { keepUntil: new Date(keepUntil).toISOString() } : {}),
      ...(keepReason ? { keepReason } : {}),
    };
    classifyMutation.mutate({ id: classifyId, input });
  }

  async function handleCancel(id: string) {
    setCancelGuideLoading(true);
    setCancelGuide(null);
    try {
      const res = await api.get<CancelGuide>(`/subscriptions/${id}/cancel-guide`);
      if (res.data) {
        setCancelGuide(res.data);
      }
    } catch {
      // Cancel guide not available, proceed with classify directly
    } finally {
      setCancelGuideLoading(false);
    }
    classifyMutation.mutate({
      id,
      input: { action: 'cancel' },
    });
  }

  function handleDismiss(id: string) {
    classifyMutation.mutate({
      id,
      input: { action: 'dismiss' },
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your detected recurring payments and subscriptions.
        </p>
      </div>

      {/* Monthly Cost Summary */}
      <div className="card bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
        <p className="text-sm font-medium text-indigo-200">Total Monthly Subscription Cost</p>
        <p className="mt-1 text-3xl font-bold">{fmtCurrency.format(monthlyCost)}</p>
        <p className="mt-1 text-sm text-indigo-200">
          across {allSubs.filter((s) => s.status !== 'cancelled' && s.status !== 'dismissed').length} active subscriptions
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Subscriptions List */}
      {filtered.length === 0 ? (
        <div className="card py-12 text-center">
          <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="mt-3 text-sm font-medium text-gray-900">No subscriptions found</h3>
          <p className="mt-1 text-sm text-gray-500">No subscriptions in this category.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((sub, index) => {
            const badge = statusBadge[sub.status] ?? statusBadge.detected;
            const isClassifying = classifyId === sub.id;

            return (
              <div
                key={sub.id}
                className={`card animate-fade-in-up ${statusBorderClass(sub.status)}`}
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-semibold text-gray-900">
                        {sub.merchantName}
                      </h3>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <span className="font-semibold text-gray-900">
                        {fmtCurrency.format(sub.estimatedAmount)}
                        <span className="font-normal text-gray-400">/{sub.frequency}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        Confidence:
                        <span className={`font-medium ${
                          sub.confidenceScore >= 0.8 ? 'text-green-600' :
                          sub.confidenceScore >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {Math.round(sub.confidenceScore * 100)}%
                        </span>
                      </span>
                      {sub.lastChargeDate && (
                        <span>
                          Last charged: {new Date(sub.lastChargeDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {sub.status === 'detected' || sub.status === 'confirmed' ? (
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                        onClick={() => handleKeep(sub.id)}
                      >
                        Keep
                      </button>
                      <button
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                        onClick={() => handleCancel(sub.id)}
                        disabled={classifyMutation.isPending}
                      >
                        Cancel
                      </button>
                      <button
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        onClick={() => handleDismiss(sub.id)}
                        disabled={classifyMutation.isPending}
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* Classify Form (inline) */}
                {isClassifying && (
                  <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <h4 className="mb-3 text-sm font-semibold text-gray-700">
                      Add to Safe List
                    </h4>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <label htmlFor="keepUntil" className="label">Keep Until (optional)</label>
                        <input
                          id="keepUntil"
                          type="date"
                          className="input"
                          value={keepUntil}
                          onChange={(e) => setKeepUntil(e.target.value)}
                        />
                      </div>
                      <div className="flex-1">
                        <label htmlFor="keepReason" className="label">Reason (optional)</label>
                        <input
                          id="keepReason"
                          type="text"
                          className="input"
                          placeholder="e.g., Need it for work"
                          value={keepReason}
                          onChange={(e) => setKeepReason(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="btn-primary"
                          onClick={submitKeep}
                          disabled={classifyMutation.isPending}
                        >
                          {classifyMutation.isPending ? 'Saving...' : 'Confirm'}
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            setClassifyId(null);
                            setKeepUntil('');
                            setKeepReason('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cancel Guide */}
                {cancelGuide && cancelGuide.subscriptionId === sub.id && (
                  <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-orange-800">
                        How to cancel {cancelGuide.merchantName}
                      </h4>
                      <button
                        className="text-xs text-orange-600 hover:text-orange-800"
                        onClick={() => setCancelGuide(null)}
                      >
                        Close
                      </button>
                    </div>
                    {cancelGuide.cancelUrl && (
                      <p className="mt-2 text-sm text-orange-700">
                        Cancel online:{' '}
                        <a
                          href={cancelGuide.cancelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium underline"
                        >
                          {cancelGuide.cancelUrl}
                        </a>
                      </p>
                    )}
                    {cancelGuide.cancelInstructions && (
                      <p className="mt-2 text-sm text-orange-700">
                        {cancelGuide.cancelInstructions}
                      </p>
                    )}
                    {cancelGuide.steps.length > 0 && (
                      <ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-orange-700">
                        {cancelGuide.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
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
