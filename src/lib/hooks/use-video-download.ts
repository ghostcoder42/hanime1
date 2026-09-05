import { localUriFor } from '@/lib/download';
import { downloadVideo, retryDownload } from '@/lib/download/download-video';
import { useActiveDownload, useActiveDownloadsStore } from '@/lib/stores/active-downloads-store';
import { useDownloadedStore } from '@/lib/stores/downloaded-store';
import { useCallback } from 'react';

export type UseVideoDownloadOptions = {
  videoId: string;
  videoUrl?: string;
  title: string;
  thumbnail: string;
  resolution: number;
  author?: string;
};

export type VideoDownloadState = {
  isDownloading: boolean;
  downloadProgress: number;
  isDownloaded: boolean;
  fileUri: string | null;
  error: string | null;
  handleDownload: () => Promise<void>;
};

/**
 * Watch-page download button state. Everything reactive (progress, error,
 * in-flight) is derived from the active-downloads store so the button, the
 * library row and the tile badges all tell the same story — including a retry
 * resuming mid-file.
 */
export function useVideoDownload(opts: UseVideoDownloadOptions): VideoDownloadState {
  const fileUri = localUriFor(opts.videoId);
  const isDownloaded = useDownloadedStore((s) => s.has(opts.videoId));
  const active = useActiveDownload(opts.videoId);

  const isDownloading =
    !!active && (active.status === 'downloading' || active.status === 'preparing');
  const downloadProgress = active
    ? active.progress < 0
      ? 0
      : active.progress
    : isDownloaded
      ? 1
      : 0;
  const error = active?.status === 'error' ? (active.error ?? 'Download failed') : null;

  const handleDownload = useCallback(async () => {
    if (!opts.videoUrl) return;
    const existing = useActiveDownloadsStore.getState().tasks[opts.videoId];
    if (existing && existing.status !== 'error' && existing.status !== 'paused') {
      return; // already active
    }
    // An errored or paused task continues (resuming from the bytes already
    // on disk when the previous attempt stopped mid-transfer).
    if (existing) {
      await retryDownload(opts.videoId);
      return;
    }

    // Surface immediately so the active-downloads list / tile badge light up now.
    useActiveDownloadsStore.getState().start({
      videoId: opts.videoId,
      title: opts.title,
      thumbnail: opts.thumbnail,
      author: opts.author,
      videoUrl: opts.videoUrl,
      resolution: opts.resolution,
    });

    try {
      await downloadVideo({
        videoId: opts.videoId,
        videoUrl: opts.videoUrl,
        title: opts.title,
        thumbnail: opts.thumbnail,
        resolution: opts.resolution,
        author: opts.author,
      });
    } catch (e) {
      const task = useActiveDownloadsStore.getState().tasks[opts.videoId];
      if (!task || task.status === 'cancelled') return; // cancelled -> silent
      const msg = e instanceof Error ? e.message : 'Download failed';
      if (task.status !== 'error') {
        useActiveDownloadsStore.getState().fail(opts.videoId, msg);
      }
    }
  }, [opts]);

  return {
    isDownloading,
    downloadProgress,
    isDownloaded,
    fileUri,
    error,
    handleDownload,
  };
}
