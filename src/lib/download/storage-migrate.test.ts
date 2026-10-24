const mockDownloads = {
  metas: [] as Array<Record<string, unknown>>,
  saved: [] as Array<Record<string, unknown>>,
};

jest.mock('./index', () => ({
  ensureDownloadDir: jest.fn().mockResolvedValue(undefined),
  localUriFor: (id: string) => `file:///doc/videos/${id}.mp4`,
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
}));

jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
}));

import { storage } from '@/lib/storage';
import {
  getStorageLocation,
  hasVideosIn,
  migrateAllToAppSpace,
  migrateAllToUserSpace,
  setStorageLocation,
} from '@/lib/download/storage-migrate';
import * as FileSystem from 'expo-file-system/legacy';
import { moveUserSpaceAssetToApp, placeIntoUserSpace } from './user-space';

const mockPlace = placeIntoUserSpace as jest.Mock;
const mockMoveBack = moveUserSpaceAssetToApp as jest.Mock;
const mockFS = FileSystem as unknown as {
  deleteAsync: jest.Mock;
  copyAsync: jest.Mock;
  makeDirectoryAsync: jest.Mock;
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
  mockFS.deleteAsync.mockClear();
  mockFS.copyAsync.mockClear();
  // @ts-expect-error the in-memory mmkv mock exposes `delete`
  storage.delete('settings.storageLocation');
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
