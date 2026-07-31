import { useFavoritesStore } from './favorites-store';

// The root __mocks__/react-native-mmkv.ts backs storage with this shared map.
const mockStore = require('react-native-mmkv').__store as Record<string, string>;

beforeEach(() => {
  for (const key of Object.keys(mockStore)) delete mockStore[key];
  useFavoritesStore.setState({ favorites: [] });
});

describe('useFavoritesStore', () => {
  it('adds an item and persists it', () => {
    useFavoritesStore.getState().addFavorite({ id: '1', title: 'A', thumbnail: 't' });

    const { favorites } = useFavoritesStore.getState();
    expect(favorites).toHaveLength(1);
    expect(favorites[0].id).toBe('1');
    expect(favorites[0].addedAt).toBeGreaterThan(0);
    expect(JSON.parse(mockStore.favorites)).toHaveLength(1);
  });

  it('does not duplicate by id', () => {
    const { addFavorite } = useFavoritesStore.getState();
    addFavorite({ id: '1', title: 'A', thumbnail: 't' });
    addFavorite({ id: '1', title: 'A', thumbnail: 't' });

    expect(useFavoritesStore.getState().favorites).toHaveLength(1);
  });

  it('prepends new items (most recent first)', () => {
    const { addFavorite } = useFavoritesStore.getState();
    addFavorite({ id: '1', title: 'A', thumbnail: 't' });
    addFavorite({ id: '2', title: 'B', thumbnail: 't' });

    expect(useFavoritesStore.getState().favorites.map((f) => f.id)).toEqual(['2', '1']);
  });

  it('removes an item by id and updates persistence', () => {
    const { addFavorite, removeFavorite } = useFavoritesStore.getState();
    addFavorite({ id: '1', title: 'A', thumbnail: 't' });
    removeFavorite('1');

    expect(useFavoritesStore.getState().favorites).toHaveLength(0);
    expect(JSON.parse(mockStore.favorites)).toHaveLength(0);
  });

  it('isFavorite reflects state', () => {
    useFavoritesStore.getState().addFavorite({ id: '1', title: 'A', thumbnail: 't' });

    expect(useFavoritesStore.getState().isFavorite('1')).toBe(true);
    expect(useFavoritesStore.getState().isFavorite('2')).toBe(false);
  });
});
