/**
 * Storage-location setting and whole-library migration between app space
 * (documentDirectory/videos) and user space (system media library).
 *
 * The setting only decides where NEW downloads land; each video's actual
 * location is recorded per-video in its metadata, so mixed states are valid —
 * e.g. the user moved to app space but chose to keep old videos in the media
 * library.
 */
import { storage } from '@/lib/storage';
import * as FileSystem from 'expo-file-system/legacy';

import {
  type DownloadMetadata,
  ensureDownloadDir,
  getAllDownloads,
  localUriFor,
  saveDownloadMetadata,
} from './index';
export { getAllDownloads } from './index';
import { moveUserSpaceAssetToApp, placeIntoUserSpace } from './user-space';

export type StorageLocation = 'app' | 'user';

const STORAGE_LOCATION_KEY = 'settings.storageLocation';

/** Plain MMKV string (not JSON-wrapped) so useMMKVString binds to it directly. */
export function getStorageLocation(): StorageLocation {
  return storage.getString(STORAGE_LOCATION_KEY) === 'user' ? 'user' : 'app';
}

export function setStorageLocation(loc: StorageLocation): void {
  storage.set(STORAGE_LOCATION_KEY, loc);
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

type Failure = { videoId: string; title: string; reason: string };

type MigrationResult = {
  moved: number;
  failed: Failure[];
};

/**
 * App → user: every app-space video is copied into the media library and the
 * app-space original removed. A failing video is left untouched in app space
 * (never half-moved) and reported; the caller decides how to surface it.
 */
export async function migrateAllToUserSpace(
  onProgress?: (p: MigrationProgress) => void
): Promise<MigrationResult> {
  const metas = getAllDownloads().filter((m) => (m.location ?? 'app') === 'app');
  return runMigration(metas, 'app-to-user', onProgress);
}

/**
 * User → app: every user-space video is copied back into the app directory and
 * its media-library entry deleted.
 */
export async function migrateAllToAppSpace(
  onProgress?: (p: MigrationProgress) => void
): Promise<MigrationResult> {
  const metas = getAllDownloads().filter((m) => m.location === 'user');
  return runMigration(metas, 'user-to-app', onProgress);
}

async function runMigration(
  metas: DownloadMetadata[],
  direction: 'app-to-user' | 'user-to-app',
  onProgress?: (p: MigrationProgress) => void
): Promise<MigrationResult> {
  const failed: Failure[] = [];
  let done = 0;

  if (direction === 'user-to-app') await ensureDownloadDir();

  for (const meta of metas) {
    onProgress?.({ done, total: metas.length, currentTitle: meta.title });
    try {
      if (direction === 'app-to-user') {
        const placed = await placeIntoUserSpace(meta.uri);
        await FileSystem.deleteAsync(meta.uri, { idempotent: true });
        saveDownloadMetadata({
          ...meta,
          uri: placed.uri,
          assetId: placed.assetId,
          location: 'user',
        });
      } else {
        const appUri = localUriFor(meta.videoId);
        if (!meta.assetId) throw new Error('missing assetId');
        await moveUserSpaceAssetToApp(meta.assetId, meta.uri, appUri);
        saveDownloadMetadata({ ...meta, uri: appUri, location: 'app', assetId: undefined });
      }
      done += 1;
    } catch (error) {
      failed.push({
        videoId: meta.videoId,
        title: meta.title,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  onProgress?.({ done, total: metas.length, currentTitle: '' });
  return { moved: done, failed };
}
