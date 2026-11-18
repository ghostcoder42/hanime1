/**
 * Hidden user space — a user-chosen SAF folder (Android). Files are written
 * directly, outside MediaStore, next to a `.nomedia` marker so media scanners
 * and gallery apps never index them; the folder survives an app uninstall.
 * All access goes through content:// document URIs held by a persisted
 * tree permission (granted when the user picks the folder).
 */
import * as FileSystem from 'expo-file-system/legacy';
import { readableFilenameFor } from './index';
import { removeItem, storage } from '@/lib/storage';
import { copyFile, exists, openDocumentTree, unlink } from 'react-native-saf-x';

const HIDDEN_TREE_KEY = 'settings.hiddenFolderUri';
const NOMEDIA = '.nomedia';

export function getHiddenFolderUri(): string | null {
  return storage.getString(HIDDEN_TREE_KEY) ?? null;
}

export function setHiddenFolderUri(uri: string | null): void {
  if (uri === null) removeItem(HIDDEN_TREE_KEY);
  else storage.set(HIDDEN_TREE_KEY, uri);
}

/**
 * Human-readable path of the picked folder, as file managers show it.
 * `content://com.android.externalstorage.documents/tree/primary%3Ahanm`
 * -> `/storage/emulated/0/hanm`; SD-card volumes keep their raw id.
 */
export function getHiddenFolderDisplayPath(): string | null {
  const uri = getHiddenFolderUri();
  if (!uri) return null;
  try {
    const decoded = decodeURIComponent(uri);
    const marker = 'com.android.externalstorage.documents/tree/';
    const at = decoded.indexOf(marker);
    if (at < 0) return decoded;
    const vol = decoded.slice(at + marker.length);
    const colon = vol.indexOf(':');
    if (colon < 0) return `/${vol}`;
    const volume = vol.slice(0, colon);
    const sub = vol.slice(colon + 1);
    if (volume === 'primary') return `/storage/emulated/0/${sub}`;
    return `/${volume}/${sub}`;
  } catch {
    return uri;
  }
}

async function ensureNoMedia(treeUri: string): Promise<void> {
  const marker = `${treeUri}/${NOMEDIA}`;
  try {
    if (await exists(marker)) return;
  } catch {
    // saf-x rejects (instead of resolving false) when the file is absent —
    // that is exactly the case where the marker must be created.
  }
  // Neither writeFile nor createFile can place a dot-file: writeFile
  // resolves the destination as an existing document, and createFile strips
  // the name at the first dot when a mime is set (".nomedia" -> ""). A
  // zero-byte staged copy through copyFile lands it — the same placement
  // path the video migrations use.
  const staging = `${FileSystem.cacheDirectory}${NOMEDIA}`;
  await FileSystem.writeAsStringAsync(staging, '', { encoding: 'utf8' });
  await copyFile(staging, marker, { replaceIfDestinationExists: true });
}

/**
 * System folder picker. Returns the persisted tree URI (with .nomedia
 * ensured), or null when the user cancelled / picking failed.
 */
/**
 * Picks a folder and persists the grant. A `.nomedia` marker is attempted
 * best-effort: some storage providers throw when asked to resolve a
 * dot-file by name instead of reporting it absent, which would otherwise
 * block the whole folder switch — the marker is an anti-indexing
 * optimization, not a precondition for using the folder.
 */
export async function pickHiddenFolder(): Promise<{ uri: string; markerFailed: boolean }> {
  const folder = await openDocumentTree(true);
  if (!folder) return { uri: '', markerFailed: false };
  let markerFailed = false;
  try {
    await ensureNoMedia(folder.uri);
  } catch {
    markerFailed = true;
  }
  setHiddenFolderUri(folder.uri);
  return { uri: folder.uri, markerFailed };
}

export type HiddenPlacement = {
  /** Playable content:// uri of the stored file. */
  uri: string;
};

/**
 * Copies a staged app-space file into the hidden folder under its readable
 * title (native-side stream copy — no bridge payload for large videos).
 * A same-title clash with a different video falls back to an id suffix;
 * the same video re-placed overwrites its own file.
 */
export async function placeIntoHiddenFolder(
  fileUri: string,
  title: string,
  videoId: string,
  treeUri: string,
  existingDocUri?: string
): Promise<HiddenPlacement> {
  const base = readableFilenameFor(title);
  let name = `${base}.mp4`;
  if (await exists(`${treeUri}/${name}`)) {
    // Re-placing the SAME video (its old document is still there, e.g. after
    // an interrupted migration) overwrites in place; a different video that
    // merely shares the sanitized title gets an id suffix instead.
    if (existingDocUri !== `${treeUri}/${name}`) name = `${base} [${videoId}].mp4`;
  }
  const detail = await copyFile(fileUri, `${treeUri}/${name}`, {
    replaceIfDestinationExists: true,
  });
  if (!detail) throw new Error('SAF copy returned no document');
  return { uri: detail.uri };
}

/** Copies a hidden file back into the app videos/ directory. */
export async function copyHiddenToApp(docUri: string, appUri: string): Promise<void> {
  await copyFile(docUri, appUri, { replaceIfDestinationExists: true });
}

/** Removes a hidden file. Best effort — a gone file must not block deletion. */
export async function deleteHiddenFile(docUri: string): Promise<void> {
  await unlink(docUri);
}
