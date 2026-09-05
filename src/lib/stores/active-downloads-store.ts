import { mmkvStateStorage } from '@/lib/stores/mmkv-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ActiveDownloadStatus = 'preparing' | 'downloading' | 'paused' | 'error' | 'cancelled';

export type ActiveDownload = {
  videoId: string;
  title: string;
  thumbnail: string;
  author?: string;
  /**
   * Source URL + resolution of the in-flight download, filled in as soon as
   * they are known. Kept on the task so a failed download can be retried
   * without re-resolving the detail page.
   */
  videoUrl?: string;
  resolution?: number;
  /** Download progress 0..1, or -1 when the total size is unknown (indeterminate). */
  progress: number;
  status: ActiveDownloadStatus;
  error?: string;
  startedAt: number;
  totalBytesWritten?: number;
  totalBytesExpected?: number;
};

type StartInput = {
  videoId: string;
  title: string;
  thumbnail: string;
  author?: string;
  videoUrl?: string;
  resolution?: number;
};

type ActiveDownloadsState = {
  /** Keyed by video id so an entry can be created the instant a download is requested. */
  tasks: Record<string, ActiveDownload>;
  start: (input: StartInput) => void;
  /** Record the resolved source on an already-started task (fetched after start). */
  setSource: (videoId: string, videoUrl: string, resolution: number) => void;
  setProgress: (videoId: string, ratio: number, written: number, expected: number) => void;
  setStatus: (videoId: string, status: ActiveDownloadStatus, error?: string) => void;
  complete: (videoId: string) => void;
  fail: (videoId: string, error: string) => void;
  remove: (videoId: string) => void;
  /**
   * On app start: tasks persisted as in-flight were killed with the process —
   * mark them errored (retryable, the partial file is the resume point) and
   * drop stale cancelled ones. Must run before the orphan cleanup so their
   * partial files are spared.
   */
  restoreInterrupted: () => void;
};

export const useActiveDownloadsStore = create<ActiveDownloadsState>()(
  persist(
    (set) => ({
      tasks: {},

      start: (input) =>
        set((s) => ({
          tasks: {
            ...s.tasks,
            [input.videoId]: { ...input, progress: 0, status: 'preparing', startedAt: Date.now() },
          },
        })),

      setSource: (videoId, videoUrl, resolution) =>
        set((s) => {
          const t = s.tasks[videoId];
          if (!t) return {};
          return { tasks: { ...s.tasks, [videoId]: { ...t, videoUrl, resolution } } };
        }),

      setProgress: (videoId, ratio, written, expected) =>
        set((s) => {
          const t = s.tasks[videoId];
          if (!t) return {};
          const indeterminate = !expected || expected <= 0;
          return {
            tasks: {
              ...s.tasks,
              [videoId]: {
                ...t,
                status: 'downloading',
                progress: indeterminate ? -1 : Math.min(1, Math.max(0, ratio)),
                totalBytesWritten: written,
                totalBytesExpected: expected,
              },
            },
          };
        }),

      setStatus: (videoId, status, error) =>
        set((s) => {
          const t = s.tasks[videoId];
          if (!t) return {};
          return { tasks: { ...s.tasks, [videoId]: { ...t, status, error } } };
        }),

      complete: (videoId) =>
        set((s) => {
          const rest = { ...s.tasks };
          delete rest[videoId];
          return { tasks: rest };
        }),

      fail: (videoId, error) =>
        set((s) => {
          const t = s.tasks[videoId];
          if (!t) return {};
          return { tasks: { ...s.tasks, [videoId]: { ...t, status: 'error', error } } };
        }),

      remove: (videoId) =>
        set((s) => {
          const rest = { ...s.tasks };
          delete rest[videoId];
          return { tasks: rest };
        }),

      restoreInterrupted: () =>
        set((s) => {
          const tasks: Record<string, ActiveDownload> = {};
          for (const [id, task] of Object.entries(s.tasks)) {
            if (task.status === 'cancelled') continue; // user already gave up
            tasks[id] =
              task.status === 'error' || task.status === 'paused'
                ? task // already actionable (retry / resume) — keep as-is
                : { ...task, status: 'error', error: 'interrupted (app restart)' };
          }
          return { tasks };
        }),
    }),
    {
      // Persist the task table so a half-downloaded file survives an app
      // restart as a retryable (resumable) task instead of being orphaned.
      name: 'active-downloads',
      storage: createJSONStorage(() => mmkvStateStorage),
      partialize: (s) => ({ tasks: s.tasks }),
    }
  )
);

/** Subscribe to a single video's active download (undefined when none). */
export function useActiveDownload(videoId: string): ActiveDownload | undefined {
  return useActiveDownloadsStore((s) => s.tasks[videoId]);
}
