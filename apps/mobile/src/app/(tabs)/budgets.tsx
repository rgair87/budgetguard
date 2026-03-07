import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';

interface Budget {
  id: string;
  name: string;
  category: string;
  amount_limit: string | number;
  amount_spent: string | number;
  remaining: string | number;
  percentUsed: number;
  period: string;
  period_start: string;
  period_end: string;
  is_ai_generated: boolean;
}

export default function BudgetsScreen() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBudgets = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get<Budget[]>('/budgets', { isActive: true });
      setBudgets(res.data ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load budgets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchBudgets();
    }, [fetchBudgets])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBudgets();
  }, [fetchBudgets]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      await api.post('/budgets/generate');
      Alert.alert(
        'Budget Generation Started',
        'Your smart budget is being generated. Pull to refresh in a moment to see your new budgets.',
      );
      // Refresh after a short delay to give the job time to run
      setTimeout(() => {
        fetchBudgets();
      }, 3000);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to start budget generation');
    } finally {
      setGenerating(false);
    }
  }, [fetchBudgets]);

  const getProgressColor = (percent: number): string => {
    if (percent >= 100) return '#ef4444';
    if (percent >= 80) return '#f59e0b';
    return '#22c55e';
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error) {
    return (
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Your Budgets</Text>
        </View>
        <View style={styles.errorState}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Your Budgets</Text>
        <TouchableOpacity
          style={[styles.generateButton, generating && styles.generateButtonDisabled]}
          onPress={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.generateButtonText}>Generate Smart Budget</Text>
          )}
        </TouchableOpacity>
      </View>

      {budgets.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No budgets yet</Text>
          <Text style={styles.emptyText}>
            Tap "Generate Smart Budget" to let AI create a personalized budget based on your spending.
          </Text>
        </View>
      ) : (
        budgets.map((budget) => {
          const limit = typeof budget.amount_limit === 'string'
            ? parseFloat(budget.amount_limit)
            : budget.amount_limit;
          const spent = typeof budget.amount_spent === 'string'
            ? parseFloat(budget.amount_spent)
            : budget.amount_spent;
          const remaining = typeof budget.remaining === 'string'
            ? parseFloat(budget.remaining)
            : budget.remaining;
          const percent = budget.percentUsed;
          const progressColor = getProgressColor(percent);
          const progressWidth = Math.min(percent, 100);

          return (
            <View key={budget.id} style={styles.budgetCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.budgetName}>{budget.name || budget.category}</Text>
                  {budget.is_ai_generated && (
                    <View style={styles.aiBadge}>
                      <Text style={styles.aiBadgeText}>AI</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.budgetPeriod}>{budget.period}</Text>
              </View>

              <View style={styles.amountsRow}>
                <Text style={styles.spentText}>
                  ${spent.toFixed(2)} <Text style={styles.limitText}>/ ${limit.toFixed(2)}</Text>
                </Text>
                <Text style={[styles.remainingText, remaining < 0 && styles.overBudget]}>
                  {remaining >= 0
                    ? `$${remaining.toFixed(2)} left`
                    : `$${Math.abs(remaining).toFixed(2)} over`}
                </Text>
              </View>

              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${progressWidth}%`, backgroundColor: progressColor },
                  ]}
                />
              </View>

              <Text style={[styles.percentText, { color: progressColor }]}>
                {percent}% used
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  header: { padding: 16 },
  title: { fontSize: 20, fontWeight: '600', color: '#111827', marginBottom: 12 },
  generateButton: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  generateButtonDisabled: { opacity: 0.6 },
  generateButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
  errorState: {
    alignItems: 'center',
    padding: 40,
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: { fontSize: 14, color: '#dc2626', textAlign: 'center' },
  budgetCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  budgetName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  aiBadge: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiBadgeText: { fontSize: 10, fontWeight: '700', color: '#7c3aed' },
  budgetPeriod: { fontSize: 12, color: '#9ca3af', textTransform: 'capitalize' },
  amountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  spentText: { fontSize: 15, fontWeight: '600', color: '#111827' },
  limitText: { fontSize: 13, fontWeight: '400', color: '#9ca3af' },
  remainingText: { fontSize: 13, color: '#22c55e', fontWeight: '500' },
  overBudget: { color: '#ef4444' },
  progressBarBg: {
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: { height: 8, borderRadius: 4 },
  percentText: { fontSize: 12, fontWeight: '500', textAlign: 'right' },
});
