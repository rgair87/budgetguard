import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';

interface DashboardData {
  totalBalance: number;
  monthlySpending: number;
  monthlyIncome: number;
  subscriptionCount: number;
  subscriptionTotal: number;
  budgetCount: number;
  budgetHealthScore: number | null;
}

function formatCurrency(amount: number): string {
  return `$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get<DashboardData>('/user/dashboard');
      setData(res.data ?? null);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchDashboard();
      setLoading(false);
    })();
  }, [fetchDashboard]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.retryText} onPress={onRefresh}>Tap to retry</Text>
      </View>
    );
  }

  const totalBalance = data?.totalBalance ?? 0;
  const monthlySpending = data?.monthlySpending ?? 0;
  const monthlyIncome = data?.monthlyIncome ?? 0;
  const subscriptionCount = data?.subscriptionCount ?? 0;
  const subscriptionTotal = data?.subscriptionTotal ?? 0;
  const budgetCount = data?.budgetCount ?? 0;
  const budgetHealthScore = data?.budgetHealthScore;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Total Balance */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount}>{formatCurrency(totalBalance)}</Text>
        <Text style={styles.balanceSubtext}>Across all accounts</Text>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Monthly Spending</Text>
          <Text style={[styles.statValue, { color: '#ef4444' }]}>{formatCurrency(monthlySpending)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Monthly Income</Text>
          <Text style={[styles.statValue, { color: '#22c55e' }]}>{formatCurrency(monthlyIncome)}</Text>
        </View>
      </View>

      {/* Subscriptions Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscriptions</Text>
        <View style={styles.card}>
          {subscriptionCount > 0 ? (
            <>
              <Text style={styles.cardText}>{subscriptionCount} active subscription{subscriptionCount !== 1 ? 's' : ''}</Text>
              <Text style={styles.cardSubtext}>{formatCurrency(subscriptionTotal)}/month total</Text>
            </>
          ) : (
            <>
              <Text style={styles.cardText}>No subscriptions detected yet.</Text>
              <Text style={styles.cardSubtext}>Link a bank account to get started.</Text>
            </>
          )}
        </View>
      </View>

      {/* Budget Health */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Budget Health</Text>
        <View style={styles.card}>
          {budgetCount > 0 ? (
            <>
              <Text style={styles.cardText}>{budgetCount} budget{budgetCount !== 1 ? 's' : ''} active</Text>
              {budgetHealthScore !== null && (
                <Text style={styles.cardSubtext}>Health score: {budgetHealthScore}%</Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.cardText}>No budgets created yet.</Text>
              <Text style={styles.cardSubtext}>Generate a smart budget to start tracking.</Text>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 24,
  },
  loadingText: { marginTop: 12, color: '#6b7280', fontSize: 14 },
  errorText: { color: '#ef4444', fontSize: 16, textAlign: 'center', marginBottom: 12 },
  retryText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
  balanceCard: {
    backgroundColor: '#2563eb',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  balanceLabel: { color: '#bfdbfe', fontSize: 14 },
  balanceAmount: { color: '#fff', fontSize: 36, fontWeight: '700', marginVertical: 4 },
  balanceSubtext: { color: '#93c5fd', fontSize: 12 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statLabel: { color: '#6b7280', fontSize: 12, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '600' },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: '#111827' },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardText: { fontSize: 14, color: '#374151', marginBottom: 4 },
  cardSubtext: { fontSize: 12, color: '#9ca3af' },
});
