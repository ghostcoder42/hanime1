import { getItem, removeItem, setItem } from '@/lib/storage';
import * as FileSystem from 'expo-file-system/legacy';

export const DOWNLOAD_DIR = `${FileSystem.documentDirectory}videos/`;

export type DownloadMetadata = {
  videoId: string;
  title: string;
  thumbnail: string;
  /** Playable local file:// uri (app dir or media-library path). */
  uri: string;
  size: number;
  resolution: number;
  downloadedAt: number;
  author?: string;
  /** Where the file lives. Absent = 'app' (entries predate the setting). */
  location?: 'app' | 'user';
  /** Media-library asset id — present iff location is 'user'. */
  assetId?: string;
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

/**
 * Removes a video's file from wherever it lives. User-space entries must go
 * through the media library (a plain unlink of the MediaStore path is not
 * permitted on modern Android); falls back to a path delete when the media
 * entry is already gone (e.g. user removed it from the gallery app).
 */
async function removeVideoFile(meta: DownloadMetadata): Promise<void> {
  if (meta.location === 'user' && meta.assetId) {
    const { deleteFromUserSpace } = await import('./user-space');
    try {
      await deleteFromUserSpace(meta.assetId);
      return;
    } catch {
      // Fall through: the asset may already be gone from the media library.
    }
  }
  const info = await FileSystem.getInfoAsync(meta.uri);
  if (info.exists) {
    await FileSystem.deleteAsync(meta.uri, { idempotent: true });
  }
}

export async function deleteDownload(videoId: string): Promise<void> {
  const meta = getDownloadByVideoId(videoId);
  if (meta) {
    await removeVideoFile(meta);
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
    await removeVideoFile(meta);
  }
  removeItem(KEY);
}

export function localUriFor(videoId: string): string {
  return `${DOWNLOAD_DIR}${videoId}.mp4`;
}

/**
 * Orphan cleanup: deletes on-disk `.mp4` files in the videos/ directory that
 * have no metadata entry and no active task (a half-download belonging to a
 * persisted task is the resume point — it must survive). Returns the videoIds
 * that were removed. Safe to run repeatedly.
 */
export async function reconcileDownloads(excludeIds: Set<string> = new Set()): Promise<string[]> {
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
    if (!(videoId in map) && !excludeIds.has(videoId)) {
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
