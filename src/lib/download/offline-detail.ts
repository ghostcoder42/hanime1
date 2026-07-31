import type { VideoDetail } from '@/lib/hanime1/types';
import type { DownloadMetadata } from './index';

/**
 * Build a minimal `VideoDetail` from a download so the watch screen can render
 * (and play the local file) fully offline, when the detail query can't reach
 * the site.
 */
export function toOfflineDetail(meta: DownloadMetadata): VideoDetail {
  return {
    id: meta.videoId,
    title: meta.title,
    thumbnail: meta.thumbnail,
    author: meta.author,
    tags: [],
    sources: [{ resolution: meta.resolution, url: meta.uri }],
  };
}
