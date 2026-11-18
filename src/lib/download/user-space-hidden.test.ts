jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
}));

import {
  getHiddenFolderDisplayPath,
  pickHiddenFolder,
  placeIntoHiddenFolder,
  setHiddenFolderUri,
} from './user-space-hidden';
import { storage } from '@/lib/storage';
import { copyFile, createFile, exists, openDocumentTree } from 'react-native-saf-x';

const mockExists = exists as jest.Mock;
const mockCopy = copyFile as jest.Mock;
const mockPick = openDocumentTree as jest.Mock;
const mockCreate = createFile as jest.Mock;

const KEY = 'settings.hiddenFolderUri';

beforeEach(() => {
  storage.remove(KEY);
  mockExists.mockReset().mockResolvedValue(false);
  mockCopy.mockReset().mockResolvedValue({ uri: 'content://tree/x/out.mp4' });
  mockPick.mockReset();
  mockCreate.mockReset().mockResolvedValue({ uri: 'content://tree/x/.nomedia' });
});

describe('getHiddenFolderDisplayPath', () => {
  it('renders the canonical path for the primary volume', () => {
    setHiddenFolderUri('content://com.android.externalstorage.documents/tree/primary%3Ahanm');
    expect(getHiddenFolderDisplayPath()).toBe('/storage/emulated/0/hanm');
  });

  it('keeps the raw volume id for removable storage', () => {
    setHiddenFolderUri('content://com.android.externalstorage.documents/tree/6634-3234%3Avideos');
    expect(getHiddenFolderDisplayPath()).toBe('/6634-3234/videos');
  });

  it('passes through non-storage-provider uris and the unset state', () => {
    setHiddenFolderUri('content://other.provider/tree/x');
    expect(getHiddenFolderDisplayPath()).toBe('content://other.provider/tree/x');
    storage.remove(KEY);
    expect(getHiddenFolderDisplayPath()).toBeNull();
  });
});

describe('placeIntoHiddenFolder naming', () => {
  const TREE = 'content://tree/x';

  it('uses the plain readable name when the folder is clear', async () => {
    await placeIntoHiddenFolder('file:///staged.mp4', 'My Video', '7', TREE);
    expect(mockCopy).toHaveBeenCalledWith('file:///staged.mp4', `${TREE}/My_Video.mp4`, {
      replaceIfDestinationExists: true,
    });
  });

  it('suffices the id when a different file holds the name', async () => {
    mockExists.mockResolvedValue(true);
    await placeIntoHiddenFolder('file:///staged.mp4', 'My Video', '7', TREE);
    expect(mockCopy).toHaveBeenCalledWith('file:///staged.mp4', `${TREE}/My_Video [7].mp4`, {
      replaceIfDestinationExists: true,
    });
  });

  it("overwrites in place when the clash is the same video's own document", async () => {
    mockExists.mockResolvedValue(true);
    await placeIntoHiddenFolder(
      'file:///staged.mp4',
      'My Video',
      '7',
      TREE,
      `${TREE}/My_Video.mp4`
    );
    expect(mockCopy).toHaveBeenCalledWith('file:///staged.mp4', `${TREE}/My_Video.mp4`, {
      replaceIfDestinationExists: true,
    });
  });
});

describe('pickHiddenFolder', () => {
  it('creates the .nomedia marker when exists() rejects for a missing file', async () => {
    mockPick.mockResolvedValue({ uri: 'content://tree/primary%3AMovies' });
    mockExists.mockRejectedValue(new Error('Missing file'));

    const result = await pickHiddenFolder();

    expect(result).toEqual({ uri: 'content://tree/primary%3AMovies', markerFailed: false });
    expect(mockCopy).toHaveBeenCalledWith(
      'file:///cache/.nomedia',
      'content://tree/primary%3AMovies/.nomedia',
      {
        replaceIfDestinationExists: true,
      }
    );
  });

  it('still persists the folder when the marker cannot be created', async () => {
    mockPick.mockResolvedValue({
      uri: 'content://com.android.externalstorage.documents/tree/primary%3AMovies',
    });
    mockExists.mockRejectedValue(new Error('Missing file'));
    mockCopy.mockRejectedValue(new Error('provider rejects dotfiles'));

    const result = await pickHiddenFolder();

    expect(result).toEqual({
      uri: 'content://com.android.externalstorage.documents/tree/primary%3AMovies',
      markerFailed: true,
    });
    expect(getHiddenFolderDisplayPath()).toBe('/storage/emulated/0/Movies');
  });
});
