export type VideoSource = {
  /** Vertical resolution, e.g. 480 / 720 / 1080 */
  resolution: number;
  url: string;
};

/**
 * Tag on a watch page. `tag` = attribute filter (searched via `tags[]`
 * params, e.g. 1080p / 巨乳); `query` = free-text franchise/character tag
 * (the site links it as a `/search?query=…` search).
 */
export type VideoTag = {
  name: string;
  kind: 'tag' | 'query';
};

/** Minimal card shape used by grids, favorites & history. */
export type VideoListItem = {
  id: string;
  title: string;
  author?: string;
  thumbnail: string;
  duration?: string;
  views?: string;
  likeRatio?: string;
  uploadedRelative?: string;
};

export type VideoDetail = VideoListItem & {
  description?: string;
  genre?: string;
  authorId?: string;
  viewsText?: string;
  uploadedDate?: string;
  likePercent?: string;
  tags: VideoTag[];
  sources: VideoSource[];
  /** high-res poster thumbnail */
  thumbnailHi?: string;
};

/** Sort options (site uses Chinese strings as query values). */
export const SORTS = {
  latestUpload: '最新上傳',
  latestRelease: '最新上市',
} as const;
export type SortKey = keyof typeof SORTS;

/** Known genres shown in the search filter modal. */
export const GENRES = [
  '裏番',
  '泡麵番',
  'Motion Anime',
  '3DCG',
  '2.5D',
  '2D動畫',
  'AI生成',
  'MMD',
  'Cosplay',
] as const;
export type Genre = (typeof GENRES)[number];

/**
 * The fixed attribute tags the site exposes as search-form checkboxes
 * (無碼 / 中文字幕 / 1080p / …). Multi-select; sent as repeatable `tags[]`
 * params. (Distinct from the free-form per-video tags on a watch page.)
 */
export const FILTER_TAGS = [
  '無碼',
  'AI解碼',
  '中文字幕',
  '中文配音',
  '同人作品',
  '斷面圖',
  'ASMR',
  '1080p',
  '60FPS',
  '3P',
  'NTR',
  'JK',
  'POV',
  'BDSM',
  'OL',
] as const;

export type SearchParams = {
  query?: string;
  genre?: string;
  tags?: string[];
  sort?: string;
  broad?: boolean;
  page?: number;
};

export type ListResult<T> = {
  items: T[];
  nextPage: number | null;
  lastPage: number | null;
};

export type VideoListParams = Omit<SearchParams, 'page'>;
