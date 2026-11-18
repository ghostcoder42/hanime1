/**
 * Global storage-migration progress. Lives in a store (not the settings
 * screen) because a migration must keep its app-front busy state even if
 * the user navigates away mid-copy — the root layout renders the overlay
 * from this state.
 */
import { create } from 'zustand';

type MigrationStore = {
  active: boolean;
  done: number;
  total: number;
  currentTitle: string;
  begin: (total: number) => void;
  update: (done: number, total: number, currentTitle: string) => void;
  end: () => void;
};

export const useMigrationStore = create<MigrationStore>((set) => ({
  active: false,
  done: 0,
  total: 0,
  currentTitle: '',

  begin: (total) => set({ active: true, done: 0, total, currentTitle: '' }),

  update: (done, total, currentTitle) => set({ done, total, currentTitle }),

  end: () => set({ active: false, done: 0, total: 0, currentTitle: '' }),
}));
