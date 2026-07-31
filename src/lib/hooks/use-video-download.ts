import { localUriFor } from '@/lib/download';
import { downloadVideo } from '@/lib/download/download-video';
import { useActiveDownloadsStore } from '@/lib/stores/active-downloads-store';
import { useDownloadedStore } from '@/lib/stores/downloaded-store';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useEffect, useState } from 'react';

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

export function useVideoDownload(opts: UseVideoDownloadOptions): VideoDownloadState {
  const fileUri = localUriFor(opts.videoId);
  const downloaded = useDownloadedStore((s) => s.get(opts.videoId));

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    FileSystem.getInfoAsync(fileUri).then((info) => {
      if (active && info.exists) setDownloadProgress(1);
    });
    return () => {
      active = false;
    };
  }, [fileUri]);

  const handleDownload = useCallback(async () => {
    if (!opts.videoUrl || isDownloading) return;
    if (useActiveDownloadsStore.getState().tasks[opts.videoId]) return; // already active

    // Surface immediately so the active-downloads list / tile badge light up now.
    useActiveDownloadsStore.getState().start({
      videoId: opts.videoId,
      title: opts.title,
      thumbnail: opts.thumbnail,
      author: opts.author,
    });

    try {
      setError(null);
      setIsDownloading(true);
      setDownloadProgress(0);
      await downloadVideo({
        videoId: opts.videoId,
        videoUrl: opts.videoUrl,
        title: opts.title,
        thumbnail: opts.thumbnail,
        resolution: opts.resolution,
        author: opts.author,
        onProgress: (ratio) => setDownloadProgress(ratio),
      });
      setDownloadProgress(1);
    } catch (e) {
      const task = useActiveDownloadsStore.getState().tasks[opts.videoId];
      if (!task || task.status === 'cancelled') return; // cancelled -> silent
      const msg = e instanceof Error ? e.message : 'Download failed';
      if (task.status !== 'error') {
        useActiveDownloadsStore.getState().fail(opts.videoId, msg);
      }
      setError(msg);
    } finally {
      setIsDownloading(false);
    }
  }, [opts, isDownloading]);

  return {
    isDownloading,
    downloadProgress,
    isDownloaded: !!downloaded,
    fileUri,
    error,
    handleDownload,
  };
}
