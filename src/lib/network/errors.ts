import type { TxKeyPath } from '@/lib/i18n/types';

/**
 * Classified network errors.
 *
 * React Native surfaces every transport-level failure (DNS, refused, TLS
 * reset, firewall drop) as an opaque `TypeError: Network request failed`,
 * and a 403 from the site's Cloudflare firewall used to render as a generic
 * "failed to load" that looked identical to a broken search. This module
 * turns failures into `AppNetworkError`s carrying a `kind` the UI can map
 * to a specific, actionable message.
 *
 * Transport failures are disambiguated with a connectivity probe: if a
 * known-good endpoint answers, the device is online and the site itself is
 * refusing/dropping us (IP block, TLS interference); if it doesn't, the
 * device has no usable internet.
 */

export type NetworkErrorKind =
  | 'timeout'
  | 'blocked'
  | 'notFound'
  | 'serverError'
  | 'httpError'
  | 'offline'
  | 'unreachable'
  | 'unknown';

export class AppNetworkError extends Error {
  readonly kind: NetworkErrorKind;
  readonly status?: number;
  readonly url?: string;
  /** Raw underlying error/response text, kept for the in-app log viewer. */
  readonly detail?: string;

  constructor(
    kind: NetworkErrorKind,
    opts: { message?: string; status?: number; url?: string; detail?: string } = {}
  ) {
    super(opts.message ?? kind);
    this.name = 'AppNetworkError';
    this.kind = kind;
    this.status = opts.status;
    this.url = opts.url;
    this.detail = opts.detail;
  }
}

/** i18n key for each kind — screens render these with the app's translate fn. */
export const NETWORK_ERROR_MESSAGES: Record<NetworkErrorKind, TxKeyPath> = {
  timeout: 'errors.timeout',
  blocked: 'errors.blocked',
  notFound: 'errors.notFound',
  serverError: 'errors.serverError',
  httpError: 'errors.httpError',
  offline: 'errors.offline',
  unreachable: 'errors.unreachable',
  unknown: 'errors.unknown',
};

/** Translate fn of the app's i18n setup (subset used here, keeps this module testable). */
type Translate = (key: TxKeyPath, params?: Record<string, string | number>) => string;

export function networkErrorMessage(err: unknown, t: Translate): string {
  if (err instanceof AppNetworkError) {
    return t(NETWORK_ERROR_MESSAGES[err.kind], { status: err.status ?? '' });
  }
  return t('errors.unknown');
}

const CLOUDFLARE_BLOCK_MARKERS =
  /cloudflare|cf-error-details|attention required|you have been blocked|cf-wrapper/i;

/** Classify a non-2xx HTTP response by status (+ response body sniffing). */
export function classifyHttpStatus(status: number): NetworkErrorKind {
  if (status === 403 || status === 429) return 'blocked';
  if (status === 404 || status === 410) return 'notFound';
  if (status >= 500) return 'serverError';
  return 'httpError';
}

export function isCloudflareBlock(status: number, body = ''): boolean {
  return status === 403 && CLOUDFLARE_BLOCK_MARKERS.test(body);
}

/** A short, locale-independent summary line for the log viewer / detail field. */
export function httpErrorDetail(err: { status: number; body?: string }): string {
  if (isCloudflareBlock(err.status, err.body)) {
    return 'Cloudflare firewall block page';
  }
  return err.body ? err.body.slice(0, 200).replace(/\s+/g, ' ').trim() : '';
}

const PROBE_URL = 'https://cp.cloudflare.com/generate_204';
const PROBE_TIMEOUT_MS = 5_000;

/**
 * Connectivity probe: fetch a tiny, highly-available endpoint (Cloudflare's
 * captive-portal check). `true` means the device has usable internet, so a
 * failing site request is the site's edge refusing/dropping us.
 */
export async function probeInternet(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(PROBE_URL, {
      signal: controller.signal,
      headers: { Accept: '*/*' },
      cache: 'no-store',
    } as RequestInit);
    // Any answer at all (even a proxy error page) proves transport works.
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && /abort/i.test(err.name)) ||
    (err instanceof Error && /aborted/i.test(err.message))
  );
}

/**
 * Classify a transport-level fetch failure. Aborts map to timeout; anything
 * else runs the connectivity probe to tell "device offline" apart from
 * "site unreachable/blocked".
 */
export async function classifyTransportError(err: unknown, url?: string): Promise<AppNetworkError> {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  if (isAbortError(err)) {
    return new AppNetworkError('timeout', { message: 'Request timed out', url, detail: raw });
  }
  const online = await probeInternet();
  return new AppNetworkError(online ? 'unreachable' : 'offline', {
    message: online ? 'Site unreachable (connection dropped or refused)' : 'No internet',
    url,
    detail: raw,
  });
}
