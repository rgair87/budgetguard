import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useState } from 'react';

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    // TODO: Refetch dashboard data
    setTimeout(() => setRefreshing(false), 1000);
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Total Balance */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount}>$0.00</Text>
        <Text style={styles.balanceSubtext}>Across all accounts</Text>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Monthly Spending</Text>
          <Text style={[styles.statValue, { color: '#ef4444' }]}>$0.00</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Monthly Income</Text>
          <Text style={[styles.statValue, { color: '#22c55e' }]}>$0.00</Text>
        </View>
      </View>

      {/* Subscriptions Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscriptions</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>No subscriptions detected yet.</Text>
          <Text style={styles.cardSubtext}>Link a bank account to get started.</Text>
        </View>
      </View>

      {/* Budget Health */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Budget Health</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>No budgets created yet.</Text>
          <Text style={styles.cardSubtext}>Generate a smart budget to start tracking.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
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
