import { useDownloadedStore } from '@/lib/stores';
import { useFavoritesStore } from '@/lib/stores';
import { useActiveDownloadsStore } from '@/lib/stores/active-downloads-store';
import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { act } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { VideoTile } from './video-tile';

// Capture the props passed to the (mocked) MenuView so we can assert on the
// actions array and the onPressAction dispatcher.
const mockMenu = {
  lastProps: {} as {
    actions?: {
      id: string;
      title: string;
      image?: string;
      attributes?: { disabled?: boolean };
    }[];
    onPressAction?: (e: { nativeEvent: { event: string } }) => void;
  },
};

jest.mock('@react-native-menu/menu', () => {
  const MenuView = ({ children, ...props }: { children?: ReactNode }) => {
    mockMenu.lastProps = props as typeof mockMenu.lastProps;
    return children ?? null;
  };
  return { MenuView };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('expo-image', () => ({
  Image: () => null,
}));
jest.mock('@/components/icon', () => ({
  Icon: () => null,
}));
jest.mock('@/lib/haptics', () => ({ hapticSuccess: jest.fn() }));
jest.mock('@/lib/hanime1/scraper', () => ({
  buildUrl: () => 'https://example.com',
  endpoints: { watch: () => '/watch' },
  fetchVideoDetail: jest.fn(),
}));
jest.mock('react-native-flash-message', () => ({ showMessage: jest.fn() }));

const setPlatform = (os: 'android' | 'ios') =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true });

const item = {
  id: '1',
  title: 'Test Video',
  thumbnail: 'https://example.com/t.jpg',
  duration: '08:25',
};

beforeEach(() => {
  setPlatform('android');
  useFavoritesStore.setState({ favorites: [] });
  useDownloadedStore.setState({ downloads: [], ids: new Set() });
  useActiveDownloadsStore.setState({ tasks: {} });
  mockPush.mockClear();
});
afterEach(cleanup);

describe('VideoTile — rendering', () => {
  it('renders the title and duration', async () => {
    const { getByText } = await render(<VideoTile item={item} />);
    expect(getByText('Test Video')).toBeTruthy();
    expect(getByText('08:25')).toBeTruthy();
  });

  it('shows the favorite badge when favorited', async () => {
    useFavoritesStore.getState().addFavorite(item);
    const { getByTestId } = await render(<VideoTile item={item} />);

    expect(getByTestId('video-tile-fav')).toBeTruthy();
  });

  it('shows the downloaded badge when downloaded', async () => {
    useDownloadedStore.setState({
      downloads: [
        {
          videoId: '1',
          title: 'Test',
          thumbnail: '',
          uri: 'file://x',
          size: 0,
          resolution: 720,
          downloadedAt: 0,
        },
      ],
      ids: new Set(['1']),
    });
    const { getByTestId } = await render(<VideoTile item={item} />);

    expect(getByTestId('video-tile-downloaded')).toBeTruthy();
  });

  it('shows the live download badge while downloading', async () => {
    useActiveDownloadsStore.setState({
      tasks: {
        '1': {
          videoId: '1',
          title: 'Test',
          thumbnail: '',
          progress: 0.5,
          status: 'downloading',
          startedAt: 0,
        },
      },
    });
    const { getByTestId, getByText } = await render(<VideoTile item={item} />);

    expect(getByTestId('video-tile-downloading')).toBeTruthy();
    expect(getByText('↓50%')).toBeTruthy();
  });

  it('shows no badges for a fresh item', async () => {
    const { queryByTestId } = await render(<VideoTile item={item} />);

    expect(queryByTestId('video-tile-fav')).toBeNull();
    expect(queryByTestId('video-tile-downloaded')).toBeNull();
    expect(queryByTestId('video-tile-downloading')).toBeNull();
  });
});

describe('VideoTile — gestures', () => {
  it('navigates to the video detail on short tap', async () => {
    const { getByTestId } = await render(<VideoTile item={item} />);

    fireEvent(getByTestId('video-tile'), 'press');

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/watch/[id]',
      params: { id: '1' },
    });
  });

  it('long-press handler does not call the navigation function (wiring guard)', async () => {
    const { getByTestId } = await render(<VideoTile item={item} />);

    fireEvent(getByTestId('video-tile'), 'longPress');

    // Regression guard: if someone accidentally wires onLongPress to openDetail,
    // this fails. Note: this does NOT verify RN's native press suppression or
    // the native menu — those are verified on device, not in jsdom.
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('VideoTile — context menu actions', () => {
  it('offers Favorite / Download / Share by default', async () => {
    await render(<VideoTile item={item} />);

    const ids = mockMenu.lastProps.actions?.map((a) => a.id);
    expect(ids).toEqual(['favorite', 'download', 'share']);
  });

  it('reflects favorited state in the Favorite action', async () => {
    useFavoritesStore.getState().addFavorite(item);

    await render(<VideoTile item={item} />);

    const favoriteAction = mockMenu.lastProps.actions?.find((a) => a.id === 'favorite');
    expect(favoriteAction?.title).toBe('Remove from favorites');
  });

  it('disables the Download action while downloading', async () => {
    useActiveDownloadsStore.setState({
      tasks: {
        '1': {
          videoId: '1',
          title: 'Test',
          thumbnail: '',
          progress: 0,
          status: 'downloading',
          startedAt: 0,
        },
      },
    });

    await render(<VideoTile item={item} />);

    const downloadAction = mockMenu.lastProps.actions?.find((a) => a.id === 'download');
    expect(downloadAction?.title).toBe('Downloading…');
    expect(downloadAction?.attributes).toEqual({ disabled: true });
  });

  it("adds the item to favorites when the 'favorite' action is dispatched", async () => {
    await render(<VideoTile item={item} />);

    act(() => {
      mockMenu.lastProps.onPressAction?.({ nativeEvent: { event: 'favorite' } });
    });

    expect(useFavoritesStore.getState().favorites.some((f) => f.id === '1')).toBe(true);
  });
});
