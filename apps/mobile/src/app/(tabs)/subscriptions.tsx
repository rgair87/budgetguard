import { View, Text, ScrollView, StyleSheet } from 'react-native';

export default function SubscriptionsScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Monthly Subscription Cost</Text>
        <Text style={styles.summaryAmount}>$0.00</Text>
      </View>

      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>🔄</Text>
        <Text style={styles.emptyTitle}>No subscriptions detected</Text>
        <Text style={styles.emptyText}>
          Once your transactions are synced, we'll automatically detect recurring charges.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
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
});
