import { getItem, removeItem, setItem } from '@/lib/storage';
import * as FileSystem from 'expo-file-system/legacy';

export const DOWNLOAD_DIR = `${FileSystem.documentDirectory}videos/`;

export type DownloadMetadata = {
  videoId: string;
  title: string;
  thumbnail: string;
  /** local file:// uri */
  uri: string;
  size: number;
  resolution: number;
  downloadedAt: number;
  author?: string;
};

const KEY = 'download_metadata';

type DownloadMap = Record<string, DownloadMetadata>;

function readMap(): DownloadMap {
  return getItem<DownloadMap>(KEY) ?? {};
}

export async function ensureDownloadDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
  }
}

export function getAllDownloads(): DownloadMetadata[] {
  return Object.values(readMap()).sort((a, b) => b.downloadedAt - a.downloadedAt);
}

export function getDownloadByVideoId(videoId: string): DownloadMetadata | null {
  return readMap()[videoId] ?? null;
}

export function saveDownloadMetadata(meta: DownloadMetadata): void {
  const map = readMap();
  map[meta.videoId] = meta;
  setItem(KEY, map);
}

export async function deleteDownload(videoId: string): Promise<void> {
  const meta = getDownloadByVideoId(videoId);
  if (meta) {
    const info = await FileSystem.getInfoAsync(meta.uri);
    if (info.exists) {
      await FileSystem.deleteAsync(meta.uri, { idempotent: true });
    }
  }
  const map = readMap();
  delete map[videoId];
  if (Object.keys(map).length === 0) {
    removeItem(KEY);
  } else {
    setItem(KEY, map);
  }
}

export async function clearAllDownloads(): Promise<void> {
  for (const meta of getAllDownloads()) {
    const info = await FileSystem.getInfoAsync(meta.uri);
    if (info.exists) {
      await FileSystem.deleteAsync(meta.uri, { idempotent: true });
    }
  }
  removeItem(KEY);
}

export function localUriFor(videoId: string): string {
  return `${DOWNLOAD_DIR}${videoId}.mp4`;
}

/**
 * Orphan cleanup: deletes on-disk `.mp4` files in the videos/ directory that
 * have no metadata entry (left over from interrupted or legacy downloads).
 * Returns the videoIds that were removed. Safe to run repeatedly.
 */
export async function reconcileDownloads(): Promise<string[]> {
  const map = readMap();
  const removed: string[] = [];
  let dirInfo: FileSystem.FileInfo;
  try {
    dirInfo = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
  } catch {
    return removed;
  }
  if (!dirInfo.exists) return removed;

  let entries: string[] = [];
  try {
    entries = await FileSystem.readDirectoryAsync(DOWNLOAD_DIR);
  } catch {
    return removed;
  }

  for (const name of entries) {
    if (!name.endsWith('.mp4')) continue;
    const videoId = name.slice(0, -'.mp4'.length);
    if (!(videoId in map)) {
      try {
        await FileSystem.deleteAsync(`${DOWNLOAD_DIR}${name}`, { idempotent: true });
        removed.push(videoId);
      } catch {
        // ignore individual failures
      }
    }
  }
  return removed;
}
