import { useState, useCallback } from 'react';

export interface DashboardCard {
  id: string;
  label: string;
  visible: boolean;
}

const DEFAULT_CARDS: DashboardCard[] = [
  { id: 'runway', label: 'Runway Score', visible: true },
  { id: 'action', label: 'Daily Action', visible: true },
  { id: 'stats', label: 'Key Numbers', visible: true },
  { id: 'cashflow', label: 'Cash Flow Chart', visible: true },
  { id: 'income-expenses', label: 'Income vs Expenses', visible: true },
  { id: 'runway-trend', label: 'Runway Over Time', visible: true },
  { id: 'alert', label: 'Top Alert', visible: true },
  { id: 'advisor', label: 'AI Advisor Insight', visible: true },
  { id: 'accounts', label: 'Account Balances', visible: true },
];

const STORAGE_KEY = 'dashboard_config';

function loadConfig(): DashboardCard[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_CARDS;
    const parsed = JSON.parse(saved) as DashboardCard[];
    // Merge with defaults to handle new cards added after user saved config
    const savedIds = new Set(parsed.map(c => c.id));
    const merged = [...parsed];
    for (const def of DEFAULT_CARDS) {
      if (!savedIds.has(def.id)) merged.push(def);
    }
    return merged;
  } catch {
    return DEFAULT_CARDS;
  }
}

export default function useDashboardConfig() {
  const [cards, setCards] = useState<DashboardCard[]>(loadConfig);

  const saveCards = useCallback((updated: DashboardCard[]) => {
    setCards(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const toggleCard = useCallback((id: string) => {
    const updated = cards.map(c => c.id === id ? { ...c, visible: !c.visible } : c);
    saveCards(updated);
  }, [cards, saveCards]);

  const moveCard = useCallback((fromIndex: number, toIndex: number) => {
    const updated = [...cards];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    saveCards(updated);
  }, [cards, saveCards]);

  const resetToDefault = useCallback(() => {
    saveCards(DEFAULT_CARDS);
  }, [saveCards]);

  const isVisible = useCallback((id: string) => {
    return cards.find(c => c.id === id)?.visible ?? true;
  }, [cards]);

  return { cards, toggleCard, moveCard, resetToDefault, isVisible };
}
