import { useFollowingStore } from './following-store';

const mockStore = require('react-native-mmkv').__store as Record<string, string>;

beforeEach(() => {
  for (const key of Object.keys(mockStore)) delete mockStore[key];
  useFollowingStore.setState({ following: [] });
});

describe('useFollowingStore', () => {
  it('follows an author and persists', () => {
    useFollowingStore.getState().follow({ id: 'u1', name: 'Artist' });

    expect(useFollowingStore.getState().following).toHaveLength(1);
    expect(JSON.parse(mockStore.following_authors)).toHaveLength(1);
  });

  it('does not duplicate followed authors', () => {
    const { follow } = useFollowingStore.getState();
    follow({ id: 'u1', name: 'Artist' });
    follow({ id: 'u1', name: 'Artist' });

    expect(useFollowingStore.getState().following).toHaveLength(1);
  });

  it('unfollows', () => {
    const { follow, unfollow } = useFollowingStore.getState();
    follow({ id: 'u1', name: 'Artist' });
    unfollow('u1');

    expect(useFollowingStore.getState().following).toHaveLength(0);
  });

  it('isFollowing reflects state', () => {
    useFollowingStore.getState().follow({ id: 'u1', name: 'Artist' });

    expect(useFollowingStore.getState().isFollowing('u1')).toBe(true);
    expect(useFollowingStore.getState().isFollowing('u2')).toBe(false);
  });
});
