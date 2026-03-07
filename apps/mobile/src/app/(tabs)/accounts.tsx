import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';

interface Account {
  id: string;
  name: string;
  institution: string;
  type: string;
  balance: number;
  currency: string;
  lastSynced?: string;
}

function formatCurrency(amount: number, currency = 'USD'): string {
  return `$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getAccountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    checking: 'Checking',
    savings: 'Savings',
    credit: 'Credit Card',
    investment: 'Investment',
    loan: 'Loan',
  };
  return labels[type] || type;
}

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get<Account[]>('/accounts');
      setAccounts(res.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load accounts');
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchAccounts();
      setLoading(false);
    })();
  }, [fetchAccounts]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchAccounts();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading accounts...</Text>
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

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Linked Accounts</Text>
        <TouchableOpacity style={styles.linkButton}>
          <Text style={styles.linkButtonText}>+ Link Account</Text>
        </TouchableOpacity>
      </View>

      {accounts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🏦</Text>
          <Text style={styles.emptyTitle}>No accounts linked</Text>
          <Text style={styles.emptyText}>
            Connect your bank accounts and credit cards to start tracking your finances.
          </Text>
        </View>
      ) : (
        accounts.map((account) => (
          <View key={account.id} style={styles.accountCard}>
            <View style={styles.accountHeader}>
              <View>
                <Text style={styles.accountName}>{account.name}</Text>
                <Text style={styles.accountInstitution}>{account.institution}</Text>
              </View>
              <View style={styles.accountTypeBadge}>
                <Text style={styles.accountTypeText}>{getAccountTypeLabel(account.type)}</Text>
              </View>
            </View>
            <View style={styles.accountBalance}>
              <Text style={styles.balanceLabel}>Balance</Text>
              <Text style={[styles.balanceValue, account.balance < 0 && { color: '#ef4444' }]}>
                {account.balance < 0 ? '-' : ''}{formatCurrency(account.balance, account.currency)}
              </Text>
            </View>
            {account.lastSynced && (
              <Text style={styles.lastSynced}>
                Last synced: {new Date(account.lastSynced).toLocaleDateString()}
              </Text>
            )}
          </View>
        ))
      )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: { fontSize: 20, fontWeight: '600', color: '#111827' },
  linkButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  linkButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
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
  accountCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  accountName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  accountInstitution: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  accountTypeBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  accountTypeText: { fontSize: 12, color: '#2563eb', fontWeight: '500' },
  accountBalance: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: { fontSize: 13, color: '#6b7280' },
  balanceValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  lastSynced: { fontSize: 11, color: '#9ca3af', marginTop: 8 },
});
