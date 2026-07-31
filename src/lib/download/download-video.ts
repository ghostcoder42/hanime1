import { useActiveDownloadsStore } from '@/lib/stores/active-downloads-store';
import { useDownloadedStore } from '@/lib/stores/downloaded-store';
import * as FileSystem from 'expo-file-system/legacy';
import {
  type DownloadMetadata,
  deleteDownload,
  ensureDownloadDir,
  localUriFor,
  saveDownloadMetadata,
} from './index';

export type DownloadVideoOptions = {
  videoId: string;
  videoUrl: string;
  title: string;
  thumbnail: string;
  resolution: number;
  author?: string;
  /** Optional local progress callback (kept for the watch-page button %). */
  onProgress?: (ratio: number) => void;
};

/** Active resumables so an in-flight download can be cancelled. Keyed by videoId. */
const activeResumables = new Map<
  string,
  { resumable: FileSystem.DownloadResumable; fileUri: string }
>();

/** Per-videoId throttle state for progress updates (avoids a render storm). */
const progressTick = new Map<string, number>();
const PROGRESS_INTERVAL_MS = 200;

function reportProgress(videoId: string, written: number, expected: number) {
  const now = Date.now();
  const last = progressTick.get(videoId);
  if (last && now - last < PROGRESS_INTERVAL_MS) return;
  progressTick.set(videoId, now);
  useActiveDownloadsStore
    .getState()
    .setProgress(videoId, written / Math.max(1, expected), written, expected);
}

/**
 * Downloads a single video to the on-device `videos/` directory, persists its
 * metadata, and keeps both the reactive completed store and the active-downloads
 * store in sync. Shared by the watch-page download button and the long-press
 * context menu.
 *
 * Callers should add the task to the active-downloads store (start) BEFORE
 * calling this; downloadVideo then drives progress / complete / fail. Files are
 * named `<videoId>.mp4` (one file per video; re-downloading a different
 * resolution overwrites the same file).
 */
export async function downloadVideo(opts: DownloadVideoOptions): Promise<DownloadMetadata> {
  const { videoId, videoUrl, title, thumbnail, resolution, author, onProgress } = opts;

  await ensureDownloadDir();
  const fileUri = localUriFor(videoId);

  const resumable = FileSystem.createDownloadResumable(videoUrl, fileUri, {}, (dl) => {
    const written = dl.totalBytesWritten;
    const expected = dl.totalBytesExpectedToWrite;
    onProgress?.(expected > 0 ? written / expected : 0);
    reportProgress(videoId, written, expected);
  });
  activeResumables.set(videoId, { resumable, fileUri });

  try {
    useActiveDownloadsStore.getState().setStatus(videoId, 'downloading');
    const result = await resumable.downloadAsync();
    if (!result || result.status < 200 || result.status >= 300) {
      throw new Error(`Download failed (status ${result?.status ?? 'unknown'})`);
    }
    // If the user cancelled during the final stretch, don't register; drop the file.
    if (useActiveDownloadsStore.getState().tasks[videoId]?.status === 'cancelled') {
      try {
        await FileSystem.deleteAsync(result.uri);
      } catch {
        // ignore
      }
      throw new Error('Download cancelled');
    }

    const meta: DownloadMetadata = {
      videoId,
      title,
      thumbnail,
      uri: result.uri,
      size: result.headers?.['Content-Length']
        ? Number.parseInt(String(result.headers['Content-Length']), 10)
        : 0,
      resolution,
      downloadedAt: Date.now(),
      author,
    };
    saveDownloadMetadata(meta);
    // Keep the reactive store in sync so badges light up across the app.
    useDownloadedStore.getState().register(meta);
    useActiveDownloadsStore.getState().complete(videoId);
    return meta;
  } catch (error) {
    // If the task was already removed/marked cancelled, this was a user cancel,
    // not a failure — don't surface it as an error.
    const task = useActiveDownloadsStore.getState().tasks[videoId];
    if (task && task.status !== 'cancelled') {
      useActiveDownloadsStore
        .getState()
        .fail(videoId, error instanceof Error ? error.message : 'Download failed');
    }
    throw error;
  } finally {
    activeResumables.delete(videoId);
    progressTick.delete(videoId);
  }
}

/**
 * Cancels an in-flight download (from the active-downloads UI): cancels the
 * resumable, deletes the partial file, and removes the active task. If the
 * download already finished (not in the registry) this just clears the task.
 */
export async function cancelDownload(videoId: string): Promise<void> {
  const entry = activeResumables.get(videoId);
  // Signal cancellation first so the in-flight downloadVideo won't mark `fail`.
  useActiveDownloadsStore.getState().setStatus(videoId, 'cancelled');

  if (!entry) {
    useActiveDownloadsStore.getState().remove(videoId);
    return;
  }

  activeResumables.delete(videoId);
  progressTick.delete(videoId);
  try {
    await entry.resumable.cancelAsync();
  } catch {
    // ignore
  }
  try {
    const info = await FileSystem.getInfoAsync(entry.fileUri);
    if (info.exists) {
      await FileSystem.deleteAsync(entry.fileUri);
    }
  } catch {
    // ignore
  }
  useActiveDownloadsStore.getState().remove(videoId);
}

export { deleteDownload };
