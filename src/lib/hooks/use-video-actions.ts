import { downloadVideo } from '@/lib/download/download-video';
import { fetchVideoDetail } from '@/lib/hanime1/scraper';
import { hapticSuccess } from '@/lib/haptics';
import { useActiveDownloadsStore } from '@/lib/stores/active-downloads-store';
import { useDownloadedStore } from '@/lib/stores/downloaded-store';
import { useFavoritesStore } from '@/lib/stores/favorites-store';
import { showMessage } from 'react-native-flash-message';

/** Minimum tile fields needed to run quick actions without the watch page. */
export type ActionableItem = {
  id: string;
  title: string;
  thumbnail: string;
  duration?: string;
  author?: string;
};

/**
 * Quick actions for a video tile: favorite (immediate) and download (which
 * needs the full detail, fetched on demand). Used by the long-press context
 * menu so users can act without opening the watch page.
 */
export function useVideoActions(item: ActionableItem) {
  const isFavorite = useFavoritesStore((s) => s.isFavorite(item.id));
  const isDownloaded = useDownloadedStore((s) => s.has(item.id));
  const isActive = useActiveDownloadsStore((s) => Boolean(s.tasks[item.id]));
  const addFavorite = useFavoritesStore((s) => s.addFavorite);
  const removeFavorite = useFavoritesStore((s) => s.removeFavorite);

  const toggleFavorite = () => {
    hapticSuccess();
    if (isFavorite) {
      removeFavorite(item.id);
      return;
    }
    addFavorite({
      id: item.id,
      title: item.title,
      thumbnail: item.thumbnail,
      duration: item.duration,
      author: item.author,
    });
  };

  const toggleDownload = async () => {
    if (isDownloaded || isActive) return;
    // Surface the download immediately (the active row + tile badge read this).
    useActiveDownloadsStore.getState().start({
      videoId: item.id,
      title: item.title,
      thumbnail: item.thumbnail,
      author: item.author,
    });
    try {
      const detail = await fetchVideoDetail(item.id);
      const source = detail.sources.find((s) => s.resolution === 720) ?? detail.sources[0];
      if (!source) throw new Error('No downloadable source');
      await downloadVideo({
        videoId: item.id,
        videoUrl: source.url,
        title: item.title,
        thumbnail: item.thumbnail,
        resolution: source.resolution,
        author: item.author ?? detail.author,
      });
      showMessage({ message: 'Downloaded', type: 'success', position: 'top' });
    } catch (error) {
      const task = useActiveDownloadsStore.getState().tasks[item.id];
      // Cancelled/paused (user action) -> stay silent.
      if (!task || task.status === 'cancelled' || task.status === 'paused') return;
      const msg = error instanceof Error ? error.message : 'Download failed';
      // Failure before downloadVideo ran (e.g. detail fetch) -> mark it failed here.
      if (task.status !== 'error') {
        useActiveDownloadsStore.getState().fail(item.id, msg);
      }
      showMessage({
        message: 'Download failed',
        description: msg,
        type: 'danger',
        position: 'top',
      });
    }
  };

  return { isFavorite, isDownloaded, isActive, toggleFavorite, toggleDownload };
}
