import { getItem, setItem } from '@/lib/storage';
import { create } from 'zustand';

export type FollowedAuthor = {
  id: string;
  name: string;
  followedAt: number;
};

const KEY = 'following_authors';

type FollowingStore = {
  following: FollowedAuthor[];
  follow: (author: Omit<FollowedAuthor, 'followedAt'>) => void;
  unfollow: (id: string) => void;
  isFollowing: (id: string) => boolean;
};

export const useFollowingStore = create<FollowingStore>((set, get) => ({
  following: getItem<FollowedAuthor[]>(KEY) ?? [],

  follow: (author) => {
    if (get().following.some((a) => a.id === author.id)) return;
    const updated = [{ ...author, followedAt: Date.now() }, ...get().following];
    setItem(KEY, updated);
    set({ following: updated });
  },

  unfollow: (id) => {
    const updated = get().following.filter((a) => a.id !== id);
    setItem(KEY, updated);
    set({ following: updated });
  },

  isFollowing: (id) => get().following.some((a) => a.id === id),
}));
