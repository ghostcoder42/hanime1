import { fetchVideoDetail } from '@/lib/hanime1/scraper';
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

/**
 * Live resumables, keyed by videoId. Kept on FAILURE too — that is what makes
 * a retry resumable: `resumeAsync()` continues from the bytes already on disk
 * (the signed CDN URLs honour Range). Entries are dropped on success, cancel
 * and app restart (resume state is in-memory only).
 */
const activeResumables = new Map<
  string,
  { resumable: FileSystem.DownloadResumable; fileUri: string; opts: DownloadVideoOptions }
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

type DownloadResult = FileSystem.FileSystemDownloadResult;

/** Shared success path for downloadAsync() and resumeAsync() results. */
async function finalizeDownload(
  opts: DownloadVideoOptions,
  result: DownloadResult | undefined
): Promise<DownloadMetadata> {
  const { videoId, title, thumbnail, resolution, author } = opts;
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
  const { videoId, videoUrl, onProgress } = opts;

  await ensureDownloadDir();
  const fileUri = localUriFor(videoId);
  // Drop any partial file from an earlier interrupted attempt so this always
  // starts clean — this is the from-scratch path, resume goes through the
  // resumable kept from the failed attempt instead.
  try {
    const stale = await FileSystem.getInfoAsync(fileUri);
    if (stale.exists) await FileSystem.deleteAsync(fileUri, { idempotent: true });
  } catch {
    // ignore — worst case the resumable overwrites it
  }

  const resumable = FileSystem.createDownloadResumable(videoUrl, fileUri, {}, (dl) => {
    const written = dl.totalBytesWritten;
    const expected = dl.totalBytesExpectedToWrite;
    onProgress?.(expected > 0 ? written / expected : 0);
    reportProgress(videoId, written, expected);
  });
  activeResumables.set(videoId, { resumable, fileUri, opts });

  try {
    useActiveDownloadsStore.getState().setStatus(videoId, 'downloading');
    const result = await resumable.downloadAsync();
    return await finalizeDownload(opts, result);
  } catch (error) {
    // If the task was already removed/marked cancelled/paused, this was user
    // action, not a failure — don't surface it as an error.
    const task = useActiveDownloadsStore.getState().tasks[videoId];
    if (task && task.status !== 'cancelled' && task.status !== 'paused') {
      useActiveDownloadsStore
        .getState()
        .fail(videoId, error instanceof Error ? error.message : 'Download failed');
    }
    throw error;
  } finally {
    // Keep the resumable (and its on-disk bytes) on failure AND pause so the
    // task can resume from where it stopped; drop it otherwise.
    const status = useActiveDownloadsStore.getState().tasks[videoId]?.status;
    if (status !== 'error' && status !== 'paused') activeResumables.delete(videoId);
    progressTick.delete(videoId);
  }
}

/**
 * Pauses an in-flight download (from the library row). pauseAsync stops the
 * native task at a clean boundary and captures the exact resume offset; the
 * task stays in the table as `paused` with its resumable kept for resuming.
 */
export async function pauseDownload(videoId: string): Promise<void> {
  const entry = activeResumables.get(videoId);
  const task = useActiveDownloadsStore.getState().tasks[videoId];
  if (!entry || !task || task.status !== 'downloading') return;

  // Mark first so the downloadAsync() rejection below is understood as a pause.
  useActiveDownloadsStore.getState().setStatus(videoId, 'paused');
  try {
    await entry.resumable.pauseAsync();
  } catch {
    // Pause failed (task already finishing, …) — the final stretch either
    // completes the download or the task stays paused for a disk-offset resume.
  }
}

/**
 * Continue a failed OR paused download task (library row / watch button /
 * tile menu). Resumes from the bytes already on disk — either through the
 * resumable kept from the failed/paused attempt, or (after an app restart) by
 * rebuilding one from the partial file's size. Falls back to a fresh download
 * with a re-resolved source when resuming is not possible; returns false when
 * no source can be resolved — the task stays errored and the caller should
 * offer deletion instead.
 */
export async function retryDownload(videoId: string): Promise<boolean> {
  const task = useActiveDownloadsStore.getState().tasks[videoId];
  if (!task || (task.status !== 'error' && task.status !== 'paused')) return false;

  // A resumed task is no longer paused.
  if (task.status === 'paused') {
    useActiveDownloadsStore.getState().setStatus(videoId, 'downloading');
  }

  // 1) Resume an interrupted transfer where it stopped.
  let entry = activeResumables.get(videoId);
  if (!entry && task.videoUrl) {
    // After an app restart there is no live resumable, but the partial file
    // IS the resume point: its on-disk size is the byte offset (the native
    // side truncates to it and sends `Range: bytes=<size>-`). A too-low
    // offset is safe; the file simply resumes from slightly earlier.
    try {
      const fileUri = localUriFor(videoId);
      const info = await FileSystem.getInfoAsync(fileUri);
      const partial = info.exists && 'size' in info ? info.size : 0;
      if (partial > 0) {
        const opts: DownloadVideoOptions = {
          videoId,
          videoUrl: task.videoUrl,
          title: task.title,
          thumbnail: task.thumbnail,
          resolution: task.resolution ?? 0,
          author: task.author,
        };
        const resumable = new FileSystem.DownloadResumable(
          task.videoUrl,
          fileUri,
          {},
          (dl) => reportProgress(videoId, dl.totalBytesWritten, dl.totalBytesExpectedToWrite),
          String(partial)
        );
        entry = { resumable, fileUri, opts };
        activeResumables.set(videoId, entry);
      }
    } catch {
      // fall through to the fresh-download path
    }
  }

  if (entry) {
    useActiveDownloadsStore.getState().setStatus(videoId, 'downloading');
    try {
      const result = await entry.resumable.resumeAsync();
      await finalizeDownload(entry.opts, result);
      activeResumables.delete(videoId);
      return true;
    } catch (error) {
      // Resume didn't work (expired signed URL, range rejected, …). Fall
      // through to a fresh download; mark the failure so the row stays
      // actionable if that path also dies immediately.
      const t = useActiveDownloadsStore.getState().tasks[videoId];
      if (t && t.status !== 'cancelled') {
        useActiveDownloadsStore
          .getState()
          .fail(videoId, error instanceof Error ? error.message : 'Download failed');
      }
      activeResumables.delete(videoId);
    }
  }

  // 2) Fresh download, preferring a newly signed source URL.
  let videoUrl = task.videoUrl;
  let resolution = task.resolution ?? 0;
  try {
    const detail = await fetchVideoDetail(videoId);
    const source = detail.sources.find((s) => s.resolution === 720) ?? detail.sources[0];
    if (source) {
      videoUrl = source.url;
      resolution = source.resolution;
    }
  } catch {
    // Still offline / detail gone — fall back to the recorded source.
  }
  if (!videoUrl) {
    // No source anywhere: keep the task errored; deletion remains.
    return false;
  }

  // Restart the task in place so badges immediately flip back to downloading.
  useActiveDownloadsStore.getState().start({
    videoId,
    title: task.title,
    thumbnail: task.thumbnail,
    author: task.author,
    videoUrl,
    resolution,
  });

  try {
    await downloadVideo({
      videoId,
      videoUrl,
      title: task.title,
      thumbnail: task.thumbnail,
      resolution,
      author: task.author,
    });
    return true;
  } catch {
    // downloadVideo already re-marked the task as failed.
    return false;
  }
}

/**
 * Cancels an in-flight download (from the active-downloads UI): cancels the
 * resumable, deletes the partial file, and removes the active task. When there
 * is no resumable (already errored) the partial file is still deleted — this is
 * also the "remove failed task" path.
 */
export async function cancelDownload(videoId: string): Promise<void> {
  const entry = activeResumables.get(videoId);
  // Signal cancellation first so the in-flight downloadVideo won't mark `fail`.
  useActiveDownloadsStore.getState().setStatus(videoId, 'cancelled');

  if (!entry) {
    // No resumable (task already errored): still clear its partial file.
    try {
      const info = await FileSystem.getInfoAsync(localUriFor(videoId));
      if (info.exists) await FileSystem.deleteAsync(localUriFor(videoId), { idempotent: true });
    } catch {
      // ignore
    }
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
