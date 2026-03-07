import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import type { DashboardData, Budget, Subscription, Account } from '@budgetguard/shared';
import { DashboardSkeleton } from '../components/Skeletons';
import { OnboardingWelcome } from '../components/OnboardingWelcome';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const fmtFull = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function DashboardPage() {
  const { user } = useAuth();

  const [dismissedOnboarding, setDismissedOnboarding] = useState(
    () => localStorage.getItem('bg_onboarding_dismissed') === 'true',
  );

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await api.get<Account[]>('/accounts');
      return res.data ?? [];
    },
  });

  const { data: dashboard, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get<DashboardData>('/user/dashboard');
      return res.data ?? {
        totalBalance: 0,
        monthlyIncome: 0,
        monthlySpending: 0,
        activeSubscriptions: 0,
        subscriptionsCost: 0,
        unclassifiedSubscriptions: 0,
        activeBudgets: 0,
        budgetHealth: 'good' as const,
        unreadNotifications: 0,
        savingsSuggestions: 0,
      };
    },
  });

  const { data: budgets } = useQuery({
    queryKey: ['budgets', 'active'],
    queryFn: async () => {
      const res = await api.get<Budget[]>('/budgets', { isActive: true });
      return res.data ?? [];
    },
  });

  const { data: subscriptions } = useQuery({
    queryKey: ['subscriptions', 'recent'],
    queryFn: async () => {
      const res = await api.get<Subscription[]>('/subscriptions', { status: 'detected' });
      return res.data ?? [];
    },
  });

  if (isLoading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="card flex flex-col items-center py-16 text-center">
        <svg className="h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Something went wrong</h3>
        <p className="mt-1 text-sm text-gray-500">{(error as Error).message}</p>
        <button className="btn-secondary mt-6" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  if (!dashboard) return null;

  // Show onboarding if the user has no accounts and hasn't dismissed it
  if ((accounts ?? []).length === 0 && !dismissedOnboarding) {
    return (
      <OnboardingWelcome
        firstName={user?.firstName}
        onDismiss={() => {
          localStorage.setItem('bg_onboarding_dismissed', 'true');
          setDismissedOnboarding(true);
        }}
      />
    );
  }

  const chartData = [
    { name: 'Income', value: dashboard.monthlyIncome },
    { name: 'Spending', value: dashboard.monthlySpending },
  ];

  const topBudgets = (budgets ?? []).slice(0, 3);
  const recentSubs = (subscriptions ?? []).slice(0, 5);

  const budgetHealthColor =
    dashboard.budgetHealth === 'good'
      ? 'text-green-600'
      : dashboard.budgetHealth === 'warning'
        ? 'text-yellow-600'
        : 'text-red-600';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.firstName || 'there'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Here is your financial overview for this month.
        </p>
      </div>

      {/* Total Balance */}
      <div className="card bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <p className="text-sm font-medium text-primary-100">Total Balance</p>
        <p className="mt-2 text-4xl font-bold">{fmt.format(dashboard.totalBalance)}</p>
        <div className="mt-4 flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              dashboard.budgetHealth === 'good'
                ? 'bg-green-100 text-green-800'
                : dashboard.budgetHealth === 'warning'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
            }`}
          >
            Budget health: {dashboard.budgetHealth}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card animate-fade-in-up" style={{ animationDelay: '100ms', opacity: 0 }}>
          <p className="text-sm font-medium text-gray-500">Monthly Income</p>
          <p className="mt-1 text-2xl font-semibold text-green-600">
            {fmt.format(dashboard.monthlyIncome)}
          </p>
        </div>
        <div className="card animate-fade-in-up" style={{ animationDelay: '200ms', opacity: 0 }}>
          <p className="text-sm font-medium text-gray-500">Monthly Spending</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">
            {fmt.format(dashboard.monthlySpending)}
          </p>
        </div>
        <div className="card animate-fade-in-up" style={{ animationDelay: '300ms', opacity: 0 }}>
          <p className="text-sm font-medium text-gray-500">Active Subscriptions</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {dashboard.activeSubscriptions}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {fmtFull.format(dashboard.subscriptionsCost)}/mo
          </p>
        </div>
        <Link to="/notifications" className="card animate-fade-in-up hover:ring-2 hover:ring-primary-300 transition-shadow" style={{ animationDelay: '400ms', opacity: 0 }}>
          <p className="text-sm font-medium text-gray-500">Notifications</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-2xl font-semibold text-gray-900">
              {dashboard.unreadNotifications}
            </p>
            {dashboard.unreadNotifications > 0 && (
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                {dashboard.unreadNotifications}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-400">unread</p>
        </Link>
      </div>

      {/* Chart + Budgets Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Income vs Spending Chart */}
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Income vs Spending</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={48}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => fmt.format(v)}
                />
                <Tooltip formatter={(value: number) => fmtFull.format(value)} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  <Cell fill="#22c55e" />
                  <Cell fill="#ef4444" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active Budgets */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Active Budgets</h2>
            <Link to="/budgets" className="text-sm font-medium text-primary-600 hover:text-primary-700">
              View all
            </Link>
          </div>
          {topBudgets.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No active budgets yet.</p>
          ) : (
            <div className="space-y-4">
              {topBudgets.map((budget) => {
                const pct = budget.amountLimit > 0
                  ? Math.min(100, Math.round((budget.amountSpent / budget.amountLimit) * 100))
                  : 0;
                const barColor =
                  pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-primary-500';
                return (
                  <div key={budget.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">{budget.name}</span>
                      <span className="text-gray-500">
                        {fmtFull.format(budget.amountSpent)} / {fmtFull.format(budget.amountLimit)}
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-gray-200">
                      <div
                        className={`h-2.5 rounded-full transition-all ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className={`mt-0.5 text-right text-xs ${pct >= 100 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                      {pct}%
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Subscriptions Detected */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Subscriptions</h2>
            <Link to="/subscriptions" className="text-sm font-medium text-primary-600 hover:text-primary-700">
              View all
            </Link>
          </div>
          {recentSubs.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No new subscriptions detected.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentSubs.map((sub) => (
                <li key={sub.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{sub.merchantName}</p>
                    <p className="text-xs text-gray-400">{sub.frequency}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {fmtFull.format(sub.estimatedAmount)}
                    </p>
                    <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {Math.round(sub.confidenceScore * 100)}% match
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Smart Savings */}
        <Link
          to="/suggestions"
          className="card flex flex-col items-center justify-center hover:ring-2 hover:ring-primary-300 transition-shadow"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100">
            <svg className="h-7 w-7 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <p className="mt-3 text-lg font-semibold text-gray-900">Smart Savings</p>
          <p className="mt-1 text-3xl font-bold text-primary-600">
            {dashboard.savingsSuggestions}
          </p>
          <p className="mt-1 text-sm text-gray-500">suggestions available</p>
        </Link>
      </div>
    </div>
  );
}
