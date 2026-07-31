import { create } from 'zustand';

export type ActiveDownloadStatus = 'preparing' | 'downloading' | 'error' | 'cancelled';

export type ActiveDownload = {
  videoId: string;
  title: string;
  thumbnail: string;
  author?: string;
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
};

type ActiveDownloadsState = {
  /** Keyed by video id so an entry can be created the instant a download is requested. */
  tasks: Record<string, ActiveDownload>;
  start: (input: StartInput) => void;
  setProgress: (videoId: string, ratio: number, written: number, expected: number) => void;
  setStatus: (videoId: string, status: ActiveDownloadStatus, error?: string) => void;
  complete: (videoId: string) => void;
  fail: (videoId: string, error: string) => void;
  remove: (videoId: string) => void;
};

export const useActiveDownloadsStore = create<ActiveDownloadsState>((set) => ({
  tasks: {},

  start: (input) =>
    set((s) => ({
      tasks: {
        ...s.tasks,
        [input.videoId]: { ...input, progress: 0, status: 'preparing', startedAt: Date.now() },
      },
    })),

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
}));

/** Subscribe to a single video's active download (undefined when none). */
export function useActiveDownload(videoId: string): ActiveDownload | undefined {
  return useActiveDownloadsStore((s) => s.tasks[videoId]);
}
