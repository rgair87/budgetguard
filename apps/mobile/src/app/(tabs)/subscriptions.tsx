import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';

interface Subscription {
  id: string;
  merchant_name: string;
  estimated_amount: string | number;
  frequency: string;
  confidence: string | number;
  status: string;
  next_expected_date: string | null;
  logo_url: string | null;
  category: string | null;
}

export default function SubscriptionsScreen() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriptions = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get<Subscription[]>('/subscriptions');
      setSubscriptions(res.data ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load subscriptions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchSubscriptions();
    }, [fetchSubscriptions])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const monthlyCost = subscriptions.reduce((sum, sub) => {
    const amount = typeof sub.estimated_amount === 'string'
      ? parseFloat(sub.estimated_amount)
      : sub.estimated_amount;
    if (sub.frequency === 'weekly') return sum + amount * 4.33;
    if (sub.frequency === 'biweekly') return sum + amount * 2.17;
    if (sub.frequency === 'quarterly') return sum + amount / 3;
    if (sub.frequency === 'semi-annual') return sum + amount / 6;
    if (sub.frequency === 'annual') return sum + amount / 12;
    return sum + amount; // monthly
  }, 0);

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
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Monthly Subscription Cost</Text>
        <Text style={styles.summaryAmount}>${monthlyCost.toFixed(2)}</Text>
        <Text style={styles.summaryCount}>
          {subscriptions.length} subscription{subscriptions.length !== 1 ? 's' : ''} detected
        </Text>
      </View>

      {subscriptions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔄</Text>
          <Text style={styles.emptyTitle}>No subscriptions detected</Text>
          <Text style={styles.emptyText}>
            Once your transactions are synced, we'll automatically detect recurring charges.
          </Text>
        </View>
      ) : (
        subscriptions.map((sub) => {
          const amount = typeof sub.estimated_amount === 'string'
            ? parseFloat(sub.estimated_amount)
            : sub.estimated_amount;
          const confidence = typeof sub.confidence === 'string'
            ? parseFloat(sub.confidence)
            : sub.confidence;

          return (
            <View key={sub.id} style={styles.subscriptionCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.merchantName}>{sub.merchant_name}</Text>
                <Text style={styles.amount}>${amount.toFixed(2)}</Text>
              </View>
              <View style={styles.cardDetails}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{sub.frequency}</Text>
                </View>
                <View style={[styles.badge, styles.confidenceBadge]}>
                  <Text style={styles.badgeText}>
                    {Math.round(confidence * 100)}% confidence
                  </Text>
                </View>
                {sub.status !== 'detected' && (
                  <View style={[styles.badge, styles.statusBadge]}>
                    <Text style={styles.badgeText}>{sub.status}</Text>
                  </View>
                )}
              </View>
              {sub.next_expected_date && (
                <Text style={styles.nextDate}>
                  Next charge: {new Date(sub.next_expected_date).toLocaleDateString()}
                </Text>
              )}
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
  summaryCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  summaryLabel: { color: '#6b7280', fontSize: 14 },
  summaryAmount: { fontSize: 28, fontWeight: '700', color: '#111827', marginTop: 4 },
  summaryCount: { color: '#9ca3af', fontSize: 13, marginTop: 4 },
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
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
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
  subscriptionCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  merchantName: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 },
  amount: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cardDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  badge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  confidenceBadge: { backgroundColor: '#dbeafe' },
  statusBadge: { backgroundColor: '#fef3c7' },
  badgeText: { fontSize: 12, color: '#374151' },
  nextDate: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
});
