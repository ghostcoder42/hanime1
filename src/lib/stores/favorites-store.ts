import { getItem, setItem } from '@/lib/storage';
import { create } from 'zustand';

export type FavoriteItem = {
  id: string;
  title: string;
  thumbnail: string;
  duration?: string;
  author?: string;
  addedAt: number;
};

const KEY = 'favorites';

type FavoritesStore = {
  favorites: FavoriteItem[];
  addFavorite: (item: Omit<FavoriteItem, 'addedAt'>) => void;
  removeFavorite: (id: string) => void;
  clearFavorites: () => void;
  isFavorite: (id: string) => boolean;
};

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  favorites: getItem<FavoriteItem[]>(KEY) ?? [],

  addFavorite: (item) => {
    if (get().favorites.some((f) => f.id === item.id)) return;
    const updated = [{ ...item, addedAt: Date.now() }, ...get().favorites];
    setItem(KEY, updated);
    set({ favorites: updated });
  },

  removeFavorite: (id) => {
    const updated = get().favorites.filter((f) => f.id !== id);
    setItem(KEY, updated);
    set({ favorites: updated });
  },

  clearFavorites: () => {
    setItem(KEY, []);
    set({ favorites: [] });
  },

  isFavorite: (id) => get().favorites.some((f) => f.id === id),
}));
