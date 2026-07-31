jest.mock('@/lib/download', () => ({
  reconcileDownloads: jest.fn().mockResolvedValue([]),
  getAllDownloads: jest.fn().mockReturnValue([]),
  getDownloadByVideoId: jest.fn().mockReturnValue(null),
  deleteDownload: jest.fn().mockResolvedValue(undefined),
  clearAllDownloads: jest.fn().mockResolvedValue(undefined),
}));

import {
  clearAllDownloads,
  deleteDownload,
  getAllDownloads,
  getDownloadByVideoId,
  reconcileDownloads,
} from '@/lib/download';
import type { DownloadMetadata } from '@/lib/download';
import { useDownloadedStore } from './downloaded-store';

const meta = (id: string): DownloadMetadata => ({
  videoId: id,
  title: `title-${id}`,
  thumbnail: `t-${id}`,
  uri: `file://${id}`,
  size: 100,
  resolution: 720,
  downloadedAt: Number(id),
});

beforeEach(() => {
  jest.clearAllMocks();
  (getAllDownloads as jest.Mock).mockReturnValue([]);
  (getDownloadByVideoId as jest.Mock).mockReturnValue(null);
  useDownloadedStore.setState({ downloads: [], ids: new Set(), loaded: false });
});

describe('useDownloadedStore', () => {
  it('hydrate reconciles orphans, loads entries and marks loaded', async () => {
    (getAllDownloads as jest.Mock).mockReturnValue([meta('2'), meta('1')]);

    await useDownloadedStore.getState().hydrate();

    expect(reconcileDownloads).toHaveBeenCalledTimes(1);
    const state = useDownloadedStore.getState();
    expect(state.loaded).toBe(true);
    expect(state.downloads.map((d) => d.videoId)).toEqual(['2', '1']);
    expect(state.ids.has('1')).toBe(true);
  });

  it('register prepends and de-dupes by videoId', () => {
    useDownloadedStore.getState().register(meta('1'));
    useDownloadedStore.getState().register(meta('1'));

    expect(useDownloadedStore.getState().downloads).toHaveLength(1);
    useDownloadedStore.getState().register(meta('2'));
    expect(useDownloadedStore.getState().downloads.map((d) => d.videoId)).toEqual(['2', '1']);
    expect(useDownloadedStore.getState().ids.has('2')).toBe(true);
  });

  it('remove deletes on disk and drops the entry + id', async () => {
    useDownloadedStore.getState().register(meta('1'));

    await useDownloadedStore.getState().remove('1');

    expect(deleteDownload).toHaveBeenCalledWith('1');
    expect(useDownloadedStore.getState().downloads).toHaveLength(0);
    expect(useDownloadedStore.getState().ids.has('1')).toBe(false);
  });

  it('clearAll wipes disk + state', async () => {
    useDownloadedStore.getState().register(meta('1'));

    await useDownloadedStore.getState().clearAll();

    expect(clearAllDownloads).toHaveBeenCalledTimes(1);
    expect(useDownloadedStore.getState().downloads).toHaveLength(0);
    expect(useDownloadedStore.getState().ids.size).toBe(0);
  });

  it('has / get delegate to state and metadata store', () => {
    (getDownloadByVideoId as jest.Mock).mockReturnValue(meta('1'));
    useDownloadedStore.setState({ downloads: [meta('1')], ids: new Set(['1']), loaded: true });

    expect(useDownloadedStore.getState().has('1')).toBe(true);
    expect(useDownloadedStore.getState().has('99')).toBe(false);
    expect(useDownloadedStore.getState().get('1')?.videoId).toBe('1');
  });
});
