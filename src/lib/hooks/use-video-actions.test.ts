import { useActiveDownloadsStore } from '@/lib/stores/active-downloads-store';
import { useDownloadedStore } from '@/lib/stores/downloaded-store';
import { useFavoritesStore } from '@/lib/stores/favorites-store';
import { act, cleanup, renderHook } from '@testing-library/react-native';
import { useVideoActions } from './use-video-actions';

jest.mock('@/lib/haptics', () => ({ hapticSuccess: jest.fn() }));
jest.mock('react-native-flash-message', () => ({ showMessage: jest.fn() }));

const mockFetchVideoDetail = jest.fn();
const mockDownloadVideo = jest.fn();
jest.mock('@/lib/hanime1/scraper', () => ({
  fetchVideoDetail: (...a: unknown[]) => mockFetchVideoDetail(...a),
}));
jest.mock('@/lib/download/download-video', () => ({
  downloadVideo: (...a: unknown[]) => mockDownloadVideo(...a),
  cancelDownload: jest.fn(),
}));

const item = { id: '1', title: 'My Video', thumbnail: 't', author: 'au' };

const detail = {
  id: '1',
  title: 'My Video',
  thumbnail: 't',
  tags: [],
  sources: [
    { resolution: 480, url: 'lo' },
    { resolution: 720, url: 'mid' },
    { resolution: 1080, url: 'hi' },
  ],
};

const { showMessage } = require('react-native-flash-message') as { showMessage: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchVideoDetail.mockReset();
  mockDownloadVideo.mockReset();
  useFavoritesStore.setState({ favorites: [] });
  useDownloadedStore.setState({ downloads: [], ids: new Set(), loaded: true });
  useActiveDownloadsStore.setState({ tasks: {} });
});
afterEach(cleanup);

describe('useVideoActions — toggleFavorite', () => {
  it('reflects favorited state and adds the item when toggled', async () => {
    const { result } = await renderHook(() => useVideoActions(item));
    expect(result.current.isFavorite).toBe(false);

    await act(async () => {
      result.current.toggleFavorite();
    });

    expect(useFavoritesStore.getState().favorites.some((f) => f.id === '1')).toBe(true);
  });

  it('reflects an already-favorited item and removes it on toggle', async () => {
    useFavoritesStore.setState({
      favorites: [{ id: '1', title: 'My Video', thumbnail: 't', addedAt: 0 }],
    });
    const { result } = await renderHook(() => useVideoActions(item));
    expect(result.current.isFavorite).toBe(true);

    await act(async () => {
      result.current.toggleFavorite();
    });

    expect(useFavoritesStore.getState().favorites.some((f) => f.id === '1')).toBe(false);
  });
});

describe('useVideoActions — toggleDownload', () => {
  it('no-ops when already downloaded', async () => {
    useDownloadedStore.setState({ downloads: [], ids: new Set(['1']), loaded: true });
    const { result } = await renderHook(() => useVideoActions(item));

    await act(async () => {
      await result.current.toggleDownload();
    });

    expect(mockFetchVideoDetail).not.toHaveBeenCalled();
    expect(mockDownloadVideo).not.toHaveBeenCalled();
  });

  it('no-ops when a download is already active', async () => {
    useActiveDownloadsStore.setState({
      tasks: {
        '1': {
          videoId: '1',
          title: 't',
          thumbnail: '',
          progress: 0,
          status: 'downloading',
          startedAt: 0,
        },
      },
    });
    const { result } = await renderHook(() => useVideoActions(item));

    await act(async () => {
      await result.current.toggleDownload();
    });

    expect(mockFetchVideoDetail).not.toHaveBeenCalled();
  });

  it('fetches detail, picks 720p, downloads and shows a success toast', async () => {
    mockFetchVideoDetail.mockResolvedValue(detail);
    mockDownloadVideo.mockResolvedValue({});
    const { result } = await renderHook(() => useVideoActions(item));

    await act(async () => {
      await result.current.toggleDownload();
    });

    // surfaced immediately
    expect(useActiveDownloadsStore.getState().tasks['1']).toBeDefined();
    expect(mockFetchVideoDetail).toHaveBeenCalledWith('1');
    expect(mockDownloadVideo).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: '1', videoUrl: 'mid', resolution: 720 })
    );
    expect(showMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  it('marks the task failed (and surfaces a danger toast) when the detail fetch throws', async () => {
    mockFetchVideoDetail.mockRejectedValue(new Error('network down'));
    const { result } = await renderHook(() => useVideoActions(item));

    await act(async () => {
      await result.current.toggleDownload();
    });

    expect(useActiveDownloadsStore.getState().tasks['1']?.status).toBe('error');
    expect(showMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'danger' }));
  });
});
