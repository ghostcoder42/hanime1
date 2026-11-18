/**
 * Storage-location setting and whole-library migration between app space
 * (documentDirectory/videos) and user space. User space has two modes:
 * the system media library (indexed, album "HAnime1") or a hidden SAF
 * folder (`.nomedia`, not indexed — Android only).
 *
 * The settings only decide where NEW downloads land; each video's actual
 * location is recorded per-video in its metadata, so mixed states are valid.
 */
import { storage } from '@/lib/storage';
import * as FileSystem from 'expo-file-system/legacy';

import {
  type DownloadMetadata,
  ensureDownloadDir,
  getAllDownloads,
  localUriFor,
  renameStagedToReadable,
  saveDownloadMetadata,
} from './index';
export { getAllDownloads } from './index';
import { deleteFromUserSpace, moveUserSpaceAssetToApp, placeIntoUserSpace } from './user-space';
import {
  copyHiddenToApp,
  deleteHiddenFile,
  getHiddenFolderUri,
  placeIntoHiddenFolder,
} from './user-space-hidden';
import { copyFile, exists } from 'react-native-saf-x';

export type StorageLocation = 'app' | 'user';
export type UserSpaceMode = 'media' | 'hidden';

const STORAGE_LOCATION_KEY = 'settings.storageLocation';
const USER_SPACE_MODE_KEY = 'settings.userSpaceMode';

/** Plain MMKV strings (not JSON-wrapped) so useMMKVString binds directly. */
export function getStorageLocation(): StorageLocation {
  return storage.getString(STORAGE_LOCATION_KEY) === 'user' ? 'user' : 'app';
}

export function setStorageLocation(loc: StorageLocation): void {
  storage.set(STORAGE_LOCATION_KEY, loc);
}

export function getUserSpaceMode(): UserSpaceMode {
  return storage.getString(USER_SPACE_MODE_KEY) === 'hidden' ? 'hidden' : 'media';
}

export function setUserSpaceMode(mode: UserSpaceMode): void {
  storage.set(USER_SPACE_MODE_KEY, mode);
}

export type MigrationProgress = {
  done: number;
  total: number;
  currentTitle: string;
};

/** Whether at least one stored video still lives in the given space. */
export function hasVideosIn(loc: StorageLocation): boolean {
  return getAllDownloads().some((m) => (m.location ?? 'app') === loc);
}

export function hasVideosInMedia(): boolean {
  return getAllDownloads().some((m) => m.location === 'user' && m.assetId);
}

export function hasVideosInHidden(): boolean {
  return getAllDownloads().some((m) => m.location === 'user' && m.docUri);
}

type Failure = { videoId: string; title: string; reason: string };

export type MigrationResult = {
  moved: number;
  failed: Failure[];
};

/** Sentinel failure reason for a full disk (mapped from ENOSPC-style errors). */
export const NO_SPACE = 'no-space';

const NO_SPACE_HINTS = ['ENOSPC', 'No space left', 'no space left on device'];

function friendlyReason(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  return NO_SPACE_HINTS.some((h) => msg.includes(h)) ? NO_SPACE : msg;
}

/**
 * A migration copies every file before deleting the source, so the larger of
 * the two spaces must hold the whole library transiently. Returns false when
 * free space (5% headroom) can't cover it. Both spaces usually share one
 * physical volume, so one free-space number covers either direction.
 */
export async function hasFreeSpaceForMigration(): Promise<boolean> {
  const metas = getAllDownloads();
  const needed = metas.reduce((n, m) => n + (m.size || 0), 0);
  if (needed <= 0) return true;
  try {
    const free = await FileSystem.getFreeDiskStorageAsync();
    return free > needed * 1.05;
  } catch {
    return true; // unknown -> let the copy fail with its own mapped error
  }
}

/**
 * App → user: every app-space video is copied into the media library and the
 * app-space original removed. A failing video is left untouched in app space
 * (never half-moved) and reported; the caller decides how to surface it.
 */
export async function migrateAllToUserSpace(
  onProgress?: (p: MigrationProgress) => void
): Promise<MigrationResult> {
  const metas = getAllDownloads().filter((m) => (m.location ?? 'app') === 'app');
  // Hidden mode must apply here too — otherwise files moved "to user space"
  // land in the indexed media library instead of the picked folder.
  const hidden = getUserSpaceMode() === 'hidden';
  const treeUri = getHiddenFolderUri();
  return runMigration(metas, onProgress, async (meta) => {
    const stagedUri = await renameStagedToReadable(meta.uri, meta.title, meta.videoId);
    if (hidden) {
      if (!treeUri) throw new Error('hidden folder not selected');
      const placed = await placeIntoHiddenFolder(
        stagedUri,
        meta.title,
        meta.videoId,
        treeUri,
        meta.docUri
      );
      await FileSystem.deleteAsync(stagedUri, { idempotent: true });
      saveDownloadMetadata({ ...meta, uri: placed.uri, docUri: placed.uri, location: 'user' });
      return;
    }
    const placed = await placeIntoUserSpace(stagedUri);
    await FileSystem.deleteAsync(stagedUri, { idempotent: true });
    saveDownloadMetadata({ ...meta, uri: placed.uri, assetId: placed.assetId, location: 'user' });
  });
}

/** User → app: copies back into the app directory and deletes the entries. */
export async function migrateAllToAppSpace(
  onProgress?: (p: MigrationProgress) => void
): Promise<MigrationResult> {
  await ensureDownloadDir();
  const metas = getAllDownloads().filter((m) => m.location === 'user');
  return runMigration(metas, onProgress, async (meta) => {
    const appUri = localUriFor(meta.videoId);
    if (meta.assetId) {
      await moveUserSpaceAssetToApp(meta.assetId, meta.uri, appUri);
    } else {
      if (!meta.docUri) throw new Error('missing document reference');
      await copyHiddenToApp(meta.docUri, appUri);
      await deleteHiddenFile(meta.docUri).catch(() => {});
    }
    saveDownloadMetadata({
      ...meta,
      uri: appUri,
      location: 'app',
      assetId: undefined,
      docUri: undefined,
    });
  });
}

/** Media library → hidden SAF folder. */
export async function migrateMediaToHidden(
  onProgress?: (p: MigrationProgress) => void
): Promise<MigrationResult> {
  const treeUri = getHiddenFolderUri();
  if (!treeUri) return { moved: 0, failed: [] };
  const metas = getAllDownloads().filter((m) => m.location === 'user' && m.assetId);
  return runMigration(metas, onProgress, async (meta) => {
    // meta.uri is the MediaStore file path — the copy source.
    const placed = await placeIntoHiddenFolder(
      meta.uri,
      meta.title,
      meta.videoId,
      treeUri,
      meta.docUri
    );
    await deleteFromUserSpace(meta.assetId as string);
    saveDownloadMetadata({
      ...meta,
      uri: placed.uri,
      assetId: undefined,
      docUri: placed.uri,
    });
  });
}

/**
 * Hidden folder -> hidden folder (the user switched the download folder):
 * copies every video under the old tree into the new one, deletes the old
 * documents and repoints the metadata. Files keep their (already readable)
 * names; a clash with a pre-existing different file gets an id suffix.
 */
export async function migrateHiddenFolder(
  newTreeUri: string,
  onProgress?: (p: MigrationProgress) => void
): Promise<MigrationResult> {
  // Everything not already under the new tree — including strays left in
  // folders from earlier switches, not just the previously pointed one.
  const metas = getAllDownloads().filter((m) => m.docUri && !m.docUri.startsWith(`${newTreeUri}/`));
  return runMigration(metas, onProgress, async (meta) => {
    const docUri = meta.docUri as string;
    let name = docUri.slice(docUri.lastIndexOf('/') + 1);
    if (await exists(`${newTreeUri}/${name}`)) {
      const dot = name.lastIndexOf('.');
      name = `${name.slice(0, dot)} [${meta.videoId}]${name.slice(dot)}`;
    }
    const placed = await copyFile(docUri, `${newTreeUri}/${name}`, {
      replaceIfDestinationExists: true,
    });
    if (!placed) throw new Error('SAF copy returned no document');
    await deleteHiddenFile(docUri);
    saveDownloadMetadata({ ...meta, uri: placed.uri, docUri: placed.uri });
  });
}

/** Hidden SAF folder → media library. */
export async function migrateHiddenToMedia(
  onProgress?: (p: MigrationProgress) => void
): Promise<MigrationResult> {
  await ensureDownloadDir();
  const metas = getAllDownloads().filter((m) => m.location === 'user' && m.docUri);
  return runMigration(metas, onProgress, async (meta) => {
    const staging = localUriFor(meta.videoId);
    await copyHiddenToApp(meta.docUri as string, staging);
    const named = await renameStagedToReadable(staging, meta.title, meta.videoId);
    try {
      const placed = await placeIntoUserSpace(named);
      await FileSystem.deleteAsync(named, { idempotent: true });
      await deleteHiddenFile(meta.docUri as string).catch(() => {});
      saveDownloadMetadata({
        ...meta,
        uri: placed.uri,
        assetId: placed.assetId,
        docUri: undefined,
      });
    } catch (error) {
      // The hidden file is untouched; drop the staged copy.
      await FileSystem.deleteAsync(named, { idempotent: true }).catch(() => {});
      throw error;
    }
  });
}

async function runMigration(
  metas: DownloadMetadata[],
  onProgress: ((p: MigrationProgress) => void) | undefined,
  move: (meta: DownloadMetadata) => Promise<void>
): Promise<MigrationResult> {
  const failed: Failure[] = [];
  let done = 0;

  for (const meta of metas) {
    onProgress?.({ done, total: metas.length, currentTitle: meta.title });
    try {
      await move(meta);
      done += 1;
    } catch (error) {
      failed.push({
        videoId: meta.videoId,
        title: meta.title,
        reason: friendlyReason(error),
      });
    }
  }

  onProgress?.({ done, total: metas.length, currentTitle: '' });
  return { moved: done, failed };
}
