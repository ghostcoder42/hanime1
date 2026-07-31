// Holder prefixed with `mock` so the jest.mock factory can reference it.
const mockFS = {
  progressCallback: null as
    | ((d: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void)
    | null,
  rejectDownload: null as ((e: unknown) => void) | null,
  downloadAsyncResult: { uri: 'file:///doc/videos/1.mp4' } as { uri: string } | undefined,
  shouldThrow: false,
};

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 100 }),
  makeDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn(),
  createDownloadResumable: jest.fn((_url, _uri, _opts, cb) => {
    mockFS.progressCallback = cb;
    return {
      downloadAsync: jest.fn(
        () =>
          new Promise<{ uri: string } | undefined>((resolve, reject) => {
            mockFS.rejectDownload = reject;
            if (mockFS.shouldThrow) {
              reject(new Error('network down'));
              return;
            }
            if (mockFS.downloadAsyncResult) {
              resolve(mockFS.downloadAsyncResult);
            }
            // else: stays pending until cancelDownload rejects it
          })
      ),
      cancelAsync: jest.fn(() => {
        mockFS.rejectDownload?.(new Error('cancelled'));
      }),
    };
  }),
}));

jest.mock('@/lib/download', () => ({
  DOWNLOAD_DIR: 'file:///doc/videos/',
  ensureDownloadDir: jest.fn().mockResolvedValue(undefined),
  localUriFor: (id: string) => `file:///doc/videos/${id}.mp4`,
  saveDownloadMetadata: jest.fn(),
  deleteDownload: jest.fn().mockResolvedValue(undefined),
}));

import { cancelDownload, downloadVideo } from '@/lib/download/download-video';
import { useActiveDownloadsStore } from '@/lib/stores/active-downloads-store';
import { useDownloadedStore } from '@/lib/stores/downloaded-store';

const opts = {
  videoUrl: 'https://example.com/v.mp4',
  videoId: '1',
  title: 'My Video',
  thumbnail: '',
  resolution: 720,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFS.progressCallback = null;
  mockFS.rejectDownload = null;
  mockFS.downloadAsyncResult = { uri: 'file:///doc/videos/1.mp4' };
  mockFS.shouldThrow = false;
  useActiveDownloadsStore.setState({ tasks: {} });
  useDownloadedStore.setState({ downloads: [], ids: new Set(), loaded: true });
});

describe('downloadVideo', () => {
  it('drives the active store through downloading -> complete and registers metadata', async () => {
    useActiveDownloadsStore.getState().start({ videoId: '1', title: 'My Video', thumbnail: '' });

    await downloadVideo(opts);

    // Completed: active task removed, completed store has the entry.
    expect(useActiveDownloadsStore.getState().tasks['1']).toBeUndefined();
    expect(useDownloadedStore.getState().downloads.some((d) => d.videoId === '1')).toBe(true);
  });

  it('marks the active task as error when the download throws', async () => {
    mockFS.shouldThrow = true;
    useActiveDownloadsStore.getState().start({ videoId: '1', title: 'My Video', thumbnail: '' });

    await expect(downloadVideo(opts)).rejects.toThrow('network down');

    const task = useActiveDownloadsStore.getState().tasks['1'];
    expect(task?.status).toBe('error');
    expect(task?.error).toBe('network down');
  });
});

describe('cancelDownload', () => {
  it('cancels the in-flight download, deletes the partial file and removes the task', async () => {
    useActiveDownloadsStore.getState().start({ videoId: '1', title: 'My Video', thumbnail: '' });
    // downloadAsync hangs (pending) until cancel rejects it.
    mockFS.downloadAsyncResult = undefined; // force the pending branch
    const pending = downloadVideo(opts);
    // Let downloadVideo reach the hanging downloadAsync (registers the resumable).
    await new Promise((r) => setTimeout(r, 50));

    await cancelDownload('1');

    expect(useActiveDownloadsStore.getState().tasks['1']).toBeUndefined();
    // The in-flight download rejects (cancelled) and does not register.
    await expect(pending).rejects.toThrow('cancelled');
    expect(useDownloadedStore.getState().downloads).toHaveLength(0);
  }, 15000);
});
