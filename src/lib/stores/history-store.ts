import { getItem, setItem } from '@/lib/storage';
import { create } from 'zustand';

export type HistoryItem = {
  id: string;
  title: string;
  thumbnail: string;
  duration?: string;
  author?: string;
  watchedAt: number;
};

const KEY = 'watch_history';
const MAX_HISTORY = 200;

type HistoryStore = {
  history: HistoryItem[];
  addToHistory: (item: Omit<HistoryItem, 'watchedAt'>) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
};

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  history: getItem<HistoryItem[]>(KEY) ?? [],

  addToHistory: (item) => {
    const filtered = get().history.filter((h) => h.id !== item.id);
    const updated = [{ ...item, watchedAt: Date.now() }, ...filtered].slice(0, MAX_HISTORY);
    setItem(KEY, updated);
    set({ history: updated });
  },

  removeFromHistory: (id) => {
    const updated = get().history.filter((h) => h.id !== id);
    setItem(KEY, updated);
    set({ history: updated });
  },

  clearHistory: () => {
    setItem(KEY, []);
    set({ history: [] });
  },
}));
