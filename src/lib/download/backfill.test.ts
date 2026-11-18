jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 40556438 }),
  makeDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn(),
  moveAsync: jest.fn(),
  copyAsync: jest.fn(),
  getFreeDiskStorageAsync: jest.fn().mockResolvedValue(1024 ** 3),
}));

import { removeItem } from '@/lib/storage';
import { backfillMissingSizes, getAllDownloads, saveDownloadMetadata } from './index';
import * as FileSystem from 'expo-file-system/legacy';
import { stat } from 'react-native-saf-x';

const mockGetInfo = FileSystem.getInfoAsync as jest.Mock;
const mockStat = stat as jest.Mock;

beforeEach(() => {
  // Wipe the persisted download map between tests (in-memory mmkv mock).
  removeItem('download_metadata');
  mockGetInfo.mockClear().mockResolvedValue({ exists: true, size: 40556438 });
  mockStat.mockClear().mockResolvedValue({ size: 12345, uri: 'content://x' });
});

describe('backfillMissingSizes', () => {
  it('stats app-space files and persists the measured size', async () => {
    saveDownloadMetadata({
      videoId: '1',
      title: 'Legacy',
      thumbnail: '',
      uri: 'file:///doc/videos/Legacy.mp4',
      size: 0,
      resolution: 720,
      downloadedAt: 1,
    });

    await backfillMissingSizes();

    expect(mockGetInfo).toHaveBeenCalledWith('file:///doc/videos/Legacy.mp4');
    expect(getAllDownloads()[0]?.size).toBe(40556438);
  });

  it('stats hidden-mode documents through SAF', async () => {
    saveDownloadMetadata({
      videoId: '2',
      title: 'Hidden legacy',
      thumbnail: '',
      uri: 'content://tree/x/Hidden_legacy.mp4',
      size: 0,
      resolution: 720,
      downloadedAt: 1,
      location: 'user',
      docUri: 'content://tree/x/Hidden_legacy.mp4',
    });

    await backfillMissingSizes();

    expect(mockStat).toHaveBeenCalledWith('content://tree/x/Hidden_legacy.mp4');
    expect(getAllDownloads()[0]?.size).toBe(12345);
  });

  it('leaves entries with a recorded size untouched', async () => {
    saveDownloadMetadata({
      videoId: '3',
      title: 'Modern',
      thumbnail: '',
      uri: 'file:///doc/videos/Modern.mp4',
      size: 999,
      resolution: 720,
      downloadedAt: 1,
    });

    await backfillMissingSizes();

    expect(mockGetInfo).not.toHaveBeenCalled();
    expect(getAllDownloads()[0]?.size).toBe(999);
  });
});
