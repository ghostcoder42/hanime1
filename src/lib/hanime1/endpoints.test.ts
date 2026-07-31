import { storage } from '@/lib/storage';
import {
  SITE_DOMAINS,
  SITE_DOMAIN_KEY,
  buildSearchUrl,
  buildUrl,
  getCurrentDomain,
} from './endpoints';

beforeEach(() => {
  storage.clearAll();
});

describe('domain switching', () => {
  it('defaults to the primary domain', () => {
    expect(getCurrentDomain()).toBe(SITE_DOMAINS[0]);
  });

  it('buildUrl prefixes the current domain', () => {
    expect(buildUrl('/watch?v=1')).toBe('https://hanimeone.me/watch?v=1');
  });

  it('honours a user-selected mirror', () => {
    storage.set(SITE_DOMAIN_KEY, 'https://hanime1.me');
    expect(getCurrentDomain()).toBe('https://hanime1.me');
    expect(buildUrl('/x')).toBe('https://hanime1.me/x');
  });

  it('falls back to the default for an unknown/foreign domain', () => {
    storage.set(SITE_DOMAIN_KEY, 'https://evil.example');
    expect(getCurrentDomain()).toBe('https://hanimeone.me');
  });
});

describe('buildSearchUrl', () => {
  it('URL-encodes Chinese sort values', () => {
    const url = buildSearchUrl({ sort: '最新上傳', page: 2 });
    expect(url.startsWith('/search?')).toBe(true);
    expect(url).toContain(encodeURIComponent('最新上傳'));
    expect(url).toContain('page=2');
  });

  it('appends repeatable tags[] params', () => {
    const url = buildSearchUrl({ tags: ['巨乳', '內射'] });
    expect(url).toContain('tags%5B%5D=');
  });

  it('omits the page param on page 1', () => {
    expect(buildSearchUrl({ page: 1 })).toBe('/search');
  });
});
