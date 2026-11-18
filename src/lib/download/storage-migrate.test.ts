const mockDownloads = {
  metas: [] as Array<Record<string, unknown>>,
  saved: [] as Array<Record<string, unknown>>,
};

jest.mock('./index', () => ({
  ensureDownloadDir: jest.fn().mockResolvedValue(undefined),
  localUriFor: (id: string) => `file:///doc/videos/${id}.mp4`,
  renameStagedToReadable: jest.fn(
    (_uri: string, title: string, id: string) => `file:///doc/videos/${title} [${id}].mp4`
  ),
  readableFilenameFor: (title: string) => title,
  getAllDownloads: () => mockDownloads.metas,
  saveDownloadMetadata: (meta: Record<string, unknown>) => {
    mockDownloads.saved.push(meta);
    mockDownloads.metas = mockDownloads.metas.map((m) => (m.videoId === meta.videoId ? meta : m));
  },
}));

// Inline factories: jest executes jest.mock factories before the const
// declarations below run, so external references would still be undefined.
jest.mock('./user-space', () => ({
  placeIntoUserSpace: jest.fn(),
  moveUserSpaceAssetToApp: jest.fn(),
  deleteFromUserSpace: jest.fn(),
}));

jest.mock('./user-space-hidden', () => ({
  getHiddenFolderUri: jest.fn().mockReturnValue('content://tree/hidden'),
  placeIntoHiddenFolder: jest.fn(),
  copyHiddenToApp: jest.fn(),
  deleteHiddenFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  getFreeDiskStorageAsync: jest.fn().mockResolvedValue(1024 ** 3),
}));

import { storage } from '@/lib/storage';
import {
  NO_SPACE,
  getStorageLocation,
  migrateHiddenFolder,
  setUserSpaceMode,
  hasFreeSpaceForMigration,
  hasVideosIn,
  migrateAllToAppSpace,
  migrateAllToUserSpace,
  migrateMediaToHidden,
  setStorageLocation,
} from '@/lib/download/storage-migrate';
import * as FileSystem from 'expo-file-system/legacy';
import { deleteFromUserSpace, moveUserSpaceAssetToApp, placeIntoUserSpace } from './user-space';
import { placeIntoHiddenFolder } from './user-space-hidden';

const mockPlace = placeIntoUserSpace as jest.Mock;
const mockMoveBack = moveUserSpaceAssetToApp as jest.Mock;
const mockDeleteAsset = deleteFromUserSpace as jest.Mock;
const mockPlaceHidden = placeIntoHiddenFolder as jest.Mock;
const mockFS = FileSystem as unknown as {
  deleteAsync: jest.Mock;
  copyAsync: jest.Mock;
  makeDirectoryAsync: jest.Mock;
  getFreeDiskStorageAsync: jest.Mock;
};

const appMeta = (id: string) => ({
  videoId: id,
  title: `Video ${id}`,
  thumbnail: '',
  uri: `file:///doc/videos/${id}.mp4`,
  size: 100,
  resolution: 720,
  downloadedAt: 1,
  location: 'app' as const,
});

const userMeta = (id: string) => ({
  ...appMeta(id),
  uri: `file:///storage/emulated/0/Movies/HAnime1/${id}.mp4`,
  location: 'user' as const,
  assetId: `content://media/${id}`,
});

beforeEach(() => {
  mockDownloads.metas = [];
  mockDownloads.saved = [];
  mockPlace.mockReset();
  mockMoveBack.mockReset();
  mockDeleteAsset.mockReset().mockResolvedValue(undefined);
  mockPlaceHidden.mockReset();
  mockFS.deleteAsync.mockClear();
  mockFS.copyAsync.mockClear();
  // @ts-expect-error the in-memory mmkv mock exposes `delete`
  storage.delete('settings.storageLocation');
  // @ts-expect-error the in-memory mmkv mock exposes `delete`
  storage.delete('settings.userSpaceMode');
});

describe('storage location setting', () => {
  it('defaults to app and round-trips user', () => {
    expect(getStorageLocation()).toBe('app');
    setStorageLocation('user');
    expect(getStorageLocation()).toBe('user');
  });

  it('treats metadata without location as app space', () => {
    mockDownloads.metas = [{ ...appMeta('1'), location: undefined }];
    expect(hasVideosIn('app')).toBe(true);
    expect(hasVideosIn('user')).toBe(false);
  });
});

describe('migrateAllToUserSpace', () => {
  it('places each app video into user space and updates metadata', async () => {
    mockDownloads.metas = [appMeta('1'), appMeta('2')];
    mockPlace.mockImplementation(async (uri: string) => ({
      uri: `file:///storage${uri.slice(7)}`,
      assetId: `content://media/x`,
    }));

    const progress: number[] = [];
    const result = await migrateAllToUserSpace((p) => progress.push(p.done));

    expect(mockPlace).toHaveBeenCalledTimes(2);
    expect(mockFS.deleteAsync).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ moved: 2, failed: [] });
    expect(mockDownloads.saved.every((m) => m.location === 'user' && m.assetId)).toBe(true);
    expect(progress).toEqual([0, 1, 2]);
  });

  it('leaves a failing video untouched and reports it', async () => {
    mockDownloads.metas = [appMeta('1')];
    mockPlace.mockRejectedValue(new Error('no permission'));

    const result = await migrateAllToUserSpace();

    expect(result.moved).toBe(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({ videoId: '1', reason: 'no permission' });
    expect(mockDownloads.saved).toHaveLength(0);
    expect(mockFS.deleteAsync).not.toHaveBeenCalled();
  });
});

describe('disk-space precheck and error mapping', () => {
  it('blocks the migration when free space cannot cover the library', async () => {
    mockDownloads.metas = [appMeta('1'), appMeta('2')];
    // Each meta is size:100; 200 bytes needed, free 100 -> insufficient.
    mockFS.getFreeDiskStorageAsync.mockResolvedValueOnce(100);
    await expect(hasFreeSpaceForMigration()).resolves.toBe(false);
  });

  it('allows the migration with ample free space', async () => {
    mockDownloads.metas = [appMeta('1')];
    await expect(hasFreeSpaceForMigration()).resolves.toBe(true);
  });

  it('maps ENOSPC-style copy failures to the no-space reason', async () => {
    mockDownloads.metas = [appMeta('1')];
    mockPlace.mockRejectedValueOnce(new Error('write failed: ENOSPC (28)'));
    const result = await migrateAllToUserSpace();
    expect(result.failed[0]?.reason).toBe(NO_SPACE);
    expect(mockFS.deleteAsync).not.toHaveBeenCalled();
  });
});

describe('migrateAllToAppSpace', () => {
  it('moves user videos back and clears their asset ids', async () => {
    mockDownloads.metas = [userMeta('1')];
    mockMoveBack.mockResolvedValue(undefined);

    const result = await migrateAllToAppSpace();

    expect(mockMoveBack).toHaveBeenCalledWith(
      'content://media/1',
      'file:///storage/emulated/0/Movies/HAnime1/1.mp4',
      'file:///doc/videos/1.mp4'
    );
    expect(result).toEqual({ moved: 1, failed: [] });
    expect(mockDownloads.saved[0]).toMatchObject({
      uri: 'file:///doc/videos/1.mp4',
      location: 'app',
      assetId: undefined,
    });
  });

  it('skips entries missing an assetId and reports them as failed', async () => {
    mockDownloads.metas = [{ ...userMeta('1'), assetId: undefined }];

    const result = await migrateAllToAppSpace();

    expect(result.moved).toBe(0);
    expect(result.failed).toHaveLength(1);
    expect(mockMoveBack).not.toHaveBeenCalled();
  });
});

describe('app -> user migration respects hidden mode', () => {
  it('places into the SAF folder when hidden mode is active', async () => {
    setUserSpaceMode('hidden');
    mockDownloads.metas = [appMeta('1')];
    mockPlaceHidden.mockResolvedValue({ uri: 'content://tree/hidden/Video_1.mp4' });

    await migrateAllToUserSpace();

    expect(mockPlaceHidden).toHaveBeenCalled();
    expect(mockPlace).not.toHaveBeenCalled();
    expect(mockDownloads.saved[0]).toMatchObject({
      uri: 'content://tree/hidden/Video_1.mp4',
      docUri: 'content://tree/hidden/Video_1.mp4',
      location: 'user',
    });
  });

  it('fails with a clear reason when no hidden folder is granted', async () => {
    setUserSpaceMode('hidden');
    const { getHiddenFolderUri } = jest.requireMock('./user-space-hidden') as {
      getHiddenFolderUri: jest.Mock;
    };
    getHiddenFolderUri.mockReturnValueOnce(null);
    mockDownloads.metas = [appMeta('1')];

    const result = await migrateAllToUserSpace();

    expect(result.moved).toBe(0);
    expect(result.failed[0]?.reason).toBe('hidden folder not selected');
  });
});

describe('media <-> hidden migrations', () => {
  it('moves media assets into the hidden folder and swaps ids for doc uris', async () => {
    mockDownloads.metas = [userMeta('1')];
    mockPlaceHidden.mockResolvedValue({ uri: 'content://tree/hidden/1.mp4' });

    const result = await migrateMediaToHidden();

    expect(mockPlaceHidden).toHaveBeenCalledWith(
      'file:///storage/emulated/0/Movies/HAnime1/1.mp4',
      'Video 1',
      '1',
      'content://tree/hidden',
      undefined
    );
    expect(mockDeleteAsset).toHaveBeenCalledWith('content://media/1');
    expect(result).toEqual({ moved: 1, failed: [] });
    expect(mockDownloads.saved[0]).toMatchObject({
      uri: 'content://tree/hidden/1.mp4',
      docUri: 'content://tree/hidden/1.mp4',
      assetId: undefined,
    });
  });

  it('no-ops when no hidden folder has been picked', async () => {
    mockDownloads.metas = [userMeta('1')];
    const { getHiddenFolderUri } = jest.requireMock('./user-space-hidden') as {
      getHiddenFolderUri: jest.Mock;
    };
    getHiddenFolderUri.mockReturnValueOnce(null);

    const result = await migrateMediaToHidden();

    expect(result).toEqual({ moved: 0, failed: [] });
    expect(mockPlaceHidden).not.toHaveBeenCalled();
  });
});

describe('migrateHiddenFolder (folder switch)', () => {
  it('copies old-tree documents to the new tree and repoints metadata', async () => {
    mockDownloads.metas = [
      {
        ...userMeta('1'),
        uri: 'content://tree/old/Video_1.mp4',
        docUri: 'content://tree/old/Video_1.mp4',
      },
    ];
    const { copyFile } = jest.requireMock('react-native-saf-x') as { copyFile: jest.Mock };
    copyFile.mockResolvedValueOnce({ uri: 'content://tree/new/Video_1.mp4' });

    const result = await migrateHiddenFolder('content://tree/new');

    expect(copyFile).toHaveBeenCalledWith(
      'content://tree/old/Video_1.mp4',
      'content://tree/new/Video_1.mp4',
      {
        replaceIfDestinationExists: true,
      }
    );
    expect(result).toEqual({ moved: 1, failed: [] });
    expect(mockDownloads.saved[0]).toMatchObject({
      uri: 'content://tree/new/Video_1.mp4',
      docUri: 'content://tree/new/Video_1.mp4',
    });
  });

  it('suffixes the id when a different file already holds the name', async () => {
    mockDownloads.metas = [
      {
        ...userMeta('2'),
        uri: 'content://tree/old/Video_2.mp4',
        docUri: 'content://tree/old/Video_2.mp4',
      },
    ];
    const { copyFile, exists } = jest.requireMock('react-native-saf-x') as {
      copyFile: jest.Mock;
      exists: jest.Mock;
    };
    exists.mockResolvedValueOnce(true);
    copyFile.mockResolvedValueOnce({ uri: 'content://tree/new/Video_2 [2].mp4' });

    await migrateHiddenFolder('content://tree/new');

    expect(copyFile).toHaveBeenCalledWith(
      'content://tree/old/Video_2.mp4',
      'content://tree/new/Video_2 [2].mp4',
      { replaceIfDestinationExists: true }
    );
  });
});
