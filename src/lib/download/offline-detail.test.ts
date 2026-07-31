import type { DownloadMetadata } from './index';
import { toOfflineDetail } from './offline-detail';

const meta: DownloadMetadata = {
  videoId: '123',
  title: 'Offline Title',
  thumbnail: 'https://x/t.jpg',
  uri: 'file:///data/videos/123.mp4',
  size: 1024,
  resolution: 720,
  downloadedAt: 0,
  author: 'Artist',
};

it('builds a detail that points at the local file', () => {
  const detail = toOfflineDetail(meta);
  expect(detail.id).toBe('123');
  expect(detail.title).toBe('Offline Title');
  expect(detail.author).toBe('Artist');
  expect(detail.sources).toEqual([{ resolution: 720, url: 'file:///data/videos/123.mp4' }]);
  expect(detail.tags).toEqual([]);
});
