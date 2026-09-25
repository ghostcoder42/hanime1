import {
  AppNetworkError,
  classifyHttpStatus,
  classifyTransportError,
  httpErrorDetail,
  isCloudflareBlock,
  networkErrorMessage,
} from './errors';

describe('classifyHttpStatus', () => {
  it('maps firewall/rate-limit statuses to blocked', () => {
    expect(classifyHttpStatus(403)).toBe('blocked');
    expect(classifyHttpStatus(429)).toBe('blocked');
  });

  it('maps missing content to notFound', () => {
    expect(classifyHttpStatus(404)).toBe('notFound');
    expect(classifyHttpStatus(410)).toBe('notFound');
  });

  it('maps 5xx to serverError and other 4xx to httpError', () => {
    expect(classifyHttpStatus(500)).toBe('serverError');
    expect(classifyHttpStatus(503)).toBe('serverError');
    expect(classifyHttpStatus(418)).toBe('httpError');
  });
});

describe('isCloudflareBlock / httpErrorDetail', () => {
  it('detects the Cloudflare firewall page in a 403 body', () => {
    const body = '<title>Attention Required! | Cloudflare</title> Sorry, you have been blocked';
    expect(isCloudflareBlock(403, body)).toBe(true);
    expect(httpErrorDetail({ status: 403, body })).toBe('Cloudflare firewall block page');
  });

  it('does not flag non-403 or plain bodies', () => {
    expect(isCloudflareBlock(500, 'cloudflare')).toBe(false);
    expect(isCloudflareBlock(403, '<html>plain</html>')).toBe(false);
  });
});

describe('classifyTransportError', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('classifies aborts as timeout without probing', async () => {
    const err = new DOMException('The user aborted a request.', 'AbortError');
    const result = await classifyTransportError(err, 'https://x/y');
    expect(result).toBeInstanceOf(AppNetworkError);
    expect(result.kind).toBe('timeout');
  });

  it('classifies as offline when the connectivity probe also fails', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    const result = await classifyTransportError(
      new TypeError('Network request failed'),
      'https://x/y'
    );
    expect(result.kind).toBe('offline');
  });

  it('classifies as unreachable when the probe succeeds but the site failed', async () => {
    // Probe target is cp.cloudflare.com — only that host answers.
    globalThis.fetch = (async (url: string | URL | Request) => {
      if (String(url).includes('cp.cloudflare.com')) return { ok: true, status: 204 };
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    const result = await classifyTransportError(
      new TypeError('Network request failed'),
      'https://x/y'
    );
    expect(result.kind).toBe('unreachable');
  });
});

describe('networkErrorMessage', () => {
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;

  it('maps AppNetworkError kinds to their i18n key', () => {
    const err = new AppNetworkError('blocked', { status: 403 });
    expect(networkErrorMessage(err, t)).toBe('errors.blocked:{"status":403}');
  });

  it('falls back to the unknown key for non-network errors', () => {
    expect(networkErrorMessage(new Error('boom'), t)).toBe('errors.unknown');
  });
});
