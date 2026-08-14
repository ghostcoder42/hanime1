import { storage } from '@/lib/storage';
import type { StateStorage } from 'zustand/middleware';

/**
 * MMKV-backed StateStorage for zustand's `persist` middleware. MMKV is
 * synchronous, so persistence/rehydration happens without any async gap.
 */
export const mmkvStateStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => storage.remove(name),
};
