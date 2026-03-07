import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

export default function BudgetsScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Budgets</Text>
        <TouchableOpacity style={styles.generateButton}>
          <Text style={styles.generateButtonText}>Generate Smart Budget</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>No budgets yet</Text>
        <Text style={styles.emptyText}>
          Tap "Generate Smart Budget" to let AI create a personalized budget based on your spending.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { padding: 16 },
  title: { fontSize: 20, fontWeight: '600', color: '#111827', marginBottom: 12 },
  generateButton: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
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
});
