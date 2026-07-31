import { storage } from '@/lib/storage';
import { useCallback, useState } from 'react';

const KEY = 'search_history';
const MAX = 20;

function read(): string[] {
  const v = storage.getString(KEY);
  if (!v) return [];
  try {
    const parsed = JSON.parse(v) as unknown;
    return Array.isArray(parsed) ? (parsed.filter((x) => typeof x === 'string') as string[]) : [];
  } catch {
    return [];
  }
}

function write(list: string[]): void {
  storage.set(KEY, JSON.stringify(list));
}

/** Non-reactive search history persisted directly in MMKV. */
export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>(() => read());

  const addHistory = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const next = [trimmed, ...read().filter((x) => x !== trimmed)].slice(0, MAX);
    write(next);
    setHistory(next);
  }, []);

  const removeHistory = useCallback((term: string) => {
    const next = read().filter((x) => x !== term);
    write(next);
    setHistory(next);
  }, []);

  const clearHistory = useCallback(() => {
    write([]);
    setHistory([]);
  }, []);

  return { history, addHistory, removeHistory, clearHistory };
}
