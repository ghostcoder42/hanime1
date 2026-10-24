/**
 * "User space" storage — the system media library (MediaStore on Android,
 * Photos on iOS) instead of the app-private directory. Files land in a
 * dedicated album ("HAnime1") so they are grouped in gallery apps and
 * survive an app uninstall; in exchange every mutation (delete, move back)
 * must go through media-library APIs, not plain file paths.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { Album, Asset, requestPermissionsAsync } from 'expo-media-library';

export const USER_SPACE_ALBUM = 'HAnime1';

/**
 * Must be granted before the first save. Re-requesting when already granted
 * resolves immediately without a dialog.
 */
export async function ensureUserSpacePermission(): Promise<boolean> {
  const res = await requestPermissionsAsync();
  return res.granted;
}

async function ensureAlbum(): Promise<Album | undefined> {
  try {
    const existing = await Album.get(USER_SPACE_ALBUM);
    if (existing) return existing;
    return await Album.create(USER_SPACE_ALBUM, [], false);
  } catch {
    // Album grouping is cosmetic — a failed lookup must not block the save.
    return undefined;
  }
}

export type UserSpacePlacement = {
  /** Playable file:// path (MediaStore _data on Android, export on iOS). */
  uri: string;
  /** Media-library asset id — the only stable handle for later delete/move. */
  assetId: string;
};

/**
 * Copies a freshly downloaded file from app space into the media library and
 * removes the app-space original. Throws when the permission is missing or the
 * insert fails — the caller keeps the app-space file as-is in that case.
 */
export async function placeIntoUserSpace(fileUri: string): Promise<UserSpacePlacement> {
  const album = await ensureAlbum();
  const asset = await Asset.create(fileUri, album);
  const uri = await asset.getUri();
  return { uri, assetId: asset.id };
}

/** Deletes a media-library asset by its persisted id. Best effort. */
export async function deleteFromUserSpace(assetId: string): Promise<void> {
  await new Asset(assetId).delete();
}

/**
 * Copies a user-space asset back into the app `videos/` directory and deletes
 * the media-library entry. Returns the app-space uri. The source uri is a
 * plain file:// path (own MediaStore rows are readable that way), so this is
 * a regular file copy.
 */
export async function moveUserSpaceAssetToApp(
  assetId: string,
  sourceUri: string,
  appUri: string
): Promise<void> {
  await FileSystem.makeDirectoryAsync(appUri.slice(0, appUri.lastIndexOf('/') + 1), {
    intermediates: true,
  });
  await FileSystem.copyAsync({ from: sourceUri, to: appUri });
  await deleteFromUserSpace(assetId);
}
