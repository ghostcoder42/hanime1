import { storage } from '@/lib/storage';

/**
 * Known mirrors of the same backend. `hanimeone.me` is the default (passes
 * bot filtering); `hanime1.me` is kept as a user-selectable fallback. The
 * scraper is domain-agnostic — only this list + the persisted choice matter.
 */
export const SITE_DOMAINS = ['https://hanimeone.me', 'https://hanime1.me'] as const;
export type SiteDomain = (typeof SITE_DOMAINS)[number];

export const DEFAULT_DOMAIN: SiteDomain = SITE_DOMAINS[0];
export const SITE_DOMAIN_KEY = 'site_domain';

export function isSiteDomain(value: string | undefined): value is SiteDomain {
  return !!value && (SITE_DOMAINS as readonly string[]).includes(value);
}

/** Read the current base domain (synchronous — safe to call inside query fetchers). */
export function getCurrentDomain(): SiteDomain {
  return isSiteDomain(storage.getString(SITE_DOMAIN_KEY))
    ? (storage.getString(SITE_DOMAIN_KEY) as SiteDomain)
    : DEFAULT_DOMAIN;
}

export function buildUrl(path: string): string {
  const base = getCurrentDomain();
  const slash = path.startsWith('/') ? '' : '/';
  return `${base}${slash}${path}`;
}

import type { SearchParams } from './types';

/** Build the /search URL (also used as the paginated "latest" home feed). */
export function buildSearchUrl(params: SearchParams): string {
  const sp = new URLSearchParams();
  if (params.sort) sp.set('sort', params.sort);
  if (params.query) sp.set('query', params.query);
  if (params.genre) sp.set('genre', params.genre);
  if (params.tags) {
    for (const tag of params.tags) sp.append('tags[]', tag);
  }
  if (params.broad) sp.set('broad', '1');
  if (params.page && params.page > 1) sp.set('page', String(params.page));
  const qs = sp.toString();
  return qs ? `/search?${qs}` : '/search';
}

export const endpoints = {
  /** Latest feed = search sorted by upload date. */
  home: (page: number) => buildSearchUrl({ sort: '最新上傳', page }),
  search: (params: SearchParams) => buildSearchUrl(params),
  watch: (id: string) => `/watch?v=${id}`,
  user: (id: string) => `/user/${id}`,
  download: (id: string) => `/download?v=${id}`,
} as const;
