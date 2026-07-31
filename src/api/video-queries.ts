import { fetchUserVideos, fetchVideoDetail, fetchVideoList } from '@/lib/hanime1/scraper';
import type { ListResult, VideoDetail, VideoListItem, VideoListParams } from '@/lib/hanime1/types';
import { createInfiniteQuery, createQuery } from 'react-query-kit';

/** Infinite feed used by Home (sort=latest) and Search (query/genre/tags). */
export const useSearchVideos = createInfiniteQuery<
  ListResult<VideoListItem>,
  VideoListParams,
  Error
>({
  queryKey: ['videos', 'search'],
  initialPageParam: 1,
  fetcher: async (variables, { pageParam }) => fetchVideoList({ ...variables, page: pageParam }),
  getNextPageParam: (lastPage) => lastPage.nextPage,
});

export const useVideoDetail = createQuery<VideoDetail, { id: string }, Error>({
  queryKey: ['video'],
  fetcher: (variables) => fetchVideoDetail(variables.id),
});

/** Single page of a user's uploads (the site's user page has no pagination). */
export const useUserVideos = createQuery<ListResult<VideoListItem>, { id: string }, Error>({
  queryKey: ['user'],
  fetcher: (variables) => fetchUserVideos(variables.id),
});
