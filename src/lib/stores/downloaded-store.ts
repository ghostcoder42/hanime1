import {
  type DownloadMetadata,
  clearAllDownloads,
  deleteDownload,
  getAllDownloads,
  getDownloadByVideoId,
  reconcileDownloads,
} from '@/lib/download';
import { create } from 'zustand';
import { useActiveDownloadsStore } from './active-downloads-store';

type DownloadedStore = {
  downloads: DownloadMetadata[];
  ids: Set<string>;
  loaded: boolean;
  hydrate: () => Promise<void>;
  register: (meta: DownloadMetadata) => void;
  remove: (videoId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  has: (videoId: string) => boolean;
  get: (videoId: string) => DownloadMetadata | null;
};

export const useDownloadedStore = create<DownloadedStore>((set, get) => ({
  downloads: [],
  ids: new Set<string>(),
  loaded: false,

  hydrate: async () => {
    // Tasks persisted as in-flight died with the previous process — mark
    // them retryable first, so the orphan cleanup below spares their partial
    // files (those are the resume points).
    useActiveDownloadsStore.getState().restoreInterrupted();
    const activeIds = new Set(Object.keys(useActiveDownloadsStore.getState().tasks));
    await reconcileDownloads(activeIds);
    const downloads = getAllDownloads();
    set({
      downloads,
      ids: new Set(downloads.map((d) => d.videoId)),
      loaded: true,
    });
  },

  register: (meta) => {
    set((state) => {
      const others = state.downloads.filter((d) => d.videoId !== meta.videoId);
      const downloads = [meta, ...others];
      return { downloads, ids: new Set(downloads.map((d) => d.videoId)) };
    });
  },

  remove: async (videoId) => {
    await deleteDownload(videoId);
    set((state) => {
      const downloads = state.downloads.filter((d) => d.videoId !== videoId);
      const ids = new Set(state.ids);
      ids.delete(videoId);
      return { downloads, ids };
    });
  },

  clearAll: async () => {
    await clearAllDownloads();
    set({ downloads: [], ids: new Set<string>() });
  },

  has: (videoId) => get().ids.has(videoId),
  get: (videoId) => getDownloadByVideoId(videoId),
}));
