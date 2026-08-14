import { mmkvStateStorage } from '@/lib/stores/mmkv-storage';
import type { LatestRelease } from '@/lib/updates';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type UpdateStore = {
  /** Latest release seen on GitHub (null before the first successful check). */
  latestVersion: string | null;
  releaseUrl: string | null;
  apkUrl: string | null;
  /** Epoch ms of the last completed check (from the query's dataUpdatedAt). */
  lastCheckedAt: number | null;
  recordCheck: (release: LatestRelease, checkedAt: number) => void;
};

/**
 * Persists the outcome of the last update check (MMKV via zustand persist)
 * so the "update available" hint survives restarts — including after the
 * user declined the prompt — until the installed version catches up.
 */
export const useUpdateStore = create<UpdateStore>()(
  persist(
    (set) => ({
      latestVersion: null,
      releaseUrl: null,
      apkUrl: null,
      lastCheckedAt: null,
      recordCheck: (release, checkedAt) =>
        set({
          latestVersion: release.version,
          releaseUrl: release.releaseUrl,
          apkUrl: release.apkUrl,
          lastCheckedAt: checkedAt,
        }),
    }),
    {
      name: 'update-check',
      storage: createJSONStorage(() => mmkvStateStorage),
      partialize: (s) => ({
        latestVersion: s.latestVersion,
        releaseUrl: s.releaseUrl,
        apkUrl: s.apkUrl,
        lastCheckedAt: s.lastCheckedAt,
      }),
    }
  )
);
