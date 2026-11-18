import { getItem, removeItem, setItem } from '@/lib/storage';
import * as FileSystem from 'expo-file-system/legacy';
import { stat } from 'react-native-saf-x';

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
  /** Media-library asset id — present iff location is 'user' (visible mode). */
  assetId?: string;
  /** SAF document uri — present iff location is 'user' (hidden mode). */
  docUri?: string;
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
  if (meta.location === 'user' && meta.docUri) {
    const { deleteHiddenFile } = await import('./user-space-hidden');
    try {
      await deleteHiddenFile(meta.docUri);
      return;
    } catch {
      // Fall through: the document may already be gone from the folder.
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
 * Repairs entries whose size was never recorded (downloads from before the
 * Content-Length fix, or responses without the header): stat the actual file
 * — wherever it lives — and persist the real byte size. Best effort; entries
 * that cannot be measured keep 0 and the UI falls back to a count-only hint.
 */
export async function backfillMissingSizes(): Promise<void> {
  for (const meta of getAllDownloads()) {
    if (meta.size > 0) continue;
    try {
      let size = 0;
      if (meta.location === 'user' && meta.docUri) {
        size = (await stat(meta.docUri)).size;
      } else {
        // App-dir and media-library entries resolve to plain file:// paths
        // (own MediaStore files are statable by path).
        const info = await FileSystem.getInfoAsync(meta.uri);
        if (info.exists && 'size' in info) size = info.size;
      }
      if (size > 0) saveDownloadMetadata({ ...meta, size });
    } catch {
      // unmeasurable — keep 0
    }
  }
}

// Regex literal: a string-built class would need the backslash re-escaped.
const ILLEGAL_FILENAME = /[/\\:*?"<>|\t\r\n]/g;

/**
 * Human-readable file base name from a video title: strip path-hostile
 * characters, collapse whitespace, cap length. Capped at 60 chars because
 * CJK titles cost 3 UTF-8 bytes each and `_data` paths are limited to 255
 * bytes — the suffix room (` [<id>].mp4`) must survive truncation.
 */
export function readableFilenameFor(title: string): string {
  const base = title
    .replace(ILLEGAL_FILENAME, ' ')
    // Some MimeTypeMap builds fail to resolve the extension of filenames
    // containing spaces/punctuation, which misroutes the MediaStore insert
    // into the generic file collection. Keep letters, digits, - and _ only.
    .replace(/[^\p{L}\p{N}._-]/gu, '_')
    .replace(/_+/g, '_')
    .replace(/[._-]+$/, '')
    .trim()
    .slice(0, 60)
    .trim();
  return base.length > 0 ? base : 'video';
}

/**
 * Renames a staged `{videoId}.mp4` in the app videos/ dir to its readable
 * title. Distinct videos that share a title get an id suffix; re-downloading
 * the same video replaces its old file. Called only on completed transfers —
 * partial files keep their id names (they are the resume points).
 */
export async function renameStagedToReadable(
  stagedUri: string,
  title: string,
  videoId: string
): Promise<string> {
  const base = readableFilenameFor(title);
  let target = `${DOWNLOAD_DIR}${base}.mp4`;
  if (target === stagedUri) return stagedUri;
  if ((await FileSystem.getInfoAsync(target)).exists) {
    target = `${DOWNLOAD_DIR}${base} [${videoId}].mp4`;
  }
  if ((await FileSystem.getInfoAsync(target)).exists) {
    await FileSystem.deleteAsync(target, { idempotent: true });
  }
  await FileSystem.moveAsync({ from: stagedUri, to: target });
  return target;
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
